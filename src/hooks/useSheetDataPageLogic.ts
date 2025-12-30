"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import {
  fetchSheetData,
  fetchSheetMetadata,
  isTokenExpiredError,
  type SheetData,
  type SheetMetadata,
} from "@/lib/sheets";
import { inferDataType } from "@/lib/dataMapping";
import { executeDataPipeline, getLatestTransformedDataMeta, getTransformHistory } from "@/lib/dataPipeline";
import { executeSyncPipeline, getSyncLogs } from "@/lib/syncPipeline";
import { createFirestoreSheetMappingRepo } from "@/lib/repos";

import type { Project } from "@/models/project";
import type { Folder } from "@/models/folder";
import type { SheetMapping } from "@/models/mapping";
import type { TransformedDataMeta } from "@/models/transformedData";
import type { SyncLog } from "@/models/syncLog";

export type SheetDataPageTab = "data" | "mapping" | "validation" | "management" | "transform";

export type SheetDataPageTransformResult = {
  success: boolean;
  metaId: string;
  transformResult: {
    success: boolean;
    data: Record<string, string | number | Date | boolean | null>[];
    errors: Array<{
      rowIndex: number;
      columnIndex: number;
      fieldName: string;
      originalValue: string;
      expectedType: import("@/models/mapping").DataType;
      errorMessage: string;
    }>;
    totalRows: number;
    successRows: number;
    errorRows: number;
  };
  savedRecords: number;
  errorMessage?: string;
} | null;

function cloneSheetMapping(m: SheetMapping): SheetMapping {
  return {
    ...m,
    fields: m.fields.map((f) => ({ ...f })),
  };
}

export function useSheetDataPageLogic(input: { projectId: string; folderId: string; sheetId: string }) {
  const { projectId, folderId, sheetId } = input;
  const router = useRouter();

  const sheetMappingRepo = useMemo(() => createFirestoreSheetMappingRepo(db), []);

  const [user, setUser] = useState<User | null>(null);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [metadata, setMetadata] = useState<SheetMetadata | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSheet, setSelectedSheet] = useState("");
  const [range, setRange] = useState("");
  const [activeTab, setActiveTab] = useState<SheetDataPageTab>("data");

  const [mapping, setMapping] = useState<SheetMapping | null>(null);
  const [mappingDirty, setMappingDirty] = useState(false);
  const [mappingBaseline, setMappingBaseline] = useState<SheetMapping | null>(null);

  const [isTransforming, setIsTransforming] = useState(false);
  const [transformResult, setTransformResult] = useState<SheetDataPageTransformResult>(null);
  const [latestTransform, setLatestTransform] = useState<TransformedDataMeta | null>(null);
  const [transformHistory, setTransformHistory] = useState<TransformedDataMeta[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showSyncLogs, setShowSyncLogs] = useState(false);

  const [showUnsavedMappingDialog, setShowUnsavedMappingDialog] = useState(false);
  const [showMissingMappingAlert, setShowMissingMappingAlert] = useState(false);
  const [pendingTab, setPendingTab] = useState<SheetDataPageTab | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const requestTabChange = useCallback(
    (nextTab: SheetDataPageTab) => {
      if (nextTab === "validation" && !mapping) {
        setShowMissingMappingAlert(true);
        return;
      }
      if (!mappingDirty) {
        setActiveTab(nextTab);
        return;
      }
      if (nextTab === activeTab) return;
      setPendingTab(nextTab);
      setPendingHref(null);
      setShowUnsavedMappingDialog(true);
    },
    [activeTab, mapping, mappingDirty]
  );

  const requestNavigate = useCallback(
    (href: string) => {
      if (!mappingDirty) {
        router.push(href);
        return;
      }
      setPendingHref(href);
      setPendingTab(null);
      setShowUnsavedMappingDialog(true);
    },
    [mappingDirty, router]
  );

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!mappingDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [mappingDirty]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) router.replace("/login");
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const loadProjectAndFolder = async () => {
      try {
        const projectRef = doc(db, "users", user.uid, "projects", projectId);
        const projectSnap = await getDoc(projectRef);
        if (projectSnap.exists()) {
          setProject({ id: projectSnap.id, ...projectSnap.data() } as Project);
        }

        const folderRef = doc(db, "users", user.uid, "projects", projectId, "folders", folderId);
        const folderSnap = await getDoc(folderRef);
        if (folderSnap.exists()) {
          setFolder({ id: folderSnap.id, ...folderSnap.data() } as Folder);
        }
      } catch (err) {
        console.error("Failed to load project/folder:", err);
      }
    };

    loadProjectAndFolder();
  }, [user, projectId, folderId]);

  useEffect(() => {
    if (!user) return;

    const loadMetadata = async () => {
      try {
        const meta = await fetchSheetMetadata(sheetId);
        setMetadata(meta);
        if (meta.sheets && meta.sheets.length > 0) {
          setSelectedSheet(meta.sheets[0].title);
        } else {
          setSelectedSheet("Sheet1");
        }
      } catch (err) {
        console.error("Failed to load metadata:", err);
        setSelectedSheet("Sheet1");
      }
    };

    loadMetadata();
  }, [user, sheetId]);

  useEffect(() => {
    if (!user || !selectedSheet) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const rangeStr = range ? `${selectedSheet}!${range}` : selectedSheet;
        const data = await fetchSheetData(sheetId, rangeStr);
        setSheetData(data);
      } catch (err) {
        console.error("Failed to load sheet data:", err);
        if (err instanceof Error && isTokenExpiredError(err)) {
          await signOut(auth);
          router.replace("/login");
        } else {
          setError(err instanceof Error ? err.message : "データの取得に失敗しました");
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, sheetId, selectedSheet, range, router]);

  useEffect(() => {
    if (!user) return;

    const loadMapping = async () => {
      try {
        const key = { userId: user.uid, projectId, folderId, sheetId };
        const mappingId = selectedSheet || "default";

        const next = await sheetMappingRepo.get({ key, mappingId });
        if (!next) return;

        setMapping(cloneSheetMapping(next));
        setMappingBaseline(cloneSheetMapping(next));
        setMappingDirty(false);
      } catch (err) {
        console.error("Failed to load mapping:", err);
      }
    };

    if (selectedSheet) {
      loadMapping();
    }
  }, [user, projectId, folderId, sheetId, selectedSheet, sheetMappingRepo]);

  const handleSaveMapping = useCallback(
    async (newMapping: SheetMapping) => {
      if (!user) return;

      try {
        const key = { userId: user.uid, projectId, folderId, sheetId };
        const mappingId = selectedSheet || "default";
        await sheetMappingRepo.save({ key, mappingId, mapping: newMapping });
        setMapping(cloneSheetMapping(newMapping));
        setMappingBaseline(cloneSheetMapping(newMapping));
        setMappingDirty(false);
      } catch (err) {
        console.error("Failed to save mapping:", err);
        throw err;
      }
    },
    [user, projectId, folderId, sheetId, selectedSheet, sheetMappingRepo]
  );

  const discardMappingChanges = useCallback(() => {
    setMapping(mappingBaseline ? cloneSheetMapping(mappingBaseline) : null);
    setMappingDirty(false);
  }, [mappingBaseline]);

  const mergeNewColumnsIntoMapping = useCallback(
    (
      base: SheetMapping,
      data: string[][]
    ): { next: SheetMapping; addedCount: number; removedCount: number; updatedIndexCount: number } => {
      const norm = (v: unknown) => (v ?? "").toString().trim();
      const headerRowIndex = base.headerRowIndex ?? 0;
      const dataStartRowIndex = base.dataStartRowIndex ?? headerRowIndex + 1;

      const headers = data[headerRowIndex] ?? [];
      const dataRows = data.slice(dataStartRowIndex);

      const headerEntries = headers.map((h, idx) => {
        const raw = norm(h);
        const columnName = raw !== "" ? raw : `Column ${idx + 1}`;
        const fieldName = raw !== "" ? raw : `field_${idx}`;
        return { idx, columnName, fieldName };
      });

      const columnNameToIndex = new Map<string, number>();
      for (const e of headerEntries) {
        if (!columnNameToIndex.has(e.columnName)) columnNameToIndex.set(e.columnName, e.idx);
      }

      const existingColumnNamesInSheet = new Set(headerEntries.map((e) => e.columnName));
      const removedFields = base.fields.filter((f) => !existingColumnNamesInSheet.has(norm(f.columnName)));
      const keptFields = base.fields.filter((f) => existingColumnNamesInSheet.has(norm(f.columnName)));

      const existingColumnNames = new Set(keptFields.map((f) => f.columnName));

      let updatedIndexCount = 0;
      const updatedExistingFields = keptFields.map((f) => {
        const nextIndex = columnNameToIndex.get(norm(f.columnName));
        if (nextIndex === undefined) return f;
        if (f.columnIndex === nextIndex) return f;
        updatedIndexCount += 1;
        return { ...f, columnIndex: nextIndex };
      });

      const newFields: SheetMapping["fields"] = [];
      for (const e of headerEntries) {
        if (existingColumnNames.has(e.columnName)) continue;
        const columnData = dataRows.map((row) => (row?.[e.idx] ?? "").toString());
        const typeResult = inferDataType(columnData);

        newFields.push({
          columnIndex: e.idx,
          columnName: e.columnName,
          fieldName: e.fieldName,
          dataType: typeResult.dataType,
        });
      }

      const merged = [...updatedExistingFields, ...newFields].sort((a, b) => a.columnIndex - b.columnIndex);
      return {
        next: { ...base, fields: merged },
        addedCount: newFields.length,
        removedCount: removedFields.length,
        updatedIndexCount,
      };
    },
    []
  );

  const loadLatestTransform = useCallback(async () => {
    if (!user) return;
    try {
      const latest = await getLatestTransformedDataMeta(user.uid, projectId, folderId, sheetId);
      setLatestTransform(latest);
    } catch (error) {
      console.error("Failed to load latest transform:", error);
    }
  }, [user, projectId, folderId, sheetId]);

  const loadTransformHistory = useCallback(async () => {
    if (!user) return;
    try {
      const history = await getTransformHistory(user.uid, projectId, folderId, sheetId, 5);
      setTransformHistory(history);
    } catch (error) {
      console.error("Failed to load transform history:", error);
    }
  }, [user, projectId, folderId, sheetId]);

  useEffect(() => {
    if (activeTab === "transform" && user) {
      loadLatestTransform();
      loadTransformHistory();
    }
  }, [activeTab, user, loadLatestTransform, loadTransformHistory]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        const logs = await getSyncLogs(user.uid, projectId, folderId, sheetId, 5);
        if (!cancelled) setSyncLogs(logs);
      } catch (error) {
        console.error("Failed to load sync logs:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, projectId, folderId, sheetId]);

  const handleTransformData = useCallback(async () => {
    if (!user || !mapping) {
      alert("マッピング定義が必要です");
      return;
    }

    setIsTransforming(true);
    setTransformResult(null);

    try {
      const result = await executeDataPipeline(
        user.uid,
        projectId,
        folderId,
        sheetId,
        selectedSheet,
        { ...mapping, sheetId, sheetName: selectedSheet }
      );

      setTransformResult(result);

      if (result.success) {
        alert("データ変換・保存が完了しました");
        loadLatestTransform();
        loadTransformHistory();
      } else {
        alert(`データ変換でエラーが発生しました: ${result.errorMessage || "不明なエラー"}`);
      }
    } catch (error) {
      console.error("Transform failed:", error);
      alert("データ変換に失敗しました");
    } finally {
      setIsTransforming(false);
    }
  }, [user, mapping, projectId, folderId, sheetId, selectedSheet, loadLatestTransform, loadTransformHistory]);

  const handleSync = useCallback(async () => {
    if (!user || syncing) return;

    if (!mapping) {
      alert("マッピング定義が必要です。先に「マッピング設定」タブでマッピングを設定してください。");
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const rangeStr = range ? `${selectedSheet}!${range}` : selectedSheet;
      const latest = await fetchSheetData(sheetId, rangeStr);
      setSheetData(latest);

      const merged = mergeNewColumnsIntoMapping(mapping, latest.values ?? []);
      const hasMappingDiff = merged.addedCount > 0 || merged.removedCount > 0 || merged.updatedIndexCount > 0;
      if (hasMappingDiff) {
        setMapping(cloneSheetMapping(merged.next));
        setMappingDirty(true);
        setActiveTab("mapping");
        const parts: string[] = [];
        if (merged.addedCount > 0) parts.push(`追加: ${merged.addedCount}件`);
        if (merged.removedCount > 0) parts.push(`削除: ${merged.removedCount}件`);
        if (merged.updatedIndexCount > 0) parts.push(`列位置更新: ${merged.updatedIndexCount}件`);
        alert(`シートのカラム差分をマッピング設定に反映しました（${parts.join(" / ")}）。内容を確認して「保存」してください。`);
        return;
      }

      const result = await executeSyncPipeline(
        user.uid,
        projectId,
        folderId,
        sheetId,
        selectedSheet,
        { ...mapping, sheetId, sheetName: selectedSheet }
      );

      if (result.success) {
        const data = await fetchSheetData(sheetId, rangeStr);
        setSheetData(data);

        loadLatestTransform();
        loadTransformHistory();

        alert(`同期が完了しました（成功: ${result.recordsSuccess}/${result.recordsProcessed}件）`);
      } else {
        alert(`同期でエラーが発生しました: ${result.errorMessage || "不明なエラー"}`);
      }
    } catch (err) {
      console.error("Sync failed:", err);
      const errorMsg = err instanceof Error ? err.message : "同期に失敗しました";
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setSyncing(false);
    }
  }, [user, syncing, mapping, range, selectedSheet, sheetId, projectId, folderId, mergeNewColumnsIntoMapping, loadLatestTransform, loadTransformHistory]);

  const confirmDialogCancel = useCallback(() => {
    setShowUnsavedMappingDialog(false);
    setPendingTab(null);
    setPendingHref(null);
  }, []);

  const confirmDialogConfirm = useCallback(() => {
    setShowUnsavedMappingDialog(false);
    discardMappingChanges();
    const nextTab = pendingTab;
    const nextHref = pendingHref;
    setPendingTab(null);
    setPendingHref(null);
    if (nextHref) {
      router.push(nextHref);
      return;
    }
    if (nextTab) {
      setActiveTab(nextTab);
    }
  }, [discardMappingChanges, pendingHref, pendingTab, router]);

  const isInitialLoading = !user || (loading && !sheetData) || !project || !folder;

  return {
    // derived
    isInitialLoading,

    // ids
    projectId,
    folderId,
    sheetId,

    // auth/entity
    user,
    project,
    folder,

    // sheets
    metadata,
    sheetData,
    loading,
    error,
    selectedSheet,
    setSelectedSheet,
    range,
    setRange,

    // tabs
    activeTab,
    requestTabChange,

    // mapping
    mapping,
    mappingDirty,
    setMappingDirty,
    handleSaveMapping,

    // transform
    isTransforming,
    transformResult,
    latestTransform,
    transformHistory,
    handleTransformData,

    // sync
    syncing,
    handleSync,
    syncLogs,
    showSyncLogs,
    setShowSyncLogs,

    // dialogs
    showUnsavedMappingDialog,
    showMissingMappingAlert,
    setShowMissingMappingAlert,
    requestNavigate,
    confirmDialogCancel,
    confirmDialogConfirm,
  };
}
