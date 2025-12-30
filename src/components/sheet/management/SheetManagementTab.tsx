"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";

import { db } from "@/lib/firebase";
import {
  createFirestoreSheetMappingRepo,
  createFirestoreValidationSpecRepo,
  createFirestoreValidationSpecTemplateRepo,
} from "@/lib/repos";
import type { SheetData } from "@/lib/sheets";
import type { SheetMapping } from "@/models/mapping";
import {
  computeSchemaSignature,
  normalizeHeaderKey,
  type ValidationSpec,
} from "@shared/mapping";

type Props = {
  user: User | null;
  projectId: string;
  folderId: string;
  sheetId: string;
  selectedSheet: string;

  sheetData: SheetData | null;
  loading: boolean;
  mapping: SheetMapping | null;
  onSaveMapping?: (mapping: SheetMapping) => Promise<void>;
};

export default function SheetManagementTab(props: Props) {
  const { user, projectId, folderId, sheetId, selectedSheet, sheetData, loading, mapping, onSaveMapping } = props;

  const validationSpecRepo = useMemo(() => createFirestoreValidationSpecRepo(db), []);
  const validationSpecTemplateRepo = useMemo(() => createFirestoreValidationSpecTemplateRepo(db), []);
  const sheetMappingRepo = useMemo(() => createFirestoreSheetMappingRepo(db), []);

  const isRecord = useCallback((v: unknown): v is Record<string, unknown> => {
    return typeof v === "object" && v !== null;
  }, []);

  const [currentSpec, setCurrentSpec] = useState<ValidationSpec | null>(null);
  const [loadingSpec, setLoadingSpec] = useState(false);

  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<
    Array<{ templateId: string; name: string; spec: ValidationSpec; mapping?: SheetMapping; headerKeys: string[] }>
  >([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const headerRowIndex = useMemo(() => {
    return currentSpec?.options?.headerRowIndex ?? mapping?.headerRowIndex ?? 0;
  }, [currentSpec?.options?.headerRowIndex, mapping?.headerRowIndex]);

  const sheetHeaderKeys = useMemo((): string[] => {
    const header = sheetData?.values?.[headerRowIndex] ?? [];
    const keys = header
      .map((v) => (v ?? "").toString().trim())
      .filter((v) => v !== "");
    return Array.from(new Set(keys));
  }, [sheetData?.values, headerRowIndex]);

  const currentHeaderKeyByNormalized = useMemo(() => {
    const map = new Map<string, { key: string; index: number }>();
    const header = sheetData?.values?.[headerRowIndex] ?? [];
    for (let i = 0; i < header.length; i++) {
      const raw = (header[i] ?? "").toString().trim();
      if (!raw) continue;
      const n = normalizeHeaderKey(raw);
      if (!map.has(n)) map.set(n, { key: raw, index: i });
    }
    return map;
  }, [headerRowIndex, sheetData?.values]);

  const schemaSignature = useMemo(() => {
    return computeSchemaSignature(sheetHeaderKeys);
  }, [sheetHeaderKeys]);

  const loadCurrentSpec = useCallback(async () => {
    if (!user) return;
    setLoadingSpec(true);
    try {
      const spec = await validationSpecRepo.get({
        key: { userId: user.uid, projectId, folderId, sheetId },
        specId: selectedSheet || "default",
      });
      setCurrentSpec(spec);
    } catch (e) {
      console.error("Failed to load validation spec:", e);
      setCurrentSpec(null);
    } finally {
      setLoadingSpec(false);
    }
  }, [folderId, projectId, selectedSheet, sheetId, user, validationSpecRepo]);

  useEffect(() => {
    if (!user) return;
    void loadCurrentSpec();
  }, [user, loadCurrentSpec]);

  const loadTemplates = useCallback(async () => {
    if (!user) return;
    setLoadingTemplates(true);
    try {
      const list = await validationSpecTemplateRepo.list({ userId: user.uid, limit: 200 });

      const ranked = list
        .map((t) => {
          const templateKeys = (t.headerKeys ?? []).map((k) => normalizeHeaderKey(k)).filter((k) => k !== "");
          const uniqueTemplateKeys = Array.from(new Set(templateKeys));
          const matched = uniqueTemplateKeys.filter((k) => currentHeaderKeyByNormalized.has(k)).length;
          const total = uniqueTemplateKeys.length;
          const score = total > 0 ? matched / total : 0;
          return { t, matched, total, score };
        })
        .filter((x) => x.total === 0 || x.matched > 0)
        .sort((a, b) => b.score - a.score || b.matched - a.matched || a.t.name.localeCompare(b.t.name));

      const next = ranked.map(({ t }) => ({
        templateId: t.templateId,
        name: t.name,
        spec: t.spec,
        mapping: t.mapping as SheetMapping | undefined,
        headerKeys: t.headerKeys ?? [],
      }));

      setTemplates(next);
      setSelectedTemplateId((prev) => (prev && next.some((t) => t.templateId === prev) ? prev : ""));
    } catch (e) {
      console.error("Failed to load templates:", e);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, [currentHeaderKeyByNormalized, user, validationSpecTemplateRepo]);

  useEffect(() => {
    if (!user) return;
    void loadTemplates();
  }, [user, loadTemplates]);

  const saveCurrentSpec = useCallback(
    async (spec: ValidationSpec) => {
      if (!user) return;
      await validationSpecRepo.save({
        key: { userId: user.uid, projectId, folderId, sheetId },
        specId: selectedSheet || "default",
        spec,
      });
    },
    [folderId, projectId, selectedSheet, sheetId, user, validationSpecRepo]
  );

  const remapColKey = useCallback(
    (colKey: string): string | null => {
      const n = normalizeHeaderKey(colKey);
      const hit = currentHeaderKeyByNormalized.get(n);
      return hit?.key ?? null;
    },
    [currentHeaderKeyByNormalized]
  );

  const remapWhenCondition = useCallback(
    (when: unknown): Record<string, unknown> | null => {
      if (!isRecord(when)) return null;
      const colKey = typeof when.colKey === "string" ? when.colKey : "";
      const mapped = colKey ? remapColKey(colKey) : null;
      if (!mapped) return null;
      return { ...when, colKey: mapped };
    },
    [isRecord, remapColKey]
  );

  const projectTemplateSpecToCurrentHeader = useCallback(
    (templateSpec: ValidationSpec): ValidationSpec => {
      const projectedColumns = (templateSpec.columns ?? [])
        .map((c) => {
          const mapped = remapColKey(c.colKey);
          if (!mapped) return null;
          return { ...c, colKey: mapped };
        })
        .filter((v): v is NonNullable<typeof v> => !!v);

      const projectedRowRules = ((templateSpec as unknown as { rowRules?: unknown[] }).rowRules ?? [])
        .map((r: unknown) => {
          if (!isRecord(r) || typeof r.id !== "string") return null;
          const rule = r;

          if (rule.id === "requireWhen") {
            const when = remapWhenCondition(rule.when);
            const then = typeof rule.thenRequiredColKey === "string" ? remapColKey(rule.thenRequiredColKey) : null;
            if (!when || !then) return null;
            return { ...rule, when, thenRequiredColKey: then };
          }

          if (rule.id === "equalsWhen" || rule.id === "allowWhen" || rule.id === "disallowWhen") {
            const when = remapWhenCondition(rule.when);
            const then = typeof rule.thenColKey === "string" ? remapColKey(rule.thenColKey) : null;
            if (!when || !then) return null;
            return { ...rule, when, thenColKey: then };
          }

          if (rule.id === "numberRelation" || rule.id === "dateRelation" || rule.id === "timeRelation") {
            const base = typeof rule.baseColKey === "string" ? remapColKey(rule.baseColKey) : null;
            const target = typeof rule.targetColKey === "string" ? remapColKey(rule.targetColKey) : null;
            if (!base || !target) return null;
            return { ...rule, baseColKey: base, targetColKey: target };
          }

          if (rule.id === "denyTuple") {
            if (Array.isArray(rule.entries)) {
              const entries = rule.entries
                .map((e: unknown) => {
                  if (!isRecord(e)) return null;
                  const originalKeys = Array.isArray(e.keys) ? e.keys : [];
                  const mappedKeys = originalKeys
                    .filter((k): k is string => typeof k === "string")
                    .map((k) => remapColKey(k))
                    .filter((k): k is string => !!k);
                  if (mappedKeys.length === 0) return null;
                  if (mappedKeys.length !== originalKeys.length) return null;
                  return { ...e, keys: mappedKeys };
                })
                .filter((v) => v != null);

              if (entries.length === 0) return null;
              return { ...rule, entries };
            }

            if (Array.isArray(rule.keys)) {
              const originalKeys = rule.keys;
              const mappedKeys = originalKeys
                .filter((k): k is string => typeof k === "string")
                .map((k) => remapColKey(k))
                .filter((k): k is string => !!k);
              if (mappedKeys.length === 0) return null;
              if (mappedKeys.length !== originalKeys.length) return null;
              return { ...rule, keys: mappedKeys };
            }

            return null;
          }

          return rule;
        })
        .filter((v) => v != null);

      return {
        ...templateSpec,
        columns: projectedColumns,
        rowRules: projectedRowRules as ValidationSpec["rowRules"],
        options: {
          ...templateSpec.options,
          headerRowIndex,
        },
      };
    },
    [headerRowIndex, isRecord, remapColKey, remapWhenCondition]
  );

  const projectTemplateMappingToCurrentHeader = useCallback(
    (templateMapping: SheetMapping): SheetMapping => {
      const header = sheetData?.values?.[headerRowIndex] ?? [];
      const normToIndex = new Map<string, { index: number; columnName: string }>();
      for (let i = 0; i < header.length; i++) {
        const raw = (header[i] ?? "").toString().trim();
        if (!raw) continue;
        const n = normalizeHeaderKey(raw);
        if (!normToIndex.has(n)) normToIndex.set(n, { index: i, columnName: raw });
      }

      const nextFields = (templateMapping.fields ?? [])
        .map((f) => {
          const n = normalizeHeaderKey(f.columnName);
          const hit = normToIndex.get(n);
          if (!hit) return null;
          return { ...f, columnIndex: hit.index, columnName: hit.columnName };
        })
        .filter((v): v is NonNullable<typeof v> => !!v)
        .sort((a, b) => a.columnIndex - b.columnIndex);

      const nextHeaderRowIndex = templateMapping.headerRowIndex ?? headerRowIndex;
      const nextDataStartRowIndex = templateMapping.dataStartRowIndex ?? nextHeaderRowIndex + 1;

      return {
        ...templateMapping,
        sheetId,
        sheetName: selectedSheet,
        headerRowIndex: nextHeaderRowIndex,
        dataStartRowIndex: nextDataStartRowIndex,
        fields: nextFields,
      };
    },
    [headerRowIndex, selectedSheet, sheetData?.values, sheetId]
  );

  const handleSaveTemplate = useCallback(async () => {
    if (!user) return;
    const name = templateName.trim();
    if (!name) {
      alert("テンプレ名を入力してください");
      return;
    }
    if (!schemaSignature) {
      alert("ヘッダ（カラム構成）が取得できません");
      return;
    }

    if (!mapping) {
      alert("テンプレ保存にはマッピングが必要です（先にマッピングを作成してください）");
      return;
    }

    if (!currentSpec) {
      alert("テンプレ保存にはバリデーション設定（保存済み）が必要です");
      return;
    }

    try {
      await validationSpecTemplateRepo.save({
        userId: user.uid,
        name,
        schemaSignature,
        headerKeys: sheetHeaderKeys,
        spec: currentSpec,
        mapping,
      });
      setTemplateName("");
      await loadTemplates();
    } catch (e) {
      console.error("Failed to save template:", e);
      alert("テンプレ保存に失敗しました");
    }
  }, [currentSpec, loadTemplates, mapping, schemaSignature, sheetHeaderKeys, templateName, user, validationSpecTemplateRepo]);

  const handleApplyTemplate = useCallback(async () => {
    if (!selectedTemplateId) return;
    const found = templates.find((t) => t.templateId === selectedTemplateId);
    if (!found) return;

    if (!user) return;

    try {
      const projectedSpec = projectTemplateSpecToCurrentHeader(found.spec);
      await saveCurrentSpec(projectedSpec);
      await loadCurrentSpec();

      if (found.mapping) {
        const projectedMapping = projectTemplateMappingToCurrentHeader(found.mapping);
        if (onSaveMapping) {
          await onSaveMapping(projectedMapping);
        } else {
          await sheetMappingRepo.save({
            key: { userId: user.uid, projectId, folderId, sheetId },
            mappingId: selectedSheet || "default",
            mapping: projectedMapping,
          });
        }
      }

      alert("テンプレを適用して保存しました");
    } catch (e) {
      console.error("Failed to apply template:", e);
      alert("テンプレ適用（保存）に失敗しました");
    }
  }, [
    folderId,
    loadCurrentSpec,
    onSaveMapping,
    projectId,
    projectTemplateMappingToCurrentHeader,
    projectTemplateSpecToCurrentHeader,
    saveCurrentSpec,
    selectedSheet,
    selectedTemplateId,
    sheetId,
    sheetMappingRepo,
    templates,
    user,
  ]);

  const selectedTemplateMatchText = useMemo(() => {
    const t = templates.find((x) => x.templateId === selectedTemplateId);
    if (!t) return "";
    const templateKeys = (t.headerKeys ?? []).map((k) => normalizeHeaderKey(k)).filter((k) => k !== "");
    const uniq = Array.from(new Set(templateKeys));
    const matched = uniq.filter((k) => currentHeaderKeyByNormalized.has(k)).length;
    const total = uniq.length;
    return total > 0 ? `一致: ${matched}/${total}` : "";
  }, [currentHeaderKeyByNormalized, selectedTemplateId, templates]);

  return (
    <div className="space-y-6">
      <div className="p-6 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">管理</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          シート全体に関する操作を行います。
        </p>

        <div className="rounded border border-neutral-200 dark:border-neutral-800 p-3">
          <div className="text-sm font-medium mb-2">テンプレート設定</div>

          <div className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
            schema: {schemaSignature || "-"}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="rounded border border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-900">
              <div className="text-sm font-semibold mb-1">保存</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                現在のシート設定（マッピング＋バリデーション）をテンプレートとして保存します。
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-900"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="テンプレート名"
                />
                <button
                  className="px-3 py-1 text-sm rounded bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 disabled:opacity-50"
                  onClick={() => void handleSaveTemplate()}
                  disabled={!user || loadingTemplates || loadingSpec || loading}
                >
                  保存
                </button>
              </div>

              {!mapping && (
                <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                  ⚠️ テンプレートの保存にはマッピング設定が必要です。
                </div>
              )}

              {!currentSpec && !loadingSpec && (
                <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                  ⚠️ テンプレートの保存には、バリデーション設定（保存済み）が必要です。
                </div>
              )}
            </div>

            <div className="rounded border border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-900">
              <div className="text-sm font-semibold mb-1">読み込み</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                列名が一致するものだけ適用し、未知の列はそのまま残します。
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-900"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  disabled={loadingTemplates || templates.length === 0}
                >
                  <option value="">テンプレートを選択</option>
                  {templates.map((t) => {
                    const templateKeys = (t.headerKeys ?? []).map((k) => normalizeHeaderKey(k)).filter((k) => k !== "");
                    const uniq = Array.from(new Set(templateKeys));
                    const matched = uniq.filter((k) => currentHeaderKeyByNormalized.has(k)).length;
                    const total = uniq.length;
                    const label = total > 0 ? `${t.name}（一致: ${matched}/${total}）` : t.name;
                    return (
                      <option key={t.templateId} value={t.templateId}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <button
                  className="px-3 py-1 text-sm rounded border border-neutral-300 dark:border-neutral-700 disabled:opacity-50"
                  onClick={() => void handleApplyTemplate()}
                  disabled={!selectedTemplateId || loading || loadingSpec}
                >
                  適用
                </button>
              </div>

              {selectedTemplateMatchText && (
                <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{selectedTemplateMatchText}</div>
              )}

              {!mapping && (
                <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                  ⚠️ テンプレ適用にはマッピング設定が必要です。
                </div>
              )}
            </div>
          </div>

          {(loadingSpec || loadingTemplates) && (
            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              読み込み中...
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
