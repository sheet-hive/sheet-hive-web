"use client";

import { Timestamp } from "firebase/firestore";

import type {
  SheetMappingRepo,
  SheetMappingRepoKey,
  SyncLogRepo,
  SyncLogRepoKey,
  TransformedDataRepo,
  TransformedDataRepoKey,
  ValidationSpecRepo,
  ValidationSpecRepoKey,
  ValidationSpecTemplateRepo,
  ValidationSpecTemplate,
} from "@shared/repos";
import type { SheetMapping } from "@shared/types/mapping";
import type { TransformedDataMeta, TransformedDataRecord } from "@shared/types/transformedData";
import type { SyncLog } from "@shared/types/syncLog";
import type { ValidationSpec } from "@shared/mapping";

import { setDemoState, getDemoState } from "@/demo/demoStore";

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function mappingKey(key: SheetMappingRepoKey, mappingId: string): string {
  return JSON.stringify({ ...key, mappingId: mappingId || "default" });
}

function tryParseJsonKey(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function specKey(key: ValidationSpecRepoKey, specId: string): string {
  return JSON.stringify({ ...key, specId: specId || "default" });
}

function transformedIndexKey(key: TransformedDataRepoKey): string {
  return JSON.stringify(key);
}

function transformedDataKey(key: TransformedDataRepoKey, metaId: string): string {
  return JSON.stringify({ ...key, metaId });
}

function syncLogKey(key: SyncLogRepoKey): string {
  return JSON.stringify(key);
}

export function createDemoSheetMappingRepo(): SheetMappingRepo<Timestamp> {
  return {
    get: async ({ key, mappingId }) => {
      const state = getDemoState();
      const raw = state.mappings[mappingKey(key, mappingId)];
      return (raw as SheetMapping<Timestamp> | undefined) ?? null;
    },

    save: async ({ key, mappingId, mapping }) => {
      setDemoState((prev) => ({
        ...prev,
        mappings: {
          ...prev.mappings,
          [mappingKey(key, mappingId)]: mapping,
        },
      }));
    },

    deleteAll: async ({ key }) => {
      setDemoState((prev) => {
        const next: typeof prev.mappings = {};
        for (const [k, v] of Object.entries(prev.mappings)) {
          const parsed = tryParseJsonKey(k);
          const sheetId = parsed?.sheetId;
          if (sheetId !== key.sheetId) next[k] = v;
        }
        return { ...prev, mappings: next };
      });
    },
  };
}

export function createDemoValidationSpecRepo(): ValidationSpecRepo {
  return {
    get: async ({ key, specId }) => {
      const state = getDemoState();
      const raw = state.validationSpecs[specKey(key, specId)];
      return (raw as ValidationSpec | undefined) ?? null;
    },

    save: async ({ key, specId, spec }) => {
      setDemoState((prev) => ({
        ...prev,
        validationSpecs: {
          ...prev.validationSpecs,
          [specKey(key, specId)]: spec,
        },
      }));
    },

    deleteAll: async ({ key }) => {
      setDemoState((prev) => {
        const next: typeof prev.validationSpecs = {};
        for (const [k, v] of Object.entries(prev.validationSpecs)) {
          const parsed = tryParseJsonKey(k);
          const sheetId = parsed?.sheetId;
          if (sheetId !== key.sheetId) next[k] = v;
        }
        return { ...prev, validationSpecs: next };
      });
    },
  };
}

export function createDemoValidationSpecTemplateRepo(): ValidationSpecTemplateRepo {
  return {
    list: async ({ userId, limit }) => {
      const state = getDemoState();
      const all = Object.entries(state.validationSpecTemplates)
        .map(([templateId, raw]) => ({ templateId, raw }))
        .map(({ templateId, raw }) => ({ templateId, ...(raw as Omit<ValidationSpecTemplate, "templateId">) }))
        .filter((t) => (t as ValidationSpecTemplate).templateId && (t as ValidationSpecTemplate).name);

      // demoでは userId によるスコープ分離は行わず、保存されたものをそのまま返す
      const sliced = typeof limit === "number" ? all.slice(0, limit) : all;
      void userId;
      return sliced as ValidationSpecTemplate[];
    },

    save: async ({ userId, templateId, name, schemaSignature, headerKeys, spec, mapping }) => {
      const id = templateId && templateId.trim() !== "" ? templateId : `${userId}:${makeId("tpl")}`;
      const value: Omit<ValidationSpecTemplate, "templateId"> = {
        name,
        schemaSignature,
        headerKeys,
        spec,
        ...(mapping ? { mapping } : {}),
      };

      setDemoState((prev) => ({
        ...prev,
        validationSpecTemplates: {
          ...prev.validationSpecTemplates,
          [id]: value,
        },
      }));

      return { templateId: id };
    },

    get: async ({ templateId }) => {
      const state = getDemoState();
      const raw = state.validationSpecTemplates[templateId];
      if (!raw) return null;
      return { templateId, ...(raw as Omit<ValidationSpecTemplate, "templateId">) };
    },
  };
}

export function createDemoTransformedDataRepo(): TransformedDataRepo<Timestamp> {
  return {
    saveMetaAndRecords: async ({ key, meta, records }) => {
      const metaId = makeId("meta");
      const metaWithId: TransformedDataMeta<Timestamp> = { ...meta, id: metaId };
      const recordsWithId: TransformedDataRecord<Timestamp>[] = records.map((r) => ({
        ...r,
        id: r.id ?? makeId("rec"),
      }));

      setDemoState((prev) => {
        const idxKey = transformedIndexKey(key);
        const nextIndex = [metaId, ...(prev.transformedMetaIndex[idxKey] ?? [])];
        return {
          ...prev,
          transformedData: {
            ...prev.transformedData,
            [transformedDataKey(key, metaId)]: { meta: metaWithId, records: recordsWithId },
          },
          transformedMetaIndex: {
            ...prev.transformedMetaIndex,
            [idxKey]: nextIndex,
          },
        };
      });

      return { metaId };
    },

    getLatestMeta: async ({ key }) => {
      const state = getDemoState();
      const idxKey = transformedIndexKey(key);
      const metaId = (state.transformedMetaIndex[idxKey] ?? [])[0];
      if (!metaId) return null;
      const raw = state.transformedData[transformedDataKey(key, metaId)] as { meta?: unknown } | undefined;
      return (raw?.meta as TransformedDataMeta<Timestamp> | undefined) ?? null;
    },

    getHistory: async ({ key, limitCount = 10 }) => {
      const state = getDemoState();
      const idxKey = transformedIndexKey(key);
      const ids = (state.transformedMetaIndex[idxKey] ?? []).slice(0, limitCount);
      const out: Array<TransformedDataMeta<Timestamp>> = [];
      for (const metaId of ids) {
        const raw = state.transformedData[transformedDataKey(key, metaId)] as { meta?: unknown } | undefined;
        const meta = raw?.meta as TransformedDataMeta<Timestamp> | undefined;
        if (meta) out.push(meta);
      }
      return out;
    },

    getRecords: async ({ key, metaId, limitCount = 100 }) => {
      const state = getDemoState();
      const raw = state.transformedData[transformedDataKey(key, metaId)] as { records?: unknown } | undefined;
      const records = (raw?.records as TransformedDataRecord<Timestamp>[] | undefined) ?? [];
      return records.slice(0, limitCount);
    },
  };
}

export function createDemoSyncLogRepo(): SyncLogRepo<Timestamp> {
  return {
    upsert: async ({ key, log }) => {
      setDemoState((prev) => {
        const k = syncLogKey(key);
        const list = (prev.syncLogs[k] as SyncLog<Timestamp>[] | undefined) ?? [];
        const id = log.id ?? makeId("sync");
        const nextLog: SyncLog<Timestamp> = { ...log, id };

        const nextList = list.some((x) => x.id === id) ? list.map((x) => (x.id === id ? nextLog : x)) : [nextLog, ...list];
        return {
          ...prev,
          syncLogs: {
            ...prev.syncLogs,
            [k]: nextList,
          },
        };
      });
    },

    list: async ({ key, limitCount = 5 }) => {
      const state = getDemoState();
      const list = (state.syncLogs[syncLogKey(key)] as SyncLog<Timestamp>[] | undefined) ?? [];
      return list.slice(0, limitCount);
    },
  };
}
