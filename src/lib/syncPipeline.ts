import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  Timestamp,
} from "firebase/firestore";
import { SheetMapping } from "@/models/mapping";
import { SyncLog } from "@/models/syncLog";
import { fetchSheetData } from "@/lib/sheets";
import { executeSyncPipelineCore, type SyncPipelineResult } from "@shared/pipeline";
import { createFirestoreSyncLogRepo, createFirestoreTransformedDataRepo } from "@/lib/repos";
import type { SyncLogRepoKey, TransformedDataRepoKey } from "@shared/repos";

/**
 * 同期パイプラインの実行
 * バッチGet → マッピング適用 → データ変換 → Firestore保存 → ログ更新
 * 
 * @param userId - ユーザーID
 * @param projectId - プロジェクトID
 * @param folderId - フォルダID
 * @param sheetId - Google Sheets ID
 * @param sheetName - シート名
 * @param mapping - マッピング定義
 * @returns 同期パイプライン実行結果
 */
export async function executeSyncPipeline(
  userId: string,
  projectId: string,
  folderId: string,
  sheetId: string,
  sheetName: string,
  mapping: SheetMapping
): Promise<SyncPipelineResult> {
  const logsPath = `users/${userId}/projects/${projectId}/folders/${folderId}/sheets/${sheetId}/syncLogs`;
  const syncLogId = doc(collection(db, logsPath)).id;

  const syncLogRepo = createFirestoreSyncLogRepo(db);
  const transformedDataRepo = createFirestoreTransformedDataRepo(db);

  return executeSyncPipelineCore(
    {
      now: () => Timestamp.now(),
      createSyncLogId: () => syncLogId,

      fetchSheetData: (spreadsheetId, range) => fetchSheetData(spreadsheetId, range),

      syncLogRepo,
      transformedDataRepo,
    },
    {
      userId,
      projectId,
      folderId,
      sheetId,
      sheetName,
      mapping,
    }
  );
}

function buildRepoKey(userId: string, projectId: string, folderId: string, sheetId: string): SyncLogRepoKey & TransformedDataRepoKey {
  return { userId, projectId, folderId, sheetId };
}

/**
 * 同期ログを取得
 * 
 * @param userId - ユーザーID
 * @param projectId - プロジェクトID
 * @param folderId - フォルダID
 * @param sheetId - シートID
 * @param limitCount - 取得件数（デフォルト: 5）
 * @returns 同期ログの配列
 */
export async function getSyncLogs(
  userId: string,
  projectId: string,
  folderId: string,
  sheetId: string,
  limitCount: number = 5
): Promise<SyncLog[]> {
  const repo = createFirestoreSyncLogRepo(db);
  const key = buildRepoKey(userId, projectId, folderId, sheetId);
  const logs = await repo.list?.({ key, limitCount });
  return (logs as unknown as SyncLog[]) ?? [];
}
