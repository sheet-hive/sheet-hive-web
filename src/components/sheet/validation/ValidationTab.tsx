"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { Timestamp, doc, setDoc } from "firebase/firestore";

import InfoDialog from "@/components/common/InfoDialog";
import DataGrid from "@/components/sheet/DataGrid";
import ValidationSettingsBox from "@/components/sheet/validation/ValidationSettingsBox";
import { db } from "@/lib/firebase";
import { createFirestoreValidationSpecRepo } from "@/lib/repos";
import { buildErrorRowsForGrid, buildRuntimeValidationSpec, toRowObjects } from "@/lib/validationRuntime";
import type { DataType, SheetMapping } from "@/models/mapping";
import type { SheetData } from "@/lib/sheets";
import { useValidationSpecEditor } from "@/hooks/useValidationSpecEditor";
import { validateSheetData, type ValidationResult, type ValidationSpec } from "@shared/mapping";

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
  const [validationErrorRows, setValidationErrorRows] = useState<string[][]>([]);
  const [savedValidationSpec, setSavedValidationSpec] = useState<ValidationSpec | null>(null);
  const [loadingValidationSpec, setLoadingValidationSpec] = useState(false);
  const [editingValidationSpec, setEditingValidationSpec] = useState<ValidationSpec | null>(null);
  const [selectedValidationColKey, setSelectedValidationColKey] = useState<string>("");
  const [showValidationDoneDialog, setShowValidationDoneDialog] = useState(false);

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
    setLoadingValidationSpec(true);
    try {
      const spec = await validationSpecRepo.get({
        key: { userId: user.uid, projectId, folderId, sheetId },
        specId: selectedSheet || "default",
      });
      setSavedValidationSpec(spec);
    } catch (err) {
      console.error("Failed to load validation spec:", err);
      setSavedValidationSpec(null);
    } finally {
      setLoadingValidationSpec(false);
    }
  }, [user, projectId, folderId, sheetId, selectedSheet, validationSpecRepo]);

  useEffect(() => {
    if (!user) return;
    void loadValidationSpec();
  }, [user, loadValidationSpec]);

  useEffect(() => {
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
  }, [savedValidationSpec, mapping?.headerRowIndex, headerKeysForSettings]);

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

      setValidationErrorRows(
        buildErrorRowsForGrid({
          headerRow: header,
          dataRows,
          result,
          options: runtimeSpec.options,
        })
      );

      setShowValidationDoneDialog(true);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <>
      <InfoDialog
        open={showValidationDoneDialog}
        title="完了"
        message="バリデーションが完了しました"
        onClose={() => setShowValidationDoneDialog(false)}
      />

      <div className="space-y-6">
        <div className="p-6 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">バリデーション</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            保存済みのバリデーション設定（spec）に従ってチェックします。
          </p>

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
            disabled={isValidating}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? "実行中..." : "バリデーション実行"}
          </button>
        </div>

        {validationResult && (
          <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg">
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              エラー行数: {validationResult.stats.errorRowCount.toLocaleString()} 行
            </div>
            {validationResult.stats.errorRowCount === 0 ? (
              <div className="p-6 text-center text-neutral-600 dark:text-neutral-400">エラーはありませんでした</div>
            ) : (
              <DataGrid data={validationErrorRows} loading={loading || isValidating} />
            )}
          </div>
        )}
      </div>
    </>
  );
}
