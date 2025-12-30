import { useCallback } from "react";

import type { ValidationSpec } from "@shared/mapping";

type Options = {
  editingValidationSpec: ValidationSpec | null;
  setEditingValidationSpec: (spec: ValidationSpec) => void;
  savedValidationSpec: ValidationSpec | null;
  mappingHeaderRowIndex?: number;
  getHeaderRowIndexForValidation: () => number;
  saveValidationSpec: (spec: ValidationSpec) => Promise<void>;
  loadValidationSpec: () => Promise<void> | void;
};

export function useValidationSpecEditor(options: Options) {
  const {
    editingValidationSpec,
    setEditingValidationSpec,
    savedValidationSpec,
    mappingHeaderRowIndex,
    getHeaderRowIndexForValidation,
    saveValidationSpec,
    loadValidationSpec,
  } = options;

  const getBaseSpec = useCallback((): ValidationSpec => {
    return (
      editingValidationSpec ??
      savedValidationSpec ?? {
        columns: [],
        options: { headerRowIndex: mappingHeaderRowIndex ?? 0 },
      }
    );
  }, [editingValidationSpec, savedValidationSpec, mappingHeaderRowIndex]);

  const commit = useCallback(
    async (base: ValidationSpec, nextColumns: ValidationSpec["columns"]) => {
      const headerRowIndex = getHeaderRowIndexForValidation();
      const nextSpec: ValidationSpec = {
        ...base,
        columns: nextColumns,
        options: {
          ...base.options,
          headerRowIndex,
        },
      };

      setEditingValidationSpec(nextSpec);
      await saveValidationSpec(nextSpec);
      void loadValidationSpec();
    },
    [getHeaderRowIndexForValidation, loadValidationSpec, saveValidationSpec, setEditingValidationSpec]
  );

  const commitWithSheetRules = useCallback(
    async (
      base: ValidationSpec,
      next: {
        columns?: ValidationSpec["columns"];
        sheetRules?: ValidationSpec["sheetRules"];
      }
    ) => {
      const headerRowIndex = getHeaderRowIndexForValidation();
      const nextSpec: ValidationSpec = {
        ...base,
        columns: next.columns ?? base.columns,
        sheetRules: next.sheetRules,
        options: {
          ...base.options,
          headerRowIndex,
        },
      };

      setEditingValidationSpec(nextSpec);
      await saveValidationSpec(nextSpec);
      void loadValidationSpec();
    },
    [getHeaderRowIndexForValidation, loadValidationSpec, saveValidationSpec, setEditingValidationSpec]
  );

  const commitWithRowRules = useCallback(
    async (
      base: ValidationSpec,
      next: {
        columns?: ValidationSpec["columns"];
        sheetRules?: ValidationSpec["sheetRules"];
        rowRules?: ValidationSpec["rowRules"];
      }
    ) => {
      const headerRowIndex = getHeaderRowIndexForValidation();
      const nextSpec: ValidationSpec = {
        ...base,
        columns: next.columns ?? base.columns,
        sheetRules: next.sheetRules ?? base.sheetRules,
        rowRules: next.rowRules,
        options: {
          ...base.options,
          headerRowIndex,
        },
      };

      setEditingValidationSpec(nextSpec);
      await saveValidationSpec(nextSpec);
      void loadValidationSpec();
    },
    [getHeaderRowIndexForValidation, loadValidationSpec, saveValidationSpec, setEditingValidationSpec]
  );

  const stageWithRowRules = useCallback(
    (
      base: ValidationSpec,
      next: {
        columns?: ValidationSpec["columns"];
        sheetRules?: ValidationSpec["sheetRules"];
        rowRules?: ValidationSpec["rowRules"];
      }
    ) => {
      const headerRowIndex = getHeaderRowIndexForValidation();
      const nextSpec: ValidationSpec = {
        ...base,
        columns: next.columns ?? base.columns,
        sheetRules: next.sheetRules ?? base.sheetRules,
        rowRules: next.rowRules,
        options: {
          ...base.options,
          headerRowIndex,
        },
      };

      setEditingValidationSpec(nextSpec);
    },
    [getHeaderRowIndexForValidation, setEditingValidationSpec]
  );

  const stageRowRules = useCallback(
    (rowRules: ValidationSpec["rowRules"]) => {
      const base = getBaseSpec();
      stageWithRowRules(base, { rowRules: rowRules ?? [] });
    },
    [getBaseSpec, stageWithRowRules]
  );

  const upsertRowRule = useCallback(
    <TRule extends NonNullable<ValidationSpec["rowRules"]>[number]>(
      base: ValidationSpec,
      ruleId: TRule["id"],
      rule: TRule | null
    ): ValidationSpec["rowRules"] => {
      const current = (base.rowRules ?? []).map((r) => ({ ...r })) as NonNullable<ValidationSpec["rowRules"]>;
      const without = current.filter((r) => r.id !== ruleId);
      const nextRules = rule ? ([rule, ...without] satisfies typeof current) : without;
      return nextRules;
    },
    []
  );

  const updateDenyTupleRowRule = useCallback(
    async (input: {
      enabled: boolean;
      entries: Array<{ keys: string[]; deniedTuples: string[][] }>;
    }) => {
      const base = getBaseSpec();

      const entries = (input.entries ?? [])
        .map((e) => {
          const keys = (e.keys ?? []).map((k) => k.trim()).filter((k) => k !== "");
          const deniedTuples = (e.deniedTuples ?? [])
            .map((t) => t.map((v) => (v ?? "").toString()))
            .filter((t) => t.length === keys.length)
            .filter((t) => t.some((v) => v !== ""));
          return { keys, deniedTuples };
        })
        .filter((e) => e.keys.length > 0 && e.deniedTuples.length > 0);

      const enableRule = input.enabled && entries.length > 0;

      const nextRowRules = upsertRowRule(
        base,
        "denyTuple",
        enableRule
          ? ({
              id: "denyTuple",
              entries,
            } as const)
          : null
      );

      await commitWithRowRules(base, { rowRules: nextRowRules });
    },
    [commitWithRowRules, getBaseSpec, upsertRowRule]
  );

  const stageDenyTupleRowRule = useCallback(
    (input: {
      enabled: boolean;
      entries: Array<{ keys: string[]; deniedTuples: string[][] }>;
    }) => {
      const base = getBaseSpec();

      const entries = (input.entries ?? [])
        .map((e) => {
          const keys = (e.keys ?? []).map((k) => k.trim()).filter((k) => k !== "");
          const deniedTuples = (e.deniedTuples ?? [])
            .map((t) => t.map((v) => (v ?? "").toString()))
            .filter((t) => t.length === keys.length)
            .filter((t) => t.some((v) => v !== ""));
          return { keys, deniedTuples };
        })
        .filter((e) => e.keys.length > 0 && e.deniedTuples.length > 0);

      const enableRule = input.enabled && entries.length > 0;

      const nextRowRules = upsertRowRule(
        base,
        "denyTuple",
        enableRule
          ? ({
              id: "denyTuple",
              entries,
            } as const)
          : null
      );

      stageWithRowRules(base, { rowRules: nextRowRules });
    },
    [getBaseSpec, stageWithRowRules, upsertRowRule]
  );

  const upsertSheetRule = useCallback(
    <TRule extends NonNullable<ValidationSpec["sheetRules"]>[number]>(
      base: ValidationSpec,
      ruleId: TRule["id"],
      rule: TRule | null
    ): ValidationSpec["sheetRules"] => {
      const current = (base.sheetRules ?? []).map((r) => ({ ...r })) as NonNullable<ValidationSpec["sheetRules"]>;
      const without = current.filter((r) => r.id !== ruleId);
      const nextRules = rule ? ([rule, ...without] satisfies typeof current) : without;
      return nextRules;
    },
    []
  );

  const upsertRuleForColumn = useCallback(
    <TRule extends ValidationSpec["columns"][number]["rules"][number]>(
      base: ValidationSpec,
      colKey: string,
      ruleId: TRule["id"],
      rule: TRule | null
    ): ValidationSpec["columns"] => {
      const nextColumns = base.columns.map((c) => ({ colKey: c.colKey, rules: [...c.rules] })) as ValidationSpec["columns"];
      const idx = nextColumns.findIndex((c) => c.colKey === colKey);

      if (idx === -1) {
        if (rule) nextColumns.push({ colKey, rules: [rule] });
        return nextColumns;
      }

      const rulesWithout = nextColumns[idx].rules.filter((r) => r.id !== ruleId);
      const nextRules = rule
        ? ([rule, ...rulesWithout] satisfies typeof nextColumns[number]["rules"])
        : rulesWithout;

      if (nextRules.length === 0) nextColumns.splice(idx, 1);
      else nextColumns[idx] = { ...nextColumns[idx], rules: nextRules };

      return nextColumns;
    },
    []
  );

  const updateRequiredForColumn = useCallback(
    async (colKey: string, enabled: boolean) => {
      if (!colKey) return;

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "required",
        enabled ? ({ id: "required", trim: true } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateUniqueForColumn = useCallback(
    async (colKey: string, enabled: boolean) => {
      if (!colKey) return;

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(base, colKey, "unique", enabled ? ({ id: "unique" } as const) : null);
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateEnumForColumn = useCallback(
    async (colKey: string, enabled: boolean, values: string[]) => {
      if (!colKey) return;

      const normalizedValues = values.map((v) => v.trim()).filter((v) => v !== "");
      const enableRule = enabled && normalizedValues.length > 0;

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "enum",
        enableRule
          ? ({
              id: "enum",
              values: normalizedValues,
              trim: true,
              caseSensitive: false,
            } as const)
          : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateBooleanValuesForColumn = useCallback(
    async (colKey: string, enabled: boolean, trueValue: string, falseValue: string) => {
      if (!colKey) return;

      const normalizedTrue = trueValue.trim();
      const normalizedFalse = falseValue.trim();
      const enableRule = enabled && normalizedTrue !== "" && normalizedFalse !== "";

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "boolean",
        enableRule
          ? ({
              id: "boolean",
              trueValue: normalizedTrue,
              falseValue: normalizedFalse,
              trim: true,
              caseSensitive: true,
            } as const)
          : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateForbiddenCharsForColumn = useCallback(
    async (colKey: string, enabled: boolean, chars: string[]) => {
      if (!colKey) return;

      const normalized = chars.map((c) => c.trim()).filter((c) => c !== "");
      const enableRule = enabled && normalized.length > 0;

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "forbiddenChars",
        enableRule ? ({ id: "forbiddenChars", chars: normalized } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateForbiddenCharsForSheet = useCallback(
    async (enabled: boolean, chars: string[]) => {
      const normalized = chars.map((c) => c.trim()).filter((c) => c !== "");
      const enableRule = enabled && normalized.length > 0;

      const base = getBaseSpec();
      const nextSheetRules = upsertSheetRule(
        base,
        "forbiddenChars",
        enableRule ? ({ id: "forbiddenChars", chars: normalized, appliesTo: "allCells" } as const) : null
      );

      await commitWithSheetRules(base, { sheetRules: nextSheetRules });
    },
    [commitWithSheetRules, getBaseSpec, upsertSheetRule]
  );

  const updatePhoneHyphenModeForColumn = useCallback(
    async (colKey: string, mode: "any" | "required" | "forbidden") => {
      if (!colKey) return;

      const enableRule = mode !== "any";

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "phoneHyphen",
        enableRule ? ({ id: "phoneHyphen", mode } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updatePhoneDigitsMinLengthForColumn = useCallback(
    async (colKey: string, enabled: boolean, value: number | null) => {
      if (!colKey) return;

      const enableRule = enabled && value !== null && Number.isFinite(value) && value >= 1;

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "phoneDigitsMinLength",
        enableRule ? ({ id: "phoneDigitsMinLength", value: value! } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updatePhoneDigitsMaxLengthForColumn = useCallback(
    async (colKey: string, enabled: boolean, value: number | null) => {
      if (!colKey) return;

      const enableRule = enabled && value !== null && Number.isFinite(value) && value >= 1;

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "phoneDigitsMaxLength",
        enableRule ? ({ id: "phoneDigitsMaxLength", value: value! } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateThousandsSeparatorAllowedForColumn = useCallback(
    async (colKey: string, allowed: boolean) => {
      if (!colKey) return;

      const shouldHaveRule = !allowed;

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "thousandsSeparator",
        shouldHaveRule ? ({ id: "thousandsSeparator", allow: false } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateMinValueForColumn = useCallback(
    async (colKey: string, enabled: boolean, value: number | null) => {
      if (!colKey) return;

      const enableRule = enabled && value !== null && Number.isFinite(value);

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "minValue",
        enableRule ? ({ id: "minValue", value: value! } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateMaxValueForColumn = useCallback(
    async (colKey: string, enabled: boolean, value: number | null) => {
      if (!colKey) return;

      const enableRule = enabled && value !== null && Number.isFinite(value);

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "maxValue",
        enableRule ? ({ id: "maxValue", value: value! } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateMinLengthForColumn = useCallback(
    async (colKey: string, enabled: boolean, value: number | null) => {
      if (!colKey) return;

      const enableRule = enabled && value !== null && Number.isFinite(value) && value >= 1;

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "minLength",
        enableRule ? ({ id: "minLength", value: value! } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateMaxLengthForColumn = useCallback(
    async (colKey: string, enabled: boolean, value: number | null) => {
      if (!colKey) return;

      const enableRule = enabled && value !== null && Number.isFinite(value) && value >= 1;

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "maxLength",
        enableRule ? ({ id: "maxLength", value: value! } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updatePatternForColumn = useCallback(
    async (colKey: string, enabled: boolean, pattern: string) => {
      if (!colKey) return;

      const normalized = pattern.trim();
      const enableRule = enabled && normalized.length > 0;

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "pattern",
        enableRule ? ({ id: "pattern", pattern: normalized } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateDateFormatForColumn = useCallback(
    async (
      colKey: string,
      format: "none" | "strict" | "yyyymmdd" | "yyyy-mm-dd" | "yyyy/mm/dd" | "yyyy年m月d日"
    ) => {
      if (!colKey) return;

      const enableRule = format !== "none";

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "date",
        enableRule ? ({ id: "date", format: format === "strict" ? "strict" : format } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateTimeFormatForColumn = useCallback(
    async (colKey: string, format: "none" | "strict" | "h:mm" | "hh:mm" | "h:mm:ss" | "hh:mm:ss") => {
      if (!colKey) return;

      const enableRule = format !== "none";

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "time",
        enableRule ? ({ id: "time", format: format === "strict" ? "strict" : format } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  const updateDatetimeFormatForColumn = useCallback(
    async (
      colKey: string,
      format:
        | "none"
        | "strict"
        | "yyyymmddhhmmss"
        | "yyyy-mm-dd hh:mm"
        | "yyyy-mm-dd hh:mm:ss"
        | "yyyy/mm/dd hh:mm"
        | "yyyy/mm/dd hh:mm:ss"
        | "yyyy年m月d日 hh:mm"
        | "yyyy年m月d日 hh:mm:ss"
    ) => {
      if (!colKey) return;

      const enableRule = format !== "none";

      const base = getBaseSpec();
      const nextColumns = upsertRuleForColumn(
        base,
        colKey,
        "datetime",
        enableRule ? ({ id: "datetime", format: format === "strict" ? "strict" : format } as const) : null
      );
      await commit(base, nextColumns);
    },
    [commit, getBaseSpec, upsertRuleForColumn]
  );

  return {
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
    updateDenyTupleRowRule,
    stageDenyTupleRowRule,
    stageRowRules,
  };
}
