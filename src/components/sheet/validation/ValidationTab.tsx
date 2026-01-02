"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { Timestamp, doc, setDoc } from "firebase/firestore";

import InfoDialog from "@/components/common/InfoDialog";
import Loading from "@/components/layout/Loading";
import ValidationSettingsBox from "@/components/sheet/validation/ValidationSettingsBox";
import { db } from "@/lib/firebase";
import { createFirestoreValidationSpecRepo } from "@/lib/repos";
import { buildRuntimeValidationSpec, toRowObjects } from "@/lib/validationRuntime";
import type { DataType, SheetMapping } from "@/models/mapping";
import type { SheetData } from "@/lib/sheets";
import { useValidationSpecEditor } from "@/hooks/useValidationSpecEditor";
import { validateSheetData, type ValidationResult, type ValidationSpec } from "@shared/mapping";

const MAX_ISSUES_PREVIEW = 200;

const isRowRuleIssue = (ruleId: string): boolean => {
  return (
    ruleId === "requireWhen" ||
    ruleId === "equalsWhen" ||
    ruleId === "allowWhen" ||
    ruleId === "disallowWhen" ||
    ruleId === "denyTuple" ||
    ruleId === "numberRelation" ||
    ruleId === "dateRelation" ||
    ruleId === "timeRelation"
  );
};

const defaultRowRuleName = (ruleId: string): string => {
  switch (ruleId) {
    case "requireWhen":
      return "条件付き必須";
    case "allowWhen":
      return "条件付き許可";
    case "disallowWhen":
      return "条件付き禁止";
    case "equalsWhen":
      return "条件一致";
    case "denyTuple":
      return "禁止組み合わせ";
    case "numberRelation":
      return "数値の大小関係";
    case "dateRelation":
      return "日時の前後関係";
    case "timeRelation":
      return "時刻の前後関係";
    default:
      return ruleId;
  }
};

const formatIssueValue = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const escapeCsvCell = (v: string): string => {
  const s = (v ?? "").toString();
  if (/[\r\n",]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const toCsvText = (rows: string[][]): string => {
  return rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\r\n");
};

const downloadTextAsFile = (fileName: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
};

type Props = {
  user: User | null;
  projectId: string;
  folderId: string;
  sheetId: string;
  selectedSheet: string;

  sheetData: SheetData | null;
  loading: boolean;
  mapping: SheetMapping | null;
};

function formatDataTypeJa(dataType: DataType | null | undefined): string {
  switch (dataType) {
    case "string":
      return "文字列";
    case "integer":
      return "整数";
    case "decimal":
      return "小数";
    case "phone":
      return "電話番号";
    case "date":
      return "日付";
    case "time":
      return "時刻";
    case "datetime":
      return "日時";
    case "boolean":
      return "真偽値";
    case "unknown":
      return "不明";
    case "number":
      return "数値（旧）";
    default:
      return "-";
  }
}

export default function ValidationTab(props: Props) {
  const { user, projectId, folderId, sheetId, selectedSheet, sheetData, loading, mapping } = props;

  const validationSpecRepo = useMemo(() => createFirestoreValidationSpecRepo(db), [db]);

  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [savedValidationSpec, setSavedValidationSpec] = useState<ValidationSpec | null>(null);
  const [loadingValidationSpec, setLoadingValidationSpec] = useState(false);
  const [loadedValidationSpecId, setLoadedValidationSpecId] = useState<string | null>(null);
  const [editingValidationSpec, setEditingValidationSpec] = useState<ValidationSpec | null>(null);
  const [selectedValidationColKey, setSelectedValidationColKey] = useState<string>("");
  const [showValidationDoneDialog, setShowValidationDoneDialog] = useState(false);

  const loadValidationSpecSeq = useRef(0);

  const baseName = useMemo(() => {
    const raw = (selectedSheet || sheetId || "validation").toString();
    return raw.toLowerCase().endsWith(".csv") ? raw.slice(0, -4) : raw;
  }, [selectedSheet, sheetId]);

  const keyColumnIndex = mapping?.keyColumnIndex ?? 0;
  const keyColumnLabel =
    mapping?.fields?.find((f) => f.columnIndex === keyColumnIndex)?.columnName ?? `col#${keyColumnIndex}`;

  const toAbsoluteRowIndex = useCallback(
    (rowIndex: number): number => {
      const headerRowIndex = mapping?.headerRowIndex ?? 0;
      const dataStartRowIndex = mapping?.dataStartRowIndex ?? headerRowIndex + 1;
      return typeof dataStartRowIndex === "number" && rowIndex < dataStartRowIndex ? dataStartRowIndex + rowIndex : rowIndex;
    },
    [mapping?.dataStartRowIndex, mapping?.headerRowIndex]
  );

  const getKeyValueForIssue = useCallback(
    (rowIndex: number): string => {
      const csv = sheetData?.values;
      if (!csv) return "";

      const headerRowIndex = mapping?.headerRowIndex ?? 0;
      const dataStartRowIndex = mapping?.dataStartRowIndex ?? headerRowIndex + 1;

      const absoluteRowIndex =
        typeof dataStartRowIndex === "number" && rowIndex < dataStartRowIndex ? dataStartRowIndex + rowIndex : rowIndex;

      return (csv[absoluteRowIndex]?.[keyColumnIndex] ?? "").toString();
    },
    [keyColumnIndex, mapping?.dataStartRowIndex, mapping?.headerRowIndex, sheetData?.values]
  );

  const formatIssueForErrorsColumn = useCallback(
    (iss: ValidationResult["issues"][number]): string => {
      const col = iss.ref.colKey ?? `col#${iss.ref.colIndex}`;
      const ruleName = ((iss.ruleName ?? "").toString().trim() || defaultRowRuleName(iss.ruleId)).toString();
      return `${col}:【${ruleName}】 ${iss.message}`;
    },
    []
  );

  const headerRowIndexForValidation = useMemo(() => {
    return (
      editingValidationSpec?.options?.headerRowIndex ??
      savedValidationSpec?.options?.headerRowIndex ??
      mapping?.headerRowIndex ??
      0
    );
  }, [editingValidationSpec?.options?.headerRowIndex, savedValidationSpec?.options?.headerRowIndex, mapping?.headerRowIndex]);

  const getHeaderRowIndexForValidation = useCallback((): number => {
    return headerRowIndexForValidation;
  }, [headerRowIndexForValidation]);

  const sheetHeaderKeys = useMemo((): string[] => {
    const header = sheetData?.values?.[headerRowIndexForValidation] ?? [];
    const keys = header
      .map((v) => (v ?? "").toString().trim())
      .filter((v) => v !== "");
    return Array.from(new Set(keys));
  }, [sheetData?.values, headerRowIndexForValidation]);

  const dataTypeByColKey = useMemo((): Record<string, DataType | null> => {
    const map: Record<string, DataType | null> = {};
    if (!mapping) return map;

    const header = sheetData?.values?.[headerRowIndexForValidation] ?? [];

    for (const key of sheetHeaderKeys) {
      const index = header.findIndex((v) => (v ?? "").toString().trim() === key);
      const byIndex = index >= 0 ? mapping.fields.find((f) => f.columnIndex === index) : undefined;
      const byName = mapping.fields.find((f) => (f.columnName ?? "").toString().trim() === key);
      map[key] = (byIndex ?? byName)?.dataType ?? null;
    }

    return map;
  }, [headerRowIndexForValidation, mapping, sheetData?.values, sheetHeaderKeys]);

  const headerKeysForSettings = useMemo((): string[] => {
    return ["__ALL__", ...sheetHeaderKeys];
  }, [sheetHeaderKeys]);

  const selectedColumnMappingField = useMemo(() => {
    if (!selectedValidationColKey) return undefined;
    if (!mapping) return undefined;

    const header = sheetData?.values?.[headerRowIndexForValidation] ?? [];
    const selectedIndex = header.findIndex((v) => (v ?? "").toString().trim() === selectedValidationColKey);

    if (selectedIndex >= 0) {
      const byIndex = mapping.fields.find((f) => f.columnIndex === selectedIndex);
      if (byIndex) return byIndex;
    }

    const byName = mapping.fields.find((f) => (f.columnName ?? "").toString().trim() === selectedValidationColKey);
    return byName;
  }, [headerRowIndexForValidation, mapping, selectedValidationColKey, sheetData?.values]);

  const selectedColumnDataTypeLabel = useMemo((): string => {
    if (selectedValidationColKey === "__ALL__") return "全体";
    if (!selectedValidationColKey) return "-";
    if (!mapping) return "-";
    return formatDataTypeJa(selectedColumnMappingField?.dataType);
  }, [mapping, selectedColumnMappingField?.dataType, selectedValidationColKey]);

  const selectedColumnDataTypeValue = useMemo((): DataType | null => {
    if (selectedValidationColKey === "__ALL__") return null;
    if (!selectedValidationColKey) return null;
    if (!mapping) return null;
    return selectedColumnMappingField?.dataType ?? null;
  }, [mapping, selectedColumnMappingField?.dataType, selectedValidationColKey]);

  const settingsBoxKey = useMemo(() => {
    if (!selectedValidationColKey) return "__no_col__";
    if (!editingValidationSpec) return `${selectedValidationColKey}:__no_spec__`;

    if (selectedValidationColKey === "__ALL__") {
      // NOTE: __ALL__ は「論理整合性ルール」の編集ブロックをローカル state で保持する。
      // rowRules の変更ごとに remount すると、OFFにしたルールが UI から消える（削除されたように見える）ため、key を安定化する。
      return `__ALL__:${sheetId}:${selectedSheet || "default"}`;
    }

    const col = editingValidationSpec.columns.find((c) => c.colKey === selectedValidationColKey);
    if (!col) return `${selectedValidationColKey}:__no_col_spec__`;
    // spec更新（ロード/保存反映）で確実にremountされるよう、rulesの内容をキーに含める
    return `${selectedValidationColKey}:${JSON.stringify(col.rules)}`;
  }, [editingValidationSpec, selectedValidationColKey, sheetId, selectedSheet]);

  const saveValidationSpec = useCallback(
    async (spec: ValidationSpec) => {
      if (!user) return;
      await validationSpecRepo.save({
        key: { userId: user.uid, projectId, folderId, sheetId },
        specId: selectedSheet || "default",
        spec,
      });
    },
    [user, projectId, folderId, sheetId, selectedSheet, validationSpecRepo]
  );

  const loadValidationSpec = useCallback(async () => {
    if (!user) return;

    const seq = ++loadValidationSpecSeq.current;
    const specId = selectedSheet || "default";

    setLoadingValidationSpec(true);
    try {
      const spec = await validationSpecRepo.get({
        key: { userId: user.uid, projectId, folderId, sheetId },
        specId,
      });
      if (loadValidationSpecSeq.current !== seq) return;
      setSavedValidationSpec(spec);
    } catch (err) {
      console.error("Failed to load validation spec:", err);
      if (loadValidationSpecSeq.current !== seq) return;
      setSavedValidationSpec(null);
    } finally {
      if (loadValidationSpecSeq.current !== seq) return;
      setLoadingValidationSpec(false);
      setLoadedValidationSpecId(specId);
    }
  }, [user, projectId, folderId, sheetId, selectedSheet, validationSpecRepo]);

  useEffect(() => {
    if (!user) return;
    void loadValidationSpec();
  }, [user, loadValidationSpec]);

  const isValidationReady = useMemo((): boolean => {
    if (!user) return true;
    const expectedSpecId = selectedSheet || "default";

    const isSheetDataReady = !!sheetData && Array.isArray(sheetData.values);
    const isSpecReady = loadedValidationSpecId === expectedSpecId && !loadingValidationSpec;

    // NOTE:
    // - mapping.sheetName は過去データで不整合/未設定があり得るため、ここで厳密一致を要求しない。
    // - mapping 自体が無い場合は「ロード中」ではなく「設定不足」として扱う（無限Loading回避）。
    return !loading && isSheetDataReady && isSpecReady;
  }, [loadedValidationSpecId, loading, loadingValidationSpec, mapping, selectedSheet, sheetData, user]);

  useEffect(() => {
    if (!isValidationReady) return;
    // 初回は保存済みspec（無ければ空spec）で編集を開始
    const next =
      savedValidationSpec ??
      ({
        columns: [],
        options: { headerRowIndex: mapping?.headerRowIndex ?? 0 },
      } satisfies ValidationSpec);

    setEditingValidationSpec(next);

    if (headerKeysForSettings.length > 0) {
      setSelectedValidationColKey((prev) =>
        prev && headerKeysForSettings.includes(prev) ? prev : headerKeysForSettings[0]
      );
    }
  }, [isValidationReady, savedValidationSpec, mapping?.headerRowIndex, headerKeysForSettings]);

  const isRequiredEnabledForColumn = useCallback((spec: ValidationSpec | null, colKey: string): boolean => {
    if (!spec) return false;
    const col = spec.columns.find((c) => c.colKey === colKey);
    if (!col) return false;
    return col.rules.some((r) => r.id === "required");
  }, []);

  const isUniqueEnabledForColumn = useCallback((spec: ValidationSpec | null, colKey: string): boolean => {
    if (!spec) return false;
    const col = spec.columns.find((c) => c.colKey === colKey);
    if (!col) return false;
    return col.rules.some((r) => r.id === "unique");
  }, []);

  const isThousandsSeparatorAllowedForColumn = useCallback((spec: ValidationSpec | null, colKey: string): boolean => {
    if (!spec) return true;
    const col = spec.columns.find((c) => c.colKey === colKey);
    if (!col) return true;
    const r = col.rules.find((x) => x.id === "thousandsSeparator") as { id: "thousandsSeparator"; allow: boolean } | undefined;
    return r?.allow ?? true;
  }, []);

  const getPhoneHyphenModeForColumn = useCallback(
    (spec: ValidationSpec | null, colKey: string): "any" | "required" | "forbidden" => {
      if (!spec) return "any";
      const col = spec.columns.find((c) => c.colKey === colKey);
      if (!col) return "any";
      const r = col.rules.find((x) => x.id === "phoneHyphen") as
        | { id: "phoneHyphen"; mode: "required" | "forbidden" }
        | undefined;
      return r?.mode ?? "any";
    },
    []
  );

  const getDateFormatForColumn = useCallback(
    (
      spec: ValidationSpec | null,
      colKey: string
    ): "none" | "strict" | "yyyymmdd" | "yyyy-mm-dd" | "yyyy/mm/dd" | "yyyy年m月d日" => {
      if (!spec) return "none";
      const col = spec.columns.find((c) => c.colKey === colKey);
      if (!col) return "none";
      const r = col.rules.find((x) => x.id === "date") as
        | { id: "date"; format?: "strict" | "yyyymmdd" | "yyyy-mm-dd" | "yyyy/mm/dd" | "yyyy年m月d日" }
        | undefined;
      if (!r) return "none";
      return r.format ?? "strict";
    },
    []
  );

  const getTimeFormatForColumn = useCallback(
    (
      spec: ValidationSpec | null,
      colKey: string
    ): "none" | "strict" | "h:mm" | "hh:mm" | "h:mm:ss" | "hh:mm:ss" => {
    if (!spec) return "none";
    const col = spec.columns.find((c) => c.colKey === colKey);
    if (!col) return "none";
    const r = col.rules.find((x) => x.id === "time") as
      | { id: "time"; format?: "strict" | "h:mm" | "hh:mm" | "h:mm:ss" | "hh:mm:ss" }
      | undefined;
    if (!r) return "none";
    return r.format ?? "strict";
  },
  []
  );

  const getDatetimeFormatForColumn = useCallback(
    (
      spec: ValidationSpec | null,
      colKey: string
    ):
      | "none"
      | "strict"
      | "yyyymmddhhmmss"
      | "yyyy-mm-dd hh:mm"
      | "yyyy-mm-dd hh:mm:ss"
      | "yyyy/mm/dd hh:mm"
      | "yyyy/mm/dd hh:mm:ss"
      | "yyyy年m月d日 hh:mm"
      | "yyyy年m月d日 hh:mm:ss" => {
      if (!spec) return "none";
      const col = spec.columns.find((c) => c.colKey === colKey);
      if (!col) return "none";
      const r = col.rules.find((x) => x.id === "datetime") as
        | {
            id: "datetime";
            format?:
              | "strict"
              | "yyyymmddhhmmss"
              | "yyyy-mm-dd hh:mm"
              | "yyyy-mm-dd hh:mm:ss"
              | "yyyy/mm/dd hh:mm"
              | "yyyy/mm/dd hh:mm:ss"
              | "yyyy年m月d日 hh:mm"
              | "yyyy年m月d日 hh:mm:ss";
          }
        | undefined;
      if (!r) return "none";
      return r.format ?? "strict";
    },
    []
  );

  const {
    updateRequiredForColumn,
    updateUniqueForColumn,
    updateEnumForColumn,
    updateBooleanValuesForColumn,
    updateForbiddenCharsForColumn,
    updateForbiddenCharsForSheet,
    updatePhoneHyphenModeForColumn,
    updatePhoneDigitsMinLengthForColumn,
    updatePhoneDigitsMaxLengthForColumn,
    updateThousandsSeparatorAllowedForColumn,
    updateMinValueForColumn,
    updateMaxValueForColumn,
    updateMinLengthForColumn,
    updateMaxLengthForColumn,
    updatePatternForColumn,
    updateDateFormatForColumn,
    updateTimeFormatForColumn,
    updateDatetimeFormatForColumn,
    stageRowRules,
  } = useValidationSpecEditor({
    editingValidationSpec,
    setEditingValidationSpec: (spec) => setEditingValidationSpec(spec),
    savedValidationSpec,
    mappingHeaderRowIndex: mapping?.headerRowIndex,
    getHeaderRowIndexForValidation,
    saveValidationSpec,
    loadValidationSpec,
  });

  const handleValidate = async () => {
    if (!mapping) {
      alert("バリデーションを実行するにはマッピング設定が必要です");
      return;
    }
    if (!sheetData?.values || sheetData.values.length === 0) {
      alert("シートデータがありません");
      return;
    }

    setIsValidating(true);
    try {
      let specToUse: ValidationSpec | null = editingValidationSpec ?? savedValidationSpec;
      if (!specToUse) {
        specToUse = {
          columns: [],
          options: {
            headerRowIndex: mapping?.headerRowIndex ?? 0,
            errorColumnKey: "__errors",
            joinMessagesWith: "; ",
            includeWarningsInErrorColumn: false,
          },
        };
        setEditingValidationSpec(specToUse);
      }

      // denyTuple は編集時点では保存せず、「バリデーション実行」時にまとめて保存する。
      // 保存に失敗してもバリデーション自体は続行する。
      try {
        await saveValidationSpec(specToUse);
        void loadValidationSpec();
      } catch (e) {
        console.error("Failed to persist validation spec on validate:", e);
      }

      const headerRowIndex = specToUse.options?.headerRowIndex ?? mapping?.headerRowIndex ?? 0;
      const dataStartRowIndex = mapping?.dataStartRowIndex ?? headerRowIndex + 1;

      const header = sheetData.values[headerRowIndex] ?? [];
      const { runtimeSpec, headerIndex } = buildRuntimeValidationSpec({
        baseSpec: specToUse,
        mapping,
        headerRow: header,
      });

      const { dataRows, rowObjects } = toRowObjects({
        sheetValues: sheetData.values,
        dataStartRowIndex,
        runtimeSpec,
        headerIndex,
      });

      const result = validateSheetData(rowObjects, runtimeSpec);
      setValidationResult(result);

      if (user) {
        try {
          const sheetRef = doc(db, "users", user.uid, "projects", projectId, "folders", folderId, "sheets", sheetId);
          await setDoc(
            sheetRef,
            {
              lastValidatedAt: Timestamp.now(),
              lastValidationTotalRows: result.stats.totalRows,
              lastValidationErrorRows: result.stats.errorRowCount,
            },
            { merge: true }
          );
        } catch (e) {
          console.error("Failed to persist validation stats:", e);
        }
      }

      setShowValidationDoneDialog(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownloadIssuesCsv = useCallback((): void => {
    if (!validationResult) return;

    const header: string[] = [
      "種別",
      `キー(${keyColumnLabel})`,
      "カラム",
      "コード",
      "ルールID",
      "ルール名",
      "内容",
      "値",
      "条件カラム",
      "条件値",
      "エラーカラム",
      "エラー値",
      "rowIndex",
      "colIndex",
    ];

    const rows: string[][] = [header];

    for (const iss of validationResult.issues) {
      const key = getKeyValueForIssue(iss.ref.rowIndex) || "";
      const conditionCol = iss.related?.condition?.ref.colKey ?? "";
      const conditionVal = iss.related?.condition ? formatIssueValue(iss.related.condition.value) : "";
      const errorCol = iss.ref.colKey ?? `col#${iss.ref.colIndex}`;
      const errorVal = formatIssueValue(iss.value);

      rows.push([
        iss.severity === "error" ? "エラー" : "警告",
        key,
        iss.related?.condition?.ref.colKey ? `条件:${conditionCol} / エラー:${errorCol}` : errorCol,
        iss.code,
        iss.ruleId,
        (iss.ruleName ?? "").toString(),
        iss.message,
        iss.related?.condition ? `条件:${conditionVal} / エラー:${errorVal}` : errorVal,
        conditionCol,
        conditionVal,
        errorCol,
        errorVal,
        String(iss.ref.rowIndex),
        String(iss.ref.colIndex),
      ]);
    }

    const text = toCsvText(rows);
    downloadTextAsFile(`${baseName}_issues.csv`, text, "text/csv;charset=utf-8");
  }, [baseName, getKeyValueForIssue, keyColumnLabel, validationResult]);

  const handleDownloadWithErrorsColumn = useCallback((): void => {
    const csv = sheetData?.values;
    if (!csv || csv.length === 0) return;
    if (!validationResult) return;

    const rows: string[][] = csv.map((r) => [...(r ?? []).map((v) => (v ?? "").toString()), ""]);

    const headerRowIndex = headerRowIndexForValidation;
    if (headerRowIndex >= 0 && headerRowIndex < rows.length) {
      rows[headerRowIndex]![rows[headerRowIndex]!.length - 1] = "errors";
    } else if (rows.length > 0) {
      rows[0]![rows[0]!.length - 1] = "errors";
    }

    const byRow = new Map<number, string[]>();
    for (const iss of validationResult.issues) {
      if (iss.severity !== "error") continue;
      const absoluteRowIndex = toAbsoluteRowIndex(iss.ref.rowIndex);
      const list = byRow.get(absoluteRowIndex) ?? [];
      list.push(formatIssueForErrorsColumn(iss));
      byRow.set(absoluteRowIndex, list);
    }

    for (const [rowIndex, issues] of byRow.entries()) {
      if (rowIndex < 0 || rowIndex >= rows.length) continue;
      rows[rowIndex]![rows[rowIndex]!.length - 1] = issues.join("; ");
    }

    const text = toCsvText(rows);
    downloadTextAsFile(`${baseName}_with_errors.csv`, text, "text/csv;charset=utf-8");
  }, [baseName, formatIssueForErrorsColumn, headerRowIndexForValidation, sheetData?.values, toAbsoluteRowIndex, validationResult]);

  return (
    <>
      <InfoDialog
        open={showValidationDoneDialog}
        title="完了"
        message="バリデーションが完了しました"
        onClose={() => setShowValidationDoneDialog(false)}
      />

      {!isValidationReady ? (
        <Loading message="バリデーション情報を読み込み中..." />
      ) : (
        <div className="space-y-6">
          <div className="p-6 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
            <h2 className="text-lg font-semibold mb-3">バリデーション</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              保存済みのバリデーション設定（spec）に従ってチェックします。
            </p>

          {!mapping && (
            <p className="text-sm text-orange-600 dark:text-orange-400 mb-4">
              ⚠️ バリデーションを実行するにはマッピング設定が必要です。先に「マッピング設定」タブで設定してください。
            </p>
          )}

          {editingValidationSpec && (
            <ValidationSettingsBox
              key={settingsBoxKey}
              selectedColKey={selectedValidationColKey}
              setSelectedColKey={setSelectedValidationColKey}
              headerKeys={headerKeysForSettings}
              dataHeaderKeys={sheetHeaderKeys}
              dataTypeByColKey={dataTypeByColKey}
              loading={loadingValidationSpec}
              editingSpec={editingValidationSpec}
              dataType={selectedColumnDataTypeValue}
              dataTypeLabel={selectedColumnDataTypeLabel}
              requiredEnabled={isRequiredEnabledForColumn(editingValidationSpec, selectedValidationColKey)}
              onToggleRequired={(enabled) => void updateRequiredForColumn(selectedValidationColKey, enabled)}
              uniqueEnabled={isUniqueEnabledForColumn(editingValidationSpec, selectedValidationColKey)}
              onToggleUnique={(enabled) => void updateUniqueForColumn(selectedValidationColKey, enabled)}
              thousandsSeparatorAllowed={isThousandsSeparatorAllowedForColumn(editingValidationSpec, selectedValidationColKey)}
              onToggleThousandsSeparatorAllowed={(allowed) =>
                void updateThousandsSeparatorAllowedForColumn(selectedValidationColKey, allowed)
              }
              phoneHyphenMode={getPhoneHyphenModeForColumn(editingValidationSpec, selectedValidationColKey)}
              onChangePhoneHyphenMode={(mode) => void updatePhoneHyphenModeForColumn(selectedValidationColKey, mode)}
              dateFormat={getDateFormatForColumn(editingValidationSpec, selectedValidationColKey)}
              onChangeDateFormat={(format) => void updateDateFormatForColumn(selectedValidationColKey, format)}
              timeFormat={getTimeFormatForColumn(editingValidationSpec, selectedValidationColKey)}
              onChangeTimeFormat={(format) => void updateTimeFormatForColumn(selectedValidationColKey, format)}
              datetimeFormat={getDatetimeFormatForColumn(editingValidationSpec, selectedValidationColKey)}
              onChangeDatetimeFormat={(format) => void updateDatetimeFormatForColumn(selectedValidationColKey, format)}
              onUpdateBooleanValues={(enabled, trueValue, falseValue) =>
                void updateBooleanValuesForColumn(selectedValidationColKey, enabled, trueValue, falseValue)
              }
              onUpdatePhoneDigitsMinLength={(enabled, value) =>
                void updatePhoneDigitsMinLengthForColumn(selectedValidationColKey, enabled, value)
              }
              onUpdatePhoneDigitsMaxLength={(enabled, value) =>
                void updatePhoneDigitsMaxLengthForColumn(selectedValidationColKey, enabled, value)
              }
              onUpdateEnum={(enabled, values) => void updateEnumForColumn(selectedValidationColKey, enabled, values)}
              onUpdateForbiddenChars={(enabled, chars) =>
                void updateForbiddenCharsForColumn(selectedValidationColKey, enabled, chars)
              }
              onUpdateSheetForbiddenChars={(enabled, chars) => void updateForbiddenCharsForSheet(enabled, chars)}
              onUpdateMinValue={(enabled, value) => void updateMinValueForColumn(selectedValidationColKey, enabled, value)}
              onUpdateMaxValue={(enabled, value) => void updateMaxValueForColumn(selectedValidationColKey, enabled, value)}
              onUpdateMinLength={(enabled, value) => void updateMinLengthForColumn(selectedValidationColKey, enabled, value)}
              onUpdateMaxLength={(enabled, value) => void updateMaxLengthForColumn(selectedValidationColKey, enabled, value)}
              onUpdatePattern={(enabled, pattern) => void updatePatternForColumn(selectedValidationColKey, enabled, pattern)}
              onUpdateRowRules={(rowRules) => stageRowRules(rowRules)}
            />
          )}

          <button
            onClick={handleValidate}
            disabled={isValidating || !mapping}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? "実行中..." : "バリデーション実行"}
          </button>
          </div>

          {validationResult && (
            <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg">
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              errors: {validationResult.stats.errorCount.toLocaleString()} / warnings: {validationResult.stats.warningCount.toLocaleString()} / issues:{" "}
              {validationResult.stats.issueCount.toLocaleString()}
            </div>

            <div className="text-xs text-neutral-500 mb-3">
              issues一覧（先頭{MAX_ISSUES_PREVIEW.toLocaleString()}件まで表示）
            </div>

            <div className="space-y-3">
              {validationResult.issues.length === 0 ? (
                <div className="p-6 text-center text-neutral-600 dark:text-neutral-400">issuesはありませんでした</div>
              ) : (
                <div className="overflow-auto max-h-[520px] border border-neutral-200 dark:border-neutral-800 rounded">
                  <table className="min-w-full text-xs">
                    <thead className="bg-neutral-50 dark:bg-neutral-950 sticky top-0">
                      <tr>
                        <th className="text-left font-semibold px-2 py-2 border-b border-neutral-200 dark:border-neutral-800 whitespace-nowrap">
                          種別
                        </th>
                        <th className="text-left font-semibold px-2 py-2 border-b border-neutral-200 dark:border-neutral-800 whitespace-nowrap">
                          キー（{keyColumnLabel}）
                        </th>
                        <th className="text-left font-semibold px-2 py-2 border-b border-neutral-200 dark:border-neutral-800 whitespace-nowrap">
                          カラム
                        </th>
                        <th className="text-left font-semibold px-2 py-2 border-b border-neutral-200 dark:border-neutral-800 whitespace-nowrap">
                          コード
                        </th>
                        <th className="text-left font-semibold px-2 py-2 border-b border-neutral-200 dark:border-neutral-800">
                          内容
                        </th>
                        <th className="text-left font-semibold px-2 py-2 border-b border-neutral-200 dark:border-neutral-800">
                          値
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResult.issues.slice(0, MAX_ISSUES_PREVIEW).map((iss, idx) => {
                        const key = getKeyValueForIssue(iss.ref.rowIndex) || "";
                        const conditionCol = iss.related?.condition?.ref.colKey ?? "";
                        const conditionVal = iss.related?.condition ? formatIssueValue(iss.related.condition.value) : "";
                        const errorCol = iss.ref.colKey ?? `col#${iss.ref.colIndex}`;
                        const errorVal = formatIssueValue(iss.value);

                        return (
                          <tr
                            key={idx}
                            className="odd:bg-white even:bg-neutral-50 dark:odd:bg-neutral-900 dark:even:bg-neutral-950"
                          >
                            <td className="px-2 py-1 border-b border-neutral-100 dark:border-neutral-800 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                                  iss.severity === "error"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                                }`}
                              >
                                {iss.severity === "error" ? "エラー" : "警告"}
                              </span>
                            </td>
                            <td className="px-2 py-1 border-b border-neutral-100 dark:border-neutral-800 whitespace-nowrap max-w-[240px] truncate" title={key}>
                              {key || "(空)"}
                            </td>
                            <td className="px-2 py-1 border-b border-neutral-100 dark:border-neutral-800 whitespace-nowrap max-w-[320px]">
                              {conditionCol ? (
                                <div className="min-w-[260px]">
                                  <div className="whitespace-nowrap truncate">条件: {conditionCol}</div>
                                  <div className="whitespace-nowrap truncate">エラー: {errorCol}</div>
                                </div>
                              ) : (
                                <div className="whitespace-nowrap truncate">{errorCol}</div>
                              )}
                            </td>
                            <td className="px-2 py-1 border-b border-neutral-100 dark:border-neutral-800 whitespace-nowrap">
                              {iss.code}
                            </td>
                            <td className="px-2 py-1 border-b border-neutral-100 dark:border-neutral-800 min-w-[280px]">
                              {isRowRuleIssue(iss.ruleId)
                                ? `【${(iss.ruleName ?? "").toString().trim() || defaultRowRuleName(iss.ruleId)}】 ${iss.message}`
                                : iss.message}
                            </td>
                            <td className="px-2 py-1 border-b border-neutral-100 dark:border-neutral-800 whitespace-nowrap max-w-[320px]">
                              {conditionCol ? (
                                <div className="min-w-[260px]">
                                  <div className="whitespace-nowrap truncate">条件: {conditionVal || "(空)"}</div>
                                  <div className="whitespace-nowrap truncate">エラー: {errorVal || "(空)"}</div>
                                </div>
                              ) : (
                                <div className="whitespace-nowrap truncate">{errorVal}</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border border-neutral-200 dark:border-neutral-800 rounded p-3 bg-neutral-50 dark:bg-neutral-950">
                <div className="text-sm font-semibold mb-2">ダウンロード</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 text-sm font-semibold disabled:opacity-50"
                    disabled={!validationResult || !sheetData?.values}
                    onClick={() => handleDownloadWithErrorsColumn()}
                  >
                    errors列付加 CSV
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 text-sm font-semibold disabled:opacity-50"
                    disabled={!validationResult}
                    onClick={() => handleDownloadIssuesCsv()}
                  >
                    issues CSV
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
