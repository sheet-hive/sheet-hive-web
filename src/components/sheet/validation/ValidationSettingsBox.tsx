import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import SettingsBox from "@/components/common/SettingsBox";
import RuleToggleLinesTextArea from "@/components/sheet/validation/inputs/RuleToggleLinesTextArea";
import RuleToggleNumberInput from "@/components/sheet/validation/inputs/RuleToggleNumberInput";
import RuleToggleTextInput from "@/components/sheet/validation/inputs/RuleToggleTextInput";
import SelectField from "@/components/sheet/validation/inputs/SelectField";
import TextField from "@/components/sheet/validation/inputs/TextField";
import ToggleRow from "@/components/sheet/validation/inputs/ToggleRow";
import type { DataType } from "@/models/mapping";
import type { RowRule, ValidationSpec } from "@shared/mapping";

type Props = {
  selectedColKey: string;
  setSelectedColKey: (colKey: string) => void;
  headerKeys: string[];
  dataHeaderKeys: string[];
  dataTypeByColKey?: Record<string, DataType | null>;

  loading: boolean;

  editingSpec: ValidationSpec | null;

  dataType: DataType | null;
  dataTypeLabel: string;
  requiredEnabled: boolean;
  onToggleRequired: (enabled: boolean) => void;

  uniqueEnabled: boolean;
  onToggleUnique: (enabled: boolean) => void;

  thousandsSeparatorAllowed: boolean;
  onToggleThousandsSeparatorAllowed: (allowed: boolean) => void;

  phoneHyphenMode: "any" | "required" | "forbidden";
  onChangePhoneHyphenMode: (mode: "any" | "required" | "forbidden") => void;

  dateFormat: "none" | "strict" | "yyyymmdd" | "yyyy-mm-dd" | "yyyy/mm/dd" | "yyyy年m月d日";
  onChangeDateFormat: (format: Props["dateFormat"]) => void;

  timeFormat: "none" | "strict" | "h:mm" | "hh:mm" | "h:mm:ss" | "hh:mm:ss";
  onChangeTimeFormat: (format: Props["timeFormat"]) => void;

  datetimeFormat:
    | "none"
    | "strict"
    | "yyyymmddhhmmss"
    | "yyyy-mm-dd hh:mm"
    | "yyyy-mm-dd hh:mm:ss"
    | "yyyy/mm/dd hh:mm"
    | "yyyy/mm/dd hh:mm:ss"
    | "yyyy年m月d日 hh:mm"
    | "yyyy年m月d日 hh:mm:ss";
  onChangeDatetimeFormat: (format: Props["datetimeFormat"]) => void;

  onUpdateBooleanValues: (enabled: boolean, trueValue: string, falseValue: string) => void;

  onUpdatePhoneDigitsMinLength: (enabled: boolean, value: number | null) => void;
  onUpdatePhoneDigitsMaxLength: (enabled: boolean, value: number | null) => void;

  onUpdateEnum: (enabled: boolean, values: string[]) => void;
  onUpdateForbiddenChars: (enabled: boolean, chars: string[]) => void;
  onUpdateSheetForbiddenChars: (enabled: boolean, chars: string[]) => void;
  onUpdateMinValue: (enabled: boolean, value: number | null) => void;
  onUpdateMaxValue: (enabled: boolean, value: number | null) => void;
  onUpdateMinLength: (enabled: boolean, value: number | null) => void;
  onUpdateMaxLength: (enabled: boolean, value: number | null) => void;
  onUpdatePattern: (enabled: boolean, pattern: string) => void;
  onUpdateRowRules: (rowRules: ValidationSpec["rowRules"]) => void;
};

type SettingKey =
  | "required"
  | "unique"
  | "booleanValues"
  | "sheetForbiddenChars"
  | "enum"
  | "thousandsSeparator"
  | "dateFormat"
  | "timeFormat"
  | "datetimeFormat"
  | "phoneHyphen"
  | "phoneDigitsMinLength"
  | "phoneDigitsMaxLength"
  | "forbiddenChars"
  | "minValue"
  | "maxValue"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "logicRules";

function getVisibleSettingsByDataType(dataType: DataType | null): Set<SettingKey> {
  // mapping が無い/不明な場合は従来どおり全部見せて編集できるようにする
  const t = dataType ?? "unknown";

  // NOTE: ここは「仕組み」のための初期マッピング。
  // 一意/最小値/最大値/禁止文字…など新項目を追加するときに段階的に拡張する。
  switch (t) {
    case "integer":
    case "decimal":
      return new Set<SettingKey>(["required", "unique", "enum", "thousandsSeparator", "minValue", "maxValue"]);
    case "phone":
      return new Set<SettingKey>([
        "required",
        "unique",
        "phoneHyphen",
        "phoneDigitsMinLength",
        "phoneDigitsMaxLength",
        "pattern",
      ]);
    case "date":
      return new Set<SettingKey>(["required", "unique", "dateFormat", "pattern"]);
    case "time":
      return new Set<SettingKey>(["required", "unique", "timeFormat", "pattern"]);
    case "datetime":
      return new Set<SettingKey>(["required", "unique", "datetimeFormat", "pattern"]);
    case "boolean":
      return new Set<SettingKey>(["required", "booleanValues"]);
    case "string":
      return new Set<SettingKey>(["required", "unique", "forbiddenChars", "enum", "minLength", "maxLength", "pattern"]);
    case "unknown":
    case "number":
    default:
      return new Set<SettingKey>(["required", "unique", "enum", "minLength", "maxLength", "pattern"]);
  }
}

function readRule<T extends { id: string }>(spec: ValidationSpec | null, colKey: string, id: T["id"]): T | null {
  if (!spec || !colKey) return null;
  const col = spec.columns.find((c) => c.colKey === colKey);
  if (!col) return null;
  const r = col.rules.find((x) => x.id === id);
  return (r as T | undefined) ?? null;
}

function readSheetRule<T extends { id: string }>(spec: ValidationSpec | null, id: T["id"]): T | null {
  if (!spec) return null;
  const r = spec.sheetRules?.find((x) => x.id === id);
  return (r as T | undefined) ?? null;
}

const GLOBAL_COL_KEY = "__ALL__";

export default function ValidationSettingsBox(props: Props) {
  const {
    selectedColKey,
    setSelectedColKey,
    headerKeys,
    dataHeaderKeys,
    dataTypeByColKey = {},
    loading,
    editingSpec,
    dataType,
    dataTypeLabel,
    requiredEnabled,
    onToggleRequired,
    uniqueEnabled,
    onToggleUnique,
    thousandsSeparatorAllowed,
    onToggleThousandsSeparatorAllowed,
    phoneHyphenMode,
    onChangePhoneHyphenMode,
    dateFormat,
    onChangeDateFormat,
    timeFormat,
    onChangeTimeFormat,
    datetimeFormat,
    onChangeDatetimeFormat,
    onUpdateBooleanValues,
    onUpdatePhoneDigitsMinLength,
    onUpdatePhoneDigitsMaxLength,
    onUpdateEnum,
    onUpdateForbiddenChars,
    onUpdateSheetForbiddenChars,
    onUpdateMinValue,
    onUpdateMaxValue,
    onUpdateMinLength,
    onUpdateMaxLength,
    onUpdatePattern,
    onUpdateRowRules,
  } = props;

  const isGlobalSelected = selectedColKey === GLOBAL_COL_KEY;

  const visibleSettings = useMemo(() => {
    if (isGlobalSelected) return new Set<SettingKey>(["sheetForbiddenChars", "logicRules"]);
    return getVisibleSettingsByDataType(dataType);
  }, [dataType, isGlobalSelected]);

  const show = useMemo(() => {
    return (key: SettingKey) => visibleSettings.has(key);
  }, [visibleSettings]);

  const minMaxValueInput = useMemo(() => {
    const step: number | "any" = dataType === "integer" ? 1 : "any";
    const exampleMin = dataType === "integer" ? "例: 0" : "例: 0.5";
    const exampleMax = dataType === "integer" ? "例: 100" : "例: 99.9";
    return { step, exampleMin, exampleMax };
  }, [dataType]);

  const initialRules = useMemo(() => {
    const sheetForbiddenChars = readSheetRule<{ id: "forbiddenChars"; chars: string[] }>(editingSpec, "forbiddenChars");
    const booleanValues = readRule<
      ({ id: "boolean"; trueValue: string; falseValue: string } | { id: "boolean"; trueValues: string[]; falseValues: string[] })
    >(
      editingSpec,
      selectedColKey,
      "boolean"
    );
    const forbiddenChars = readRule<{ id: "forbiddenChars"; chars: string[] }>(
      editingSpec,
      selectedColKey,
      "forbiddenChars"
    );
    const enumRule = readRule<{ id: "enum"; values: string[] }>(editingSpec, selectedColKey, "enum");
    const phoneDigitsMin = readRule<{ id: "phoneDigitsMinLength"; value: number }>(
      editingSpec,
      selectedColKey,
      "phoneDigitsMinLength"
    );
    const phoneDigitsMax = readRule<{ id: "phoneDigitsMaxLength"; value: number }>(
      editingSpec,
      selectedColKey,
      "phoneDigitsMaxLength"
    );
    const minValue = readRule<{ id: "minValue"; value: number }>(editingSpec, selectedColKey, "minValue");
    const maxValue = readRule<{ id: "maxValue"; value: number }>(editingSpec, selectedColKey, "maxValue");
    const minLength = readRule<{ id: "minLength"; value: number }>(editingSpec, selectedColKey, "minLength");
    const maxLength = readRule<{ id: "maxLength"; value: number }>(editingSpec, selectedColKey, "maxLength");
    const pattern = readRule<{ id: "pattern"; pattern: string }>(editingSpec, selectedColKey, "pattern");

    return {
      sheetForbiddenChars,
      booleanValues,
      forbiddenChars,
      enumRule,
      phoneDigitsMin,
      phoneDigitsMax,
      minValue,
      maxValue,
      minLength,
      maxLength,
      pattern,
    };
  }, [editingSpec, selectedColKey]);

  const [sheetForbiddenCharsEnabled, setSheetForbiddenCharsEnabled] = useState(() => !!initialRules.sheetForbiddenChars);
  const [sheetForbiddenCharsText, setSheetForbiddenCharsText] = useState(() =>
    initialRules.sheetForbiddenChars ? initialRules.sheetForbiddenChars.chars.join("\n") : ""
  );

  const [booleanValuesEnabled, setBooleanValuesEnabled] = useState(() => !!initialRules.booleanValues);
  const initialBooleanTrueValue = useMemo(() => {
    const r = initialRules.booleanValues as
      | { id: "boolean"; trueValue: string; falseValue: string }
      | { id: "boolean"; trueValues: string[]; falseValues: string[] }
      | null;
    if (!r) return "";
    if ("trueValue" in r && typeof r.trueValue === "string") return r.trueValue;
    if ("trueValues" in r && Array.isArray(r.trueValues)) return r.trueValues.find((v) => v.trim() !== "") ?? "";
    return "";
  }, [initialRules.booleanValues]);

  const initialBooleanFalseValue = useMemo(() => {
    const r = initialRules.booleanValues as
      | { id: "boolean"; trueValue: string; falseValue: string }
      | { id: "boolean"; trueValues: string[]; falseValues: string[] }
      | null;
    if (!r) return "";
    if ("falseValue" in r && typeof r.falseValue === "string") return r.falseValue;
    if ("falseValues" in r && Array.isArray(r.falseValues)) return r.falseValues.find((v) => v.trim() !== "") ?? "";
    return "";
  }, [initialRules.booleanValues]);

  const [booleanTrueValueText, setBooleanTrueValueText] = useState(() => initialBooleanTrueValue);
  const [booleanFalseValueText, setBooleanFalseValueText] = useState(() => initialBooleanFalseValue);

  const [forbiddenCharsEnabled, setForbiddenCharsEnabled] = useState(() => !!initialRules.forbiddenChars);
  const [forbiddenCharsText, setForbiddenCharsText] = useState(() =>
    initialRules.forbiddenChars ? initialRules.forbiddenChars.chars.join("\n") : ""
  );
  const [enumEnabled, setEnumEnabled] = useState(() => !!initialRules.enumRule);
  const [enumValuesText, setEnumValuesText] = useState(() =>
    initialRules.enumRule ? initialRules.enumRule.values.join("\n") : ""
  );
  const [phoneDigitsMinEnabled, setPhoneDigitsMinEnabled] = useState(() => !!initialRules.phoneDigitsMin);
  const [phoneDigitsMinText, setPhoneDigitsMinText] = useState(() =>
    initialRules.phoneDigitsMin ? String(initialRules.phoneDigitsMin.value) : ""
  );
  const [phoneDigitsMaxEnabled, setPhoneDigitsMaxEnabled] = useState(() => !!initialRules.phoneDigitsMax);
  const [phoneDigitsMaxText, setPhoneDigitsMaxText] = useState(() =>
    initialRules.phoneDigitsMax ? String(initialRules.phoneDigitsMax.value) : ""
  );
  const [minValueEnabled, setMinValueEnabled] = useState(() => !!initialRules.minValue);
  const [minValueText, setMinValueText] = useState(() =>
    initialRules.minValue ? String(initialRules.minValue.value) : ""
  );
  const [maxValueEnabled, setMaxValueEnabled] = useState(() => !!initialRules.maxValue);
  const [maxValueText, setMaxValueText] = useState(() =>
    initialRules.maxValue ? String(initialRules.maxValue.value) : ""
  );
  const [minLengthEnabled, setMinLengthEnabled] = useState(() => !!initialRules.minLength);
  const [minLengthText, setMinLengthText] = useState(() =>
    initialRules.minLength ? String(initialRules.minLength.value) : ""
  );
  const [maxLengthEnabled, setMaxLengthEnabled] = useState(() => !!initialRules.maxLength);
  const [maxLengthText, setMaxLengthText] = useState(() =>
    initialRules.maxLength ? String(initialRules.maxLength.value) : ""
  );
  const [patternEnabled, setPatternEnabled] = useState(() => !!initialRules.pattern);
  const [patternText, setPatternText] = useState(() => (initialRules.pattern ? initialRules.pattern.pattern : ""));

  // パターン選択は残すが「禁止組み合わせ（denyTuple）」は廃止（条件付き禁止に統一）
  type LogicRulePattern =
    | "disallowWhen"
    | "allowWhen"
    | "requireWhen"
    | "numberRelation"
    | "dateRelation"
    | "timeRelation";

  type RequireWhenConditionMode = "isNull" | "isNotNull" | "equals";
  type NumberCompareOp = "eq" | "lt" | "gt" | "lte" | "gte";
  type DateRelationOp = "before" | "after" | "onOrBefore" | "onOrAfter";
  type TimeRelationOp = DateRelationOp;
  type LogicRuleBlock = {
    blockId: string;
    enabled: boolean;
    pattern: LogicRulePattern;
    name: string;
    conditionMode?: RequireWhenConditionMode;
    compareOp?: NumberCompareOp | DateRelationOp | TimeRelationOp;
    leftKey: string;
    leftValue: string;
    rightKey: string;
    rightValue: string;
  };

  const numericHeaderKeys = useMemo(() => {
    return dataHeaderKeys.filter((k) => {
      const dt = dataTypeByColKey?.[k] ?? null;
      return dt === "integer" || dt === "decimal" || dt === "number";
    });
  }, [dataHeaderKeys, dataTypeByColKey]);

  const dateHeaderKeys = useMemo(() => {
    return dataHeaderKeys.filter((k) => {
      const dt = dataTypeByColKey?.[k] ?? null;
      return dt === "date" || dt === "datetime";
    });
  }, [dataHeaderKeys, dataTypeByColKey]);

  const timeHeaderKeys = useMemo(() => {
    return dataHeaderKeys.filter((k) => {
      const dt = dataTypeByColKey?.[k] ?? null;
      return dt === "time";
    });
  }, [dataHeaderKeys, dataTypeByColKey]);

  const makeBlockId = useCallback((): string => {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

  const buildLogicRuleBlocksFromRowRules = useCallback(
    (rowRules: RowRule[]): LogicRuleBlock[] => {
      const blocks: LogicRuleBlock[] = [];

      for (const r of rowRules) {
        const ruleName = ((r as unknown as { name?: unknown }).name ?? "").toString();
        const ruleEnabled = (r as unknown as { enabled?: boolean }).enabled !== false;

        if (r.id === "denyTuple") {
          const entries =
            "entries" in r && Array.isArray(r.entries)
              ? r.entries
              : Array.isArray((r as { keys?: string[]; deniedTuples?: string[][] }).keys)
                ? [
                    {
                      keys: (r as { keys: string[] }).keys,
                      deniedTuples: (r as { deniedTuples?: string[][] }).deniedTuples ?? [],
                    },
                  ]
                : [];

          for (const e of entries) {
            if (!e || !Array.isArray(e.keys) || e.keys.length !== 2) continue;
            const [leftKey, rightKey] = e.keys;
            for (const tuple of e.deniedTuples ?? []) {
              if (!Array.isArray(tuple) || tuple.length !== 2) continue;
              blocks.push({
                blockId: makeBlockId(),
                enabled: ruleEnabled,
                // denyTuple は UI 上は「条件付き禁止」として扱う（支払方法=現金 のとき 請求書種別!=請求書）
                pattern: "disallowWhen",
                name: ruleName,
                leftKey: (leftKey ?? "").toString(),
                rightKey: (rightKey ?? "").toString(),
                leftValue: (tuple[0] ?? "").toString(),
                rightValue: (tuple[1] ?? "").toString(),
              });
            }
          }
        }


        if (r.id === "disallowWhen") {
          if (r.kind !== "notEquals" && r.kind !== "notIn") continue;

          const conditionMode: RequireWhenConditionMode =
            r.when.kind === "blank" ? "isNull" : r.when.kind === "nonBlank" ? "isNotNull" : "equals";

          const compareOp: NumberCompareOp | undefined =
            r.when.kind === "numberCompare" ? (r.when.op as NumberCompareOp) : "eq";

          blocks.push({
            blockId: makeBlockId(),
            enabled: ruleEnabled,
            pattern: "disallowWhen",
            name: ruleName,
            conditionMode,
            compareOp,
            leftKey: (r.when.colKey ?? "").toString(),
            leftValue:
              r.when.kind === "equals"
                ? (r.when.value ?? "").toString()
                : r.when.kind === "numberCompare"
                  ? String(r.when.value)
                  : "",
            rightKey: (r.thenColKey ?? "").toString(),
            rightValue:
              r.kind === "notEquals"
                ? (r.forbiddenValue ?? "").toString()
                : Array.isArray(r.forbiddenValues)
                  ? r.forbiddenValues
                      .map((v) => (v ?? "").toString())
                      .filter((v) => v.trim() !== "")
                      .join(", ")
                  : "",
          });
        }

        if (r.id === "allowWhen") {
          const conditionMode: RequireWhenConditionMode =
            r.when.kind === "blank" ? "isNull" : r.when.kind === "nonBlank" ? "isNotNull" : "equals";

          const compareOp: NumberCompareOp | undefined =
            r.when.kind === "numberCompare" ? (r.when.op as NumberCompareOp) : "eq";

          const allowedText = Array.isArray(r.allowedValues)
            ? r.allowedValues.map((v) => (v ?? "").toString()).filter((v) => v.trim() !== "").join(", ")
            : "";

          blocks.push({
            blockId: makeBlockId(),
            enabled: ruleEnabled,
            pattern: "allowWhen",
            name: ruleName,
            conditionMode,
            compareOp,
            leftKey: (r.when.colKey ?? "").toString(),
            leftValue:
              r.when.kind === "equals"
                ? (r.when.value ?? "").toString()
                : r.when.kind === "numberCompare"
                  ? String(r.when.value)
                  : "",
            rightKey: (r.thenColKey ?? "").toString(),
            rightValue: allowedText,
          });
        }

        if (r.id === "requireWhen") {
          const mode: RequireWhenConditionMode =
            r.when.kind === "blank" ? "isNull" : r.when.kind === "nonBlank" ? "isNotNull" : "equals";

          const compareOp: NumberCompareOp | undefined =
            r.when.kind === "numberCompare" ? (r.when.op as NumberCompareOp) : "eq";

          blocks.push({
            blockId: makeBlockId(),
            enabled: ruleEnabled,
            pattern: "requireWhen",
            name: ruleName,
            conditionMode: mode,
            compareOp,
            leftKey: (r.when.colKey ?? "").toString(),
            leftValue:
              r.when.kind === "equals"
                ? (r.when.value ?? "").toString()
                : r.when.kind === "numberCompare"
                  ? String(r.when.value)
                  : "",
            rightKey: (r.thenRequiredColKey ?? "").toString(),
            rightValue: "",
          });
        }

        if (r.id === "numberRelation") {
          blocks.push({
            blockId: makeBlockId(),
            enabled: ruleEnabled,
            pattern: "numberRelation",
            name: ruleName,
            // UI は compareOp を使って大小関係を表現する
            compareOp: (r.op ?? "gt") as NumberCompareOp,
            leftKey: (r.baseColKey ?? "").toString(),
            leftValue: "",
            rightKey: (r.targetColKey ?? "").toString(),
            rightValue: "",
          });
        }

        if (r.id === "dateRelation") {
          blocks.push({
            blockId: makeBlockId(),
            enabled: ruleEnabled,
            pattern: "dateRelation",
            name: ruleName,
            compareOp: (r.op ?? "after") as DateRelationOp,
            leftKey: (r.baseColKey ?? "").toString(),
            leftValue: "",
            rightKey: (r.targetColKey ?? "").toString(),
            rightValue: "",
          });
        }

        if (r.id === "timeRelation") {
          blocks.push({
            blockId: makeBlockId(),
            enabled: ruleEnabled,
            pattern: "timeRelation",
            name: ruleName,
            compareOp: (r.op ?? "after") as TimeRelationOp,
            leftKey: (r.baseColKey ?? "").toString(),
            leftValue: "",
            rightKey: (r.targetColKey ?? "").toString(),
            rightValue: "",
          });
        }
      }

      return blocks.filter(
        (b) => b.leftKey.trim() !== "" || b.rightKey.trim() !== "" || b.leftValue.trim() !== "" || b.rightValue.trim() !== ""
      );
    },
    [makeBlockId]
  );

  const passthroughRowRules = useMemo((): RowRule[] => {
    if (!editingSpec?.rowRules) return [];
    return editingSpec.rowRules.filter(
      (r) => {
        const id = (r as unknown as { id?: string }).id;
        return (
          id !== "denyTuple" &&
          id !== "allowTuple" &&
          id !== "disallowWhen" &&
          id !== "allowWhen" &&
          id !== "requireWhen" &&
          id !== "numberRelation" &&
          id !== "dateRelation" &&
          id !== "timeRelation"
        );
      }
    );
  }, [editingSpec]);

  const [logicRuleBlocks, setLogicRuleBlocks] = useState<LogicRuleBlock[]>(() => {
    return buildLogicRuleBlocksFromRowRules(editingSpec?.rowRules ?? []);
  });

  const logicRulesDirtyRef = useRef(false);

  // タブ遷移などで editingSpec が後から復帰した場合でも、UI を spec に追従させる。
  // ただしユーザーが UI 上で編集途中（dirty）の場合は上書きしない。
  // NOTE: setState を effect 内で同期的に呼ぶと lint エラーになるため、rAF で遅延する。
  const lastLogicRulesSyncKeyRef = useRef<string>("");
  useLayoutEffect(() => {
    if (!show("logicRules")) return;
    if (logicRulesDirtyRef.current) return;

    const rowRules = editingSpec?.rowRules ?? [];
    const syncKey = JSON.stringify(rowRules);
    if (lastLogicRulesSyncKeyRef.current === syncKey) return;
    lastLogicRulesSyncKeyRef.current = syncKey;

    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      setLogicRuleBlocks(buildLogicRuleBlocksFromRowRules(rowRules));
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [buildLogicRuleBlocksFromRowRules, editingSpec?.rowRules, show]);

  const canEdit = !!selectedColKey && !loading;

  const stageLogicRules = useCallback(
    (blocks: LogicRuleBlock[]): RowRule[] | null => {
      if (!isGlobalSelected) return null;

      const disallowWhenRules: RowRule[] = [];
      for (const b of blocks) {
        if (b.pattern !== "disallowWhen") continue;

        const leftKey = (b.leftKey ?? "").toString();
        const rightKey = (b.rightKey ?? "").toString();
        const leftValue = (b.leftValue ?? "").toString();
        const rightValue = (b.rightValue ?? "").toString();
        const mode = b.conditionMode ?? "equals";

        const leftDataType = (dataTypeByColKey?.[leftKey] ?? null) as DataType | null;
        const isNumericLeft = leftDataType === "integer" || leftDataType === "decimal" || leftDataType === "number";

        if (leftKey.trim() === "" || rightKey.trim() === "") continue;

        const when = (() => {
          if (mode === "isNull") {
            return { kind: "blank", colKey: leftKey, trim: true } as const;
          }
          if (mode === "isNotNull") {
            return { kind: "nonBlank", colKey: leftKey, trim: true } as const;
          }

          // equals / compare
          if (isNumericLeft) {
            const n = Number(leftValue.replace(/,/g, "").trim());
            if (!Number.isFinite(n)) return null;
            const op = (b.compareOp ?? "eq") as NumberCompareOp;
            return { kind: "numberCompare", colKey: leftKey, op, value: n, trim: true } as const;
          }

          if (leftValue.trim() === "") return null;
          return { kind: "equals", colKey: leftKey, value: leftValue, trim: false, caseSensitive: true } as const;
        })();

        if (!when) continue;
        const forbiddenValues = rightValue
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== "");

        if (forbiddenValues.length === 0) continue;

        disallowWhenRules.push({
          id: "disallowWhen",
          ...(b.name.trim() !== "" ? { name: b.name.trim() } : {}),
          enabled: b.enabled,
          when,
          thenColKey: rightKey,
          kind: "notIn",
          forbiddenValues,
          trim: false,
          caseSensitive: true,
        });
      }

      const allowWhenRules: RowRule[] = [];
      for (const b of blocks) {
        if (b.pattern !== "allowWhen") continue;

        const leftKey = (b.leftKey ?? "").toString();
        const rightKey = (b.rightKey ?? "").toString();
        const leftValue = (b.leftValue ?? "").toString();
        const mode = b.conditionMode ?? "equals";

        const leftDataType = (dataTypeByColKey?.[leftKey] ?? null) as DataType | null;
        const isNumericLeft = leftDataType === "integer" || leftDataType === "decimal" || leftDataType === "number";

        if (leftKey.trim() === "" || rightKey.trim() === "") continue;

        const when = (() => {
          if (mode === "isNull") {
            return { kind: "blank", colKey: leftKey, trim: true } as const;
          }
          if (mode === "isNotNull") {
            return { kind: "nonBlank", colKey: leftKey, trim: true } as const;
          }

          // equals / compare
          if (isNumericLeft) {
            const n = Number(leftValue.replace(/,/g, "").trim());
            if (!Number.isFinite(n)) return null;
            const op = (b.compareOp ?? "eq") as NumberCompareOp;
            return { kind: "numberCompare", colKey: leftKey, op, value: n, trim: true } as const;
          }

          if (leftValue.trim() === "") return null;
          return { kind: "equals", colKey: leftKey, value: leftValue, trim: false, caseSensitive: true } as const;
        })();

        if (!when) continue;

        const allowedValues = (b.rightValue ?? "")
          .toString()
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== "");

        if (allowedValues.length === 0) continue;

        allowWhenRules.push({
          id: "allowWhen",
          ...(b.name.trim() !== "" ? { name: b.name.trim() } : {}),
          enabled: b.enabled,
          when,
          thenColKey: rightKey,
          allowedValues,
          trim: false,
          caseSensitive: true,
        });
      }

      const requireWhenRules: RowRule[] = [];
      for (const b of blocks) {
        if (b.pattern !== "requireWhen") continue;

        const leftKey = (b.leftKey ?? "").toString();
        const thenRequiredColKey = (b.rightKey ?? "").toString();
        const mode = b.conditionMode ?? "equals";

        const leftDataType = (dataTypeByColKey?.[leftKey] ?? null) as DataType | null;
        const isNumericLeft = leftDataType === "integer" || leftDataType === "decimal" || leftDataType === "number";

        if (leftKey.trim() === "" || thenRequiredColKey.trim() === "") continue;

        if (mode === "isNull") {
          requireWhenRules.push({
            id: "requireWhen",
            ...(b.name.trim() !== "" ? { name: b.name.trim() } : {}),
            enabled: b.enabled,
            when: { kind: "blank", colKey: leftKey, trim: true },
            thenRequiredColKey,
          });
          continue;
        }

        if (mode === "isNotNull") {
          requireWhenRules.push({
            id: "requireWhen",
            ...(b.name.trim() !== "" ? { name: b.name.trim() } : {}),
            enabled: b.enabled,
            when: { kind: "nonBlank", colKey: leftKey, trim: true },
            thenRequiredColKey,
          });
          continue;
        }

        const leftValue = (b.leftValue ?? "").toString();

        const when = (() => {
          if (leftValue.trim() === "") return null;

          // equals / compare
          if (isNumericLeft) {
            const n = Number(leftValue.replace(/,/g, "").trim());
            if (!Number.isFinite(n)) return null;
            const op = (b.compareOp ?? "eq") as NumberCompareOp;
            return { kind: "numberCompare", colKey: leftKey, op, value: n, trim: true } as const;
          }

          return { kind: "equals", colKey: leftKey, value: leftValue, trim: false, caseSensitive: true } as const;
        })();

        if (!when) continue;

        requireWhenRules.push({
          id: "requireWhen",
          ...(b.name.trim() !== "" ? { name: b.name.trim() } : {}),
          enabled: b.enabled,
          when,
          thenRequiredColKey,
        });
      }

      const numberRelationRules: RowRule[] = [];
      for (const b of blocks) {
        if (b.pattern !== "numberRelation") continue;

        const baseColKey = (b.leftKey ?? "").toString();
        const targetColKey = (b.rightKey ?? "").toString();

        if (baseColKey.trim() === "" || targetColKey.trim() === "") continue;
        if (baseColKey === targetColKey) continue;

        const baseType = (dataTypeByColKey?.[baseColKey] ?? null) as DataType | null;
        const targetType = (dataTypeByColKey?.[targetColKey] ?? null) as DataType | null;
        const isNumericBase = baseType === "integer" || baseType === "decimal" || baseType === "number";
        const isNumericTarget = targetType === "integer" || targetType === "decimal" || targetType === "number";
        if (!isNumericBase || !isNumericTarget) continue;

        const op = (b.compareOp ?? "gt") as NumberCompareOp;
        if (op === "eq") continue;

        numberRelationRules.push({
          id: "numberRelation",
          ...(b.name.trim() !== "" ? { name: b.name.trim() } : {}),
          enabled: b.enabled,
          baseColKey,
          targetColKey,
          op,
          trim: true,
        });
      }

      const dateRelationRules: RowRule[] = [];
      for (const b of blocks) {
        if (b.pattern !== "dateRelation") continue;

        const baseColKey = (b.leftKey ?? "").toString();
        const targetColKey = (b.rightKey ?? "").toString();

        if (baseColKey.trim() === "" || targetColKey.trim() === "") continue;
        if (baseColKey === targetColKey) continue;

        const baseType = (dataTypeByColKey?.[baseColKey] ?? null) as DataType | null;
        const targetType = (dataTypeByColKey?.[targetColKey] ?? null) as DataType | null;
        const isDateLike = (t: DataType | null) => t === "date" || t === "datetime";
        if (!isDateLike(baseType) || !isDateLike(targetType)) continue;

        const op = (b.compareOp ?? "after") as DateRelationOp;

        dateRelationRules.push({
          id: "dateRelation",
          ...(b.name.trim() !== "" ? { name: b.name.trim() } : {}),
          enabled: b.enabled,
          baseColKey,
          targetColKey,
          op,
          trim: true,
        });
      }

      const timeRelationRules: RowRule[] = [];
      for (const b of blocks) {
        if (b.pattern !== "timeRelation") continue;

        const baseColKey = (b.leftKey ?? "").toString();
        const targetColKey = (b.rightKey ?? "").toString();

        if (baseColKey.trim() === "" || targetColKey.trim() === "") continue;
        if (baseColKey === targetColKey) continue;

        const baseType = (dataTypeByColKey?.[baseColKey] ?? null) as DataType | null;
        const targetType = (dataTypeByColKey?.[targetColKey] ?? null) as DataType | null;
        if (baseType !== "time" || targetType !== "time") continue;

        const op = (b.compareOp ?? "after") as TimeRelationOp;

        timeRelationRules.push({
          id: "timeRelation",
          ...(b.name.trim() !== "" ? { name: b.name.trim() } : {}),
          enabled: b.enabled,
          baseColKey,
          targetColKey,
          op,
          trim: true,
        });
      }

      const nextRowRules: RowRule[] = [
        ...passthroughRowRules,
        ...disallowWhenRules,
        ...allowWhenRules,
        ...requireWhenRules,
        ...numberRelationRules,
        ...dateRelationRules,
        ...timeRelationRules,
      ];
      onUpdateRowRules(nextRowRules);
      return nextRowRules;
    },
    [dataTypeByColKey, isGlobalSelected, onUpdateRowRules, passthroughRowRules]
  );

  // 親（ValidationTab）の state 更新は render 中に走らないよう、レンダー後にまとめて反映する。
  // これにより「Cannot update a component while rendering a different component」警告を回避する。
  useLayoutEffect(() => {
    if (!show("logicRules")) return;
    if (!logicRulesDirtyRef.current) return;

    const nextRowRules = stageLogicRules(logicRuleBlocks);

    // NOTE: stage により親 spec が更新されると、下の「spec→UI同期」effect が即時に走って
    // buildLogicRuleBlocksFromRowRules で UI の一時状態（equals の入力値など）を上書きしてしまう。
    // stage 直後は「同期済み」と見なして、即時の上書きを防ぐ。
    if (nextRowRules) {
      lastLogicRulesSyncKeyRef.current = JSON.stringify(nextRowRules);
    }
    logicRulesDirtyRef.current = false;
  }, [logicRuleBlocks, show, stageLogicRules]);

  // NOTE: 論理整合性はローカル state を持つため、spec 変化に追従する同期が必要。

  const headerButtons = useMemo(() => {
    if (headerKeys.length === 0) {
      return <div className="text-sm text-neutral-500 dark:text-neutral-400">(列が見つかりません)</div>;
    }

    return (
      <div className="max-w-full overflow-x-auto">
        <div className="flex gap-2 flex-nowrap pb-1">
          {headerKeys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSelectedColKey(k)}
              className={`px-3 py-1 rounded text-sm border transition-colors whitespace-nowrap ${
                selectedColKey === k
                  ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 bg-white dark:bg-neutral-900"
                  : "text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {k === GLOBAL_COL_KEY ? "全体" : k}
            </button>
          ))}
        </div>
      </div>
    );
  }, [headerKeys, selectedColKey, setSelectedColKey]);

  return (
    <div className="mb-4 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded">
      <div className="mb-3">
        <div className="text-sm font-semibold mb-2">カラム</div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-neutral-700 dark:text-neutral-300">列:</label>
          {headerButtons}
        </div>
      </div>

      <SettingsBox title="設定">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-neutral-700 dark:text-neutral-300">カラム名</div>
            <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {selectedColKey === GLOBAL_COL_KEY ? "全体" : selectedColKey || "-"}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-neutral-700 dark:text-neutral-300">データの種類</div>
            <div className="text-sm font-mono text-neutral-700 dark:text-neutral-300">{dataTypeLabel}</div>
          </div>

          {show("required") && (
            <ToggleRow
              label="必須"
              checked={requiredEnabled}
              onChange={(checked) => onToggleRequired(checked)}
              disabled={!canEdit}
              rightLabel="必須にする"
            />
          )}
          {show("sheetForbiddenChars") && (
            <RuleToggleLinesTextArea
              label="禁止文字（全体）（含まれていたらNG）"
              enabled={sheetForbiddenCharsEnabled}
              setEnabled={(enabled) => {
                setSheetForbiddenCharsEnabled(enabled);
                if (!enabled) {
                  setSheetForbiddenCharsText("");
                  onUpdateSheetForbiddenChars(false, []);
                }
              }}
              text={sheetForbiddenCharsText}
              setText={(text) => {
                setSheetForbiddenCharsText(text);
                if (!sheetForbiddenCharsEnabled && text.trim() !== "") {
                  setSheetForbiddenCharsEnabled(true);
                }
              }}
              canEdit={canEdit}
              rows={4}
              placeholder="1行に1つずつ入力（例: [] や NG など）"
              onCommit={(enabled, values) => onUpdateSheetForbiddenChars(enabled, values)}
            />
          )}

          {show("logicRules") && (
            <SettingsBox title="論理整合性（複数カラム）">
              <div className="space-y-3">
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  ルール単位で有効/無効とパターンを選択できます。左=条件、右=制御対象です。
                </div>

                {logicRuleBlocks.length === 0 && (
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    （ルールがありません。下の「ルールを追加」から作成してください）
                  </div>
                )}

                <div className="space-y-3">
                  {logicRuleBlocks.map((b, idx) => (
                    <div
                      key={b.blockId}
                      className="p-3 border border-neutral-200 dark:border-neutral-700 rounded"
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">ルール {idx + 1}</div>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => {
                            setLogicRuleBlocks((prev) => prev.filter((x) => x.blockId !== b.blockId));
                            logicRulesDirtyRef.current = true;
                          }}
                          className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-600 rounded"
                        >
                          削除
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <TextField
                          label="ルール名"
                          value={b.name}
                          setValue={(v) => {
                            setLogicRuleBlocks((prev) => prev.map((x) => (x.blockId === b.blockId ? { ...x, name: v } : x)));
                          }}
                          canEdit={canEdit}
                          placeholder="例: 請求書種別の禁止"
                          normalizeOnCommit={(v) => v.trim()}
                          onCommit={(v) => {
                            setLogicRuleBlocks((prev) => {
                              const next = prev.map((x) => (x.blockId === b.blockId ? { ...x, name: v } : x));
                              logicRulesDirtyRef.current = true;
                              return next;
                            });
                          }}
                        />
                        <ToggleRow
                          label="ルールを有効にする"
                          checked={b.enabled}
                          onChange={(checked) => {
                            setLogicRuleBlocks((prev) => prev.map((x) => (x.blockId === b.blockId ? { ...x, enabled: checked } : x)));
                            logicRulesDirtyRef.current = true;
                          }}
                          disabled={!canEdit}
                          rightLabel={b.enabled ? "ON" : "OFF"}
                        />
                        <SelectField
                          label="パターン"
                          value={b.pattern}
                          onChange={(v) => {
                            setLogicRuleBlocks((prev) =>
                              prev.map((x) => {
                                if (x.blockId !== b.blockId) return x;
                                const nextPattern = v as LogicRulePattern;
                                if (nextPattern === "requireWhen") {
                                  return {
                                    ...x,
                                    pattern: nextPattern,
                                    conditionMode: x.conditionMode ?? "equals",
                                    compareOp: x.compareOp ?? "eq",
                                    rightValue: "",
                                  };
                                }

                                if (nextPattern === "disallowWhen") {
                                  return {
                                    ...x,
                                    pattern: nextPattern,
                                    conditionMode: x.conditionMode ?? "equals",
                                    compareOp: x.compareOp ?? "eq",
                                  };
                                }

                                if (nextPattern === "allowWhen") {
                                  return {
                                    ...x,
                                    pattern: nextPattern,
                                    conditionMode: x.conditionMode ?? "equals",
                                    compareOp: x.compareOp ?? "eq",
                                  };
                                }

                                if (nextPattern === "numberRelation") {
                                  const op = (x.compareOp ?? "gt") as NumberCompareOp;
                                  const normalizedOp = op === "eq" ? "gt" : op;
                                  return {
                                    ...x,
                                    pattern: nextPattern,
                                    conditionMode: undefined,
                                    compareOp: normalizedOp,
                                    leftValue: "",
                                    rightValue: "",
                                  };
                                }

                                if (nextPattern === "dateRelation") {
                                  return {
                                    ...x,
                                    pattern: nextPattern,
                                    conditionMode: undefined,
                                    compareOp: (x.compareOp ?? "after") as DateRelationOp,
                                    leftValue: "",
                                    rightValue: "",
                                  };
                                }

                                if (nextPattern === "timeRelation") {
                                  return {
                                    ...x,
                                    pattern: nextPattern,
                                    conditionMode: undefined,
                                    compareOp: (x.compareOp ?? "after") as TimeRelationOp,
                                    leftValue: "",
                                    rightValue: "",
                                  };
                                }

                                return {
                                  ...x,
                                  pattern: nextPattern,
                                  conditionMode: x.conditionMode,
                                };
                              })
                            );
                            logicRulesDirtyRef.current = true;
                          }}
                          disabled={!canEdit}
                        >
                          <option value="requireWhen">条件付き必須</option>
                          <option value="allowWhen">条件付き許可</option>
                          <option value="disallowWhen">条件付き禁止</option>
                          <option value="numberRelation">数値の大小関係</option>
                          <option value="dateRelation">日時の前後関係</option>
                          <option value="timeRelation">時刻の前後関係</option>
                        </SelectField>


                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 border border-neutral-200 dark:border-neutral-700 rounded bg-neutral-50 dark:bg-neutral-800">
                          <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">条件</div>
                          <SelectField
                            label="カラム"
                            value={b.leftKey}
                            onChange={(v) => {
                              setLogicRuleBlocks((prev) =>
                                prev.map((x) =>
                                  x.blockId === b.blockId
                                    ? {
                                        ...x,
                                        leftKey: v,
                                        compareOp:
                                          x.pattern === "numberRelation"
                                            ? ((x.compareOp ?? "gt") as NumberCompareOp)
                                            : x.pattern === "dateRelation"
                                              ? ((x.compareOp ?? "after") as DateRelationOp)
                                              : x.pattern === "timeRelation"
                                                ? ((x.compareOp ?? "after") as TimeRelationOp)
                                              : ((x.compareOp ?? "eq") as NumberCompareOp),
                                      }
                                    : x
                                )
                              );
                              logicRulesDirtyRef.current = true;
                            }}
                            disabled={!canEdit}
                          >
                            <option value="">選択してください</option>
                            {(b.pattern === "numberRelation"
                              ? numericHeaderKeys
                              : b.pattern === "dateRelation"
                                ? dateHeaderKeys
                                : b.pattern === "timeRelation"
                                  ? timeHeaderKeys
                                : dataHeaderKeys
                            ).map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </SelectField>

                          {(b.pattern === "requireWhen" || b.pattern === "disallowWhen" || b.pattern === "allowWhen") && (
                            <div className="mt-3">
                              <SelectField
                                label="条件（判定）"
                                value={b.conditionMode ?? "equals"}
                                onChange={(v) => {
                                  setLogicRuleBlocks((prev) =>
                                    prev.map((x) =>
                                      x.blockId === b.blockId
                                        ? {
                                            ...x,
                                            conditionMode: v as RequireWhenConditionMode,
                                          }
                                        : x
                                    )
                                  );
                                  logicRulesDirtyRef.current = true;
                                }}
                                disabled={!canEdit}
                              >
                                <option value="isNull">null / 空欄</option>
                                <option value="isNotNull">非null / 入力あり</option>
                                <option value="equals">特定の値</option>
                              </SelectField>
                            </div>
                          )}

                          {(b.pattern === "disallowWhen" || b.pattern === "requireWhen" || b.pattern === "allowWhen") && (b.conditionMode ?? "equals") === "equals" && (() => {
                            const dt = dataTypeByColKey?.[b.leftKey] ?? null;
                            const isNumeric = dt === "integer" || dt === "decimal" || dt === "number";
                            if (!isNumeric) return null;
                            return (
                              <div className="mt-3">
                                <SelectField
                                  label="比較"
                                  value={b.compareOp ?? "eq"}
                                  onChange={(v) => {
                                    setLogicRuleBlocks((prev) =>
                                      prev.map((x) =>
                                        x.blockId === b.blockId
                                          ? { ...x, compareOp: v as NumberCompareOp }
                                          : x
                                      )
                                    );
                                    logicRulesDirtyRef.current = true;
                                  }}
                                  disabled={!canEdit}
                                >
                                  <option value="eq">一致（＝）</option>
                                  <option value="lt">より小さい（＜）</option>
                                  <option value="gt">より大きい（＞）</option>
                                  <option value="lte">以下（≦）</option>
                                  <option value="gte">以上（≧）</option>
                                </SelectField>
                              </div>
                            );
                          })()}

                          {b.pattern !== "numberRelation" &&
                            b.pattern !== "dateRelation" &&
                            b.pattern !== "timeRelation" &&
                            !(
                              (b.pattern === "requireWhen" || b.pattern === "disallowWhen") &&
                              (b.conditionMode === "isNull" || b.conditionMode === "isNotNull")
                            ) && (
                            <div className="mt-3">
                              <TextField
                                label="値"
                                value={b.leftValue}
                                setValue={(v) => {
                                  setLogicRuleBlocks((prev) => prev.map((x) => (x.blockId === b.blockId ? { ...x, leftValue: v } : x)));
                                }}
                                canEdit={canEdit}
                                placeholder="例: 現金"
                                onCommit={(v) => {
                                  setLogicRuleBlocks((prev) => {
                                    const next = prev.map((x) => (x.blockId === b.blockId ? { ...x, leftValue: v } : x));
                                    logicRulesDirtyRef.current = true;
                                    return next;
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="p-3 border border-neutral-200 dark:border-neutral-700 rounded bg-neutral-50 dark:bg-neutral-800">
                          <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">制御対象</div>
                          <SelectField
                            label="カラム"
                            value={b.rightKey}
                            onChange={(v) => {
                              setLogicRuleBlocks((prev) => prev.map((x) => (x.blockId === b.blockId ? { ...x, rightKey: v } : x)));
                              logicRulesDirtyRef.current = true;
                            }}
                            disabled={!canEdit}
                          >
                            <option value="">選択してください</option>
                            {(b.pattern === "numberRelation"
                              ? numericHeaderKeys
                              : b.pattern === "dateRelation"
                                ? dateHeaderKeys
                                : b.pattern === "timeRelation"
                                  ? timeHeaderKeys
                                : dataHeaderKeys
                            ).map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </SelectField>

                          {b.pattern === "numberRelation" ? (
                            <div className="mt-3">
                              <SelectField
                                label="（条件カラムの数値）"
                                value={(b.compareOp ?? "gt") === "eq" ? "gt" : (b.compareOp ?? "gt")}
                                onChange={(v) => {
                                  setLogicRuleBlocks((prev) =>
                                    prev.map((x) =>
                                      x.blockId === b.blockId
                                        ? { ...x, compareOp: v as NumberCompareOp }
                                        : x
                                    )
                                  );
                                  logicRulesDirtyRef.current = true;
                                }}
                                disabled={!canEdit}
                              >
                                <option value="lt">より小さい</option>
                                <option value="gt">より大きい</option>
                                <option value="lte">以下</option>
                                <option value="gte">以上</option>
                              </SelectField>
                            </div>
                          ) : b.pattern === "dateRelation" ? (
                            <div className="mt-3">
                              <SelectField
                                label="（条件カラムの日付）"
                                value={(b.compareOp ?? "after") as DateRelationOp}
                                onChange={(v) => {
                                  setLogicRuleBlocks((prev) =>
                                    prev.map((x) =>
                                      x.blockId === b.blockId
                                        ? { ...x, compareOp: v as DateRelationOp }
                                        : x
                                    )
                                  );
                                  logicRulesDirtyRef.current = true;
                                }}
                                disabled={!canEdit}
                              >
                                <option value="before">より前</option>
                                <option value="after">より後</option>
                                <option value="onOrBefore">以前</option>
                                <option value="onOrAfter">以後</option>
                              </SelectField>
                            </div>
                          ) : b.pattern === "timeRelation" ? (
                            <div className="mt-3">
                              <SelectField
                                label="（条件カラムの時刻）"
                                value={(b.compareOp ?? "after") as TimeRelationOp}
                                onChange={(v) => {
                                  setLogicRuleBlocks((prev) =>
                                    prev.map((x) =>
                                      x.blockId === b.blockId
                                        ? { ...x, compareOp: v as TimeRelationOp }
                                        : x
                                    )
                                  );
                                  logicRulesDirtyRef.current = true;
                                }}
                                disabled={!canEdit}
                              >
                                <option value="before">より前</option>
                                <option value="after">より後</option>
                                <option value="onOrBefore">以前</option>
                                <option value="onOrAfter">以後</option>
                              </SelectField>
                            </div>
                          ) : b.pattern !== "requireWhen" ? (
                            <div className="mt-3">
                              <TextField
                                label={b.pattern === "allowWhen" ? "許可値（カンマ区切り）" : "禁止値（カンマ区切り）"}
                                value={b.rightValue}
                                setValue={(v) => {
                                  setLogicRuleBlocks((prev) => prev.map((x) => (x.blockId === b.blockId ? { ...x, rightValue: v } : x)));
                                }}
                                canEdit={canEdit}
                                placeholder={b.pattern === "allowWhen" ? "例: 請求書, 領収書" : "例: 請求書, 領収書"}
                                onCommit={(v) => {
                                  setLogicRuleBlocks((prev) => {
                                    const next = prev.map((x) => (x.blockId === b.blockId ? { ...x, rightValue: v } : x));
                                    logicRulesDirtyRef.current = true;
                                    return next;
                                  });
                                }}
                              />
                            </div>
                          ) : (
                            <div className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
                              条件が成立した行で、このカラムを必須にします。
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => {
                        setLogicRuleBlocks((prev) => [
                          ...prev,
                          {
                            blockId: makeBlockId(),
                            enabled: true,
                            pattern: "disallowWhen",
                            name: "",
                            conditionMode: "equals",
                            compareOp: "eq",
                            leftKey: "",
                            leftValue: "",
                            rightKey: "",
                            rightValue: "",
                          },
                        ]);
                        logicRulesDirtyRef.current = true;
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ルールを追加
                    </button>
                  </div>
                </div>

                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  ※ equals/条件付き禁止/条件付き許可は「完全一致」で判定します（trimなし・大小区別あり）。
                  条件付き許可の許可値はカンマ区切りで複数指定できます（例: A, B, C）。
                  条件付き必須の「null/非null」はtrimありで空判定します。
                  数値カラムの条件付き必須/禁止（特定の値）は数値として比較します（カンマは無視します）。
                  数値の大小関係は「制御対象」カラムを「条件」カラムと比較します。
                  日時の前後関係は「制御対象」カラムを「条件」カラムと比較します。
                  時刻の前後関係は「制御対象」カラムを「条件」カラムと比較します。
                  条件/制御対象のどちらかが空欄のルールは判定しません（MVP方針）。
                </div>
              </div>
            </SettingsBox>
          )}

          {show("unique") && (
            <ToggleRow
              label="一意（重複なし）"
              checked={uniqueEnabled}
              onChange={(checked) => onToggleUnique(checked)}
              disabled={!canEdit}
              rightLabel="有効"
            />
          )}

          {show("thousandsSeparator") && (
            <ToggleRow
              label="カンマ区切り（千区切り）"
              checked={thousandsSeparatorAllowed}
              onChange={(checked) => onToggleThousandsSeparatorAllowed(checked)}
              disabled={!canEdit}
              rightLabel="許可"
            />
          )}

          {show("phoneHyphen") && (
            <SelectField
              label="ハイフンの有無"
              value={phoneHyphenMode}
              onChange={(v) => onChangePhoneHyphenMode(v as Props["phoneHyphenMode"])}
              disabled={!canEdit}
            >
              <option value="any">指定なし（どちらでも可）</option>
              <option value="required">ハイフン有りのみ</option>
              <option value="forbidden">ハイフン無しのみ</option>
            </SelectField>
          )}

          {show("dateFormat") && (
            <SelectField
              label="日付フォーマット"
              value={dateFormat}
              onChange={(v) => onChangeDateFormat(v as Props["dateFormat"])}
              disabled={!canEdit}
            >
              <option value="none">指定なし（チェックしない）</option>
              <option value="strict">一般的（複数形式を許容）</option>
              <option value="yyyymmdd">YYYYMMDD（例: 20250131）</option>
              <option value="yyyy-mm-dd">YYYY-MM-DD（例: 2025-01-31）</option>
              <option value="yyyy/mm/dd">YYYY/MM/DD（例: 2025/1/31）</option>
              <option value="yyyy年m月d日">YYYY年M月D日（例: 2025年1月31日）</option>
            </SelectField>
          )}

          {show("timeFormat") && (
            <SelectField
              label="時刻フォーマット"
              value={timeFormat}
              onChange={(v) => onChangeTimeFormat(v as Props["timeFormat"])}
              disabled={!canEdit}
            >
              <option value="none">指定なし（チェックしない）</option>
              <option value="strict">一般的（複数形式を許容）</option>
              <option value="h:mm">H:mm（例: 9:05）</option>
              <option value="hh:mm">HH:mm（例: 09:05）</option>
              <option value="h:mm:ss">H:mm:ss（例: 9:05:07）</option>
              <option value="hh:mm:ss">HH:mm:ss（例: 09:05:07）</option>
            </SelectField>
          )}

          {show("datetimeFormat") && (
            <SelectField
              label="日時フォーマット"
              value={datetimeFormat}
              onChange={(v) => onChangeDatetimeFormat(v as Props["datetimeFormat"])}
              disabled={!canEdit}
            >
              <option value="none">指定なし（チェックしない）</option>
              <option value="strict">一般的（複数形式を許容）</option>
              <option value="yyyymmddhhmmss">YYYYMMDDHHMMSS（例: 20250131090507）</option>
              <option value="yyyy-mm-dd hh:mm">YYYY-MM-DD HH:mm（例: 2025-01-31 09:05）</option>
              <option value="yyyy-mm-dd hh:mm:ss">YYYY-MM-DD HH:mm:ss（例: 2025-01-31 09:05:07）</option>
              <option value="yyyy/mm/dd hh:mm">YYYY/MM/DD HH:mm（例: 2025/1/31 09:05）</option>
              <option value="yyyy/mm/dd hh:mm:ss">YYYY/MM/DD HH:mm:ss（例: 2025/1/31 09:05:07）</option>
              <option value="yyyy年m月d日 hh:mm">YYYY年M月D日 HH:mm（例: 2025年1月31日 09:05）</option>
              <option value="yyyy年m月d日 hh:mm:ss">YYYY年M月D日 HH:mm:ss（例: 2025年1月31日 09:05:07）</option>
            </SelectField>
          )}

          {show("booleanValues") && (
            <div className="space-y-3">
              <ToggleRow
                label="真偽値（許容値を指定）"
                checked={booleanValuesEnabled}
                onChange={(checked) => {
                  setBooleanValuesEnabled(checked);
                  if (!checked) {
                    setBooleanTrueValueText("");
                    setBooleanFalseValueText("");
                    onUpdateBooleanValues(false, "", "");
                  }
                }}
                disabled={!canEdit}
                rightLabel="有効"
              />

              <TextField
                label="真として扱う値"
                value={booleanTrueValueText}
                setValue={(v) => {
                  setBooleanTrueValueText(v);
                  if (!booleanValuesEnabled && v.trim() !== "") setBooleanValuesEnabled(true);
                }}
                canEdit={canEdit}
                placeholder="例: true"
                normalizeOnCommit={(v) => v.trim()}
                onCommit={() => {
                  if (!canEdit) return;
                  if (!booleanValuesEnabled) return;

                  const t = booleanTrueValueText.trim();
                  const f = booleanFalseValueText.trim();
                  if (t === "" && f === "") {
                    setBooleanValuesEnabled(false);
                    setBooleanTrueValueText("");
                    setBooleanFalseValueText("");
                    onUpdateBooleanValues(false, "", "");
                    return;
                  }

                  // 両方揃ってから保存する
                  if (t !== "" && f !== "") {
                    onUpdateBooleanValues(true, t, f);
                  }
                }}
              />

              <TextField
                label="偽として扱う値"
                value={booleanFalseValueText}
                setValue={(v) => {
                  setBooleanFalseValueText(v);
                  if (!booleanValuesEnabled && v.trim() !== "") setBooleanValuesEnabled(true);
                }}
                canEdit={canEdit}
                placeholder="例: false"
                normalizeOnCommit={(v) => v.trim()}
                onCommit={() => {
                  if (!canEdit) return;
                  if (!booleanValuesEnabled) return;

                  const t = booleanTrueValueText.trim();
                  const f = booleanFalseValueText.trim();
                  if (t === "" && f === "") {
                    setBooleanValuesEnabled(false);
                    setBooleanTrueValueText("");
                    setBooleanFalseValueText("");
                    onUpdateBooleanValues(false, "", "");
                    return;
                  }

                  // 両方揃ってから保存する
                  if (t !== "" && f !== "") {
                    onUpdateBooleanValues(true, t, f);
                  }
                }}
              />
            </div>
          )}

          {show("phoneDigitsMinLength") && (
            <RuleToggleNumberInput
              label="桁数（ハイフン除く・最小）"
              enabled={phoneDigitsMinEnabled}
              setEnabled={setPhoneDigitsMinEnabled}
              text={phoneDigitsMinText}
              setText={setPhoneDigitsMinText}
              canEdit={canEdit}
              input={{ min: 1, step: 1, placeholder: "例: 10" }}
              autoEnableWhenValidNumber={(n) => n >= 1}
              normalizeOnCommit={(n) => Math.floor(n)}
              onCommit={(enabled, value) => onUpdatePhoneDigitsMinLength(enabled, value)}
            />
          )}

          {show("phoneDigitsMaxLength") && (
            <RuleToggleNumberInput
              label="桁数（ハイフン除く・最大）"
              enabled={phoneDigitsMaxEnabled}
              setEnabled={setPhoneDigitsMaxEnabled}
              text={phoneDigitsMaxText}
              setText={setPhoneDigitsMaxText}
              canEdit={canEdit}
              input={{ min: 1, step: 1, placeholder: "例: 11" }}
              autoEnableWhenValidNumber={(n) => n >= 1}
              normalizeOnCommit={(n) => Math.floor(n)}
              onCommit={(enabled, value) => onUpdatePhoneDigitsMaxLength(enabled, value)}
            />
          )}

          {show("forbiddenChars") && (
            <RuleToggleLinesTextArea
              label="禁止文字（含まれていたらNG）"
              enabled={forbiddenCharsEnabled}
              setEnabled={setForbiddenCharsEnabled}
              text={forbiddenCharsText}
              setText={setForbiddenCharsText}
              canEdit={canEdit}
              rows={4}
              placeholder="1行に1つずつ入力（例: [] や NG など）"
              onCommit={(enabled, values) => onUpdateForbiddenChars(enabled, values)}
            />
          )}

          {show("enum") && (
            <RuleToggleLinesTextArea
              label="許可値（指定した値のみOK）"
              enabled={enumEnabled}
              setEnabled={setEnumEnabled}
              text={enumValuesText}
              setText={setEnumValuesText}
              canEdit={canEdit}
              rows={4}
              placeholder="1行に1つずつ入力（空行は無視されます）"
              onCommit={(enabled, values) => onUpdateEnum(enabled, values)}
            />
          )}

          {show("minValue") && (
            <RuleToggleNumberInput
              label="最小値"
              enabled={minValueEnabled}
              setEnabled={setMinValueEnabled}
              text={minValueText}
              setText={setMinValueText}
              canEdit={canEdit}
              input={{ step: minMaxValueInput.step, placeholder: minMaxValueInput.exampleMin }}
              autoEnableWhenValidNumber={() => true}
              onCommit={(enabled, value) => onUpdateMinValue(enabled, value)}
            />
          )}

          {show("maxValue") && (
            <RuleToggleNumberInput
              label="最大値"
              enabled={maxValueEnabled}
              setEnabled={setMaxValueEnabled}
              text={maxValueText}
              setText={setMaxValueText}
              canEdit={canEdit}
              input={{ step: minMaxValueInput.step, placeholder: minMaxValueInput.exampleMax }}
              autoEnableWhenValidNumber={() => true}
              onCommit={(enabled, value) => onUpdateMaxValue(enabled, value)}
            />
          )}

          {show("minLength") && (
            <RuleToggleNumberInput
              label="文字数（最小）"
              enabled={minLengthEnabled}
              setEnabled={setMinLengthEnabled}
              text={minLengthText}
              setText={setMinLengthText}
              canEdit={canEdit}
              input={{ min: 1, step: 1, placeholder: "例: 3" }}
              autoEnableWhenValidNumber={(n) => n >= 1}
              normalizeOnCommit={(n) => Math.floor(n)}
              onCommit={(enabled, value) => onUpdateMinLength(enabled, value)}
            />
          )}

          {show("maxLength") && (
            <RuleToggleNumberInput
              label="文字数（最大）"
              enabled={maxLengthEnabled}
              setEnabled={setMaxLengthEnabled}
              text={maxLengthText}
              setText={setMaxLengthText}
              canEdit={canEdit}
              input={{ min: 1, step: 1, placeholder: "例: 20" }}
              autoEnableWhenValidNumber={(n) => n >= 1}
              normalizeOnCommit={(n) => Math.floor(n)}
              onCommit={(enabled, value) => onUpdateMaxLength(enabled, value)}
            />
          )}

          {show("pattern") && (
            <RuleToggleTextInput
              label="入力パターン（形式）"
              enabled={patternEnabled}
              setEnabled={setPatternEnabled}
              text={patternText}
              setText={setPatternText}
              canEdit={canEdit}
              placeholder="例: ^[0-9]{3}-[0-9]{4}$"
              normalizeOnCommit={(v) => v.trim()}
              onCommit={(enabled, value) => onUpdatePattern(enabled, value)}
            />
          )}
        </div>
      </SettingsBox>
    </div>
  );
}
