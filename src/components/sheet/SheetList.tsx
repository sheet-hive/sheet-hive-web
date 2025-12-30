"use client";
import React, { useMemo, useState } from "react";
import { type User } from "firebase/auth";
import { db } from "../../lib/firebase";
import ConfirmDialog from "../common/ConfirmDialog";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { Sheet } from "@/models/sheet";
import { fetchSheetMetadata, isTokenExpiredError } from "@/lib/sheets";
import { createFirestoreSheetMappingRepo } from "@/lib/repos";
import { createFirestoreValidationSpecRepo } from "@/lib/repos";

type SheetListProps = {
  user: User | null;
  sheets: Sheet[];
  loading: boolean;
  projectId?: string;
  folderId?: string;
};

type ViewMode = "list" | "grid";
type SortKey = "title" | "addedAt";

export default function SheetList({ user, sheets, loading, projectId, folderId }: SheetListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("addedAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const sheetMappingRepo = useMemo(() => createFirestoreSheetMappingRepo(db), [db]);
  const validationSpecRepo = useMemo(() => createFirestoreValidationSpecRepo(db), [db]);

  const deleteAllDocsInSubcollection = async (parentRef: DocumentReference, subcollectionName: string) => {
    // Firestoreは親doc削除でもサブコレクションが残るため、明示的に削除する
    // 500件ずつバッチ削除（web SDKの上限に合わせる）
    while (true) {
      const colRef = collection(parentRef, subcollectionName);
      const snap = await getDocs(query(colRef, limit(500)));
      if (snap.empty) return;

      const batch = writeBatch(db);
      for (const d of snap.docs) batch.delete(d.ref);
      await batch.commit();
    }
  };

  const deleteSheetRelatedData = async (sheetDocRef: DocumentReference, sheetId: string) => {
    // ここで管理しているサブコレクション（現状の実装で確実に存在し得るもの）
    if (user) {
      await sheetMappingRepo.deleteAll({
        key: {
          userId: user.uid,
          projectId,
          folderId,
          sheetId,
        },
      });

      await validationSpecRepo.deleteAll({
        key: {
          userId: user.uid,
          projectId,
          folderId,
          sheetId,
        },
      });
    }
    await deleteAllDocsInSubcollection(sheetDocRef, "syncLogs");
    await deleteAllDocsInSubcollection(sheetDocRef, "transformedData");
  };

  const removeSheet = async (id: string) => {
    if (!user) return;
    const ref = projectId && folderId
      ? doc(db, "users", user.uid, "projects", projectId, "folders", folderId, "sheets", id)
      : doc(db, "users", user.uid, "sheets", id);
    try {
      // 先に関連データを削除（親doc削除だけではサブコレクションが残る）
      await deleteSheetRelatedData(ref, id);
      await deleteDoc(ref);
    } catch (err) {
      console.error(err);
      alert("削除に失敗しました");
    }
  };

  const requestDeleteSheet = (id: string) => {
    setPendingDeleteId(id);
    setConfirmDeleteOpen(true);
  };

  const refreshMetadata = async (sheet: Sheet) => {
    if (!user || !sheet.id) return;
    
    setRefreshingIds(prev => new Set(prev).add(sheet.id!));

    const ref = projectId && folderId
      ? doc(db, "users", user.uid, "projects", projectId, "folders", folderId, "sheets", sheet.id)
      : doc(db, "users", user.uid, "sheets", sheet.id);

    try {
      const metadata = await fetchSheetMetadata(sheet.sheetId);
      await updateDoc(ref, {
        title: metadata.title ?? null,
        sheetCount: metadata.sheetCount ?? 0,
        lastFetched: new Date(),
        isAccessible: true,
        lastError: null,
      });
    } catch (err) {
      console.error(err);
      
      // トークン期限切れの場合は特別に処理
      if (err instanceof Error && isTokenExpiredError(err)) {
        alert("アクセストークンの有効期限が切れました。一度サインアウトして、再度サインインしてください。");
        return;
      }
      
      await updateDoc(ref, {
        isAccessible: false,
        lastError: err instanceof Error ? err.message : "メタデータの取得に失敗しました",
        lastFetched: new Date(),
      });
    } finally {
      setRefreshingIds(prev => {
        const next = new Set(prev);
        next.delete(sheet.id!);
        return next;
      });
    }
  };

  // ソート済みのシート一覧を取得
  const sortedSheets = [...sheets].sort((a, b) => {
    if (sortKey === "title") {
      const aVal = (a.title ?? a.url ?? a.sheetId ?? "").toLowerCase();
      const bVal = (b.title ?? b.url ?? b.sheetId ?? "").toLowerCase();
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    } else {
      // addedAt でソート (Timestamp の場合)
      const aTime = a.addedAt?.seconds ?? 0;
      const bTime = b.addedAt?.seconds ?? 0;
      return sortAsc ? aTime - bTime : bTime - aTime;
    }
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div className="max-w-2xl p-6 bg-white dark:bg-neutral-900 text-black dark:text-white rounded shadow-lg">
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="削除確認"
        message={"シートを削除します。\n削除するとマッピング設定、バリデーション設定も消去されますがよろしいですか？"}
        okText="削除"
        cancelText="キャンセル"
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setPendingDeleteId(null);
        }}
        onConfirm={async () => {
          const id = pendingDeleteId;
          setConfirmDeleteOpen(false);
          setPendingDeleteId(null);
          if (!id) return;
          await removeSheet(id);
        }}
      />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleSort("title")}
            className={`px-3 py-1 text-sm rounded ${
              sortKey === "title"
                ? "bg-blue-600 text-white"
                : "bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white"
            }`}
          >
            タイトル {sortKey === "title" && (sortAsc ? "↑" : "↓")}
          </button>
          <button
            onClick={() => toggleSort("addedAt")}
            className={`px-3 py-1 text-sm rounded ${
              sortKey === "addedAt"
                ? "bg-blue-600 text-white"
                : "bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white"
            }`}
          >
            追加日 {sortKey === "addedAt" && (sortAsc ? "↑" : "↓")}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === "list"
                ? "bg-blue-600 text-white"
                : "bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white"
            }`}
          >
            リスト
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === "grid"
                ? "bg-blue-600 text-white"
                : "bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white"
            }`}
          >
            グリッド
          </button>
        </div>
      </div>

      <div>
        {loading ? (
          <div>読み込み中...</div>
        ) : sortedSheets.length === 0 ? (
          <div className="text-sm text-neutral-400">まだシートがありません</div>
        ) : viewMode === "list" ? (
          <ul className="space-y-2">
            {sortedSheets.map((s) => (
              <li key={s.id} className="flex items-center justify-between border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3 py-2 rounded">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* 接続状態バッジ */}
                  <div className="flex-shrink-0">
                    {s.isAccessible === false ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded" title={s.lastError || "アクセスできません"}>
                        ✗ エラー
                      </span>
                    ) : s.isAccessible === true ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                        ✓ 接続OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded">
                        未確認
                      </span>
                    )}
                  </div>
                  <div className="truncate font-medium flex-1">{s.title ?? s.url ?? s.sheetId}</div>
                  <div className="text-sm text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                    {s.addedAt?.toDate().toLocaleDateString("ja-JP")}
                  </div>
                  {/* 最終取得日時 */}
                  {s.lastFetched && (
                    <div className="text-xs text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                      最終更新: {new Date(s.lastFetched.seconds * 1000).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={projectId && folderId 
                      ? `/projects/${projectId}/folders/${folderId}/sheets/${s.sheetId}`
                      : `/sheets/${s.sheetId}`}
                    className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium"
                  >
                    データ表示
                  </a>
                  <button 
                    onClick={() => refreshMetadata(s)}
                    disabled={refreshingIds.has(s.id!)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    title="メタデータを更新"
                  >
                    {refreshingIds.has(s.id!) ? "更新中..." : "更新"}
                  </button>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${s.sheetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    開く
                  </a>
                  <button onClick={() => s.id ? requestDeleteSheet(s.id) : undefined} className="text-sm text-red-600 dark:text-red-400 hover:underline">
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {sortedSheets.map((s) => (
              <div key={s.id} className="border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-4 rounded flex flex-col">
                {/* 接続状態バッジ */}
                <div className="mb-2">
                  {s.isAccessible === false ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded" title={s.lastError || "アクセスできません"}>
                      ✗ エラー
                    </span>
                  ) : s.isAccessible === true ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                      ✓ 接続OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded">
                      未確認
                    </span>
                  )}
                </div>
                <div className="font-medium mb-2 truncate">{s.title ?? s.url ?? s.sheetId}</div>
                {/* 最終取得日時 */}
                {s.lastFetched && (
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mb-2">
                    最終更新: {new Date(s.lastFetched.seconds * 1000).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-auto">
                  <a
                    href={projectId && folderId 
                      ? `/projects/${projectId}/folders/${folderId}/sheets/${s.sheetId}`
                      : `/sheets/${s.sheetId}`}
                    className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium"
                  >
                    データ表示
                  </a>
                  <button 
                    onClick={() => refreshMetadata(s)}
                    disabled={refreshingIds.has(s.id!)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    {refreshingIds.has(s.id!) ? "更新中..." : "更新"}
                  </button>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${s.sheetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    開く
                  </a>
                  <button onClick={() => s.id ? requestDeleteSheet(s.id) : undefined} className="text-sm text-red-600 dark:text-red-400 hover:underline">
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
