import { db } from "@/lib/firebase";
import {
  Timestamp,
} from "firebase/firestore";
import { SheetMapping } from "@/models/mapping";
import { TransformedDataMeta, TransformedDataRecord } from "@/models/transformedData";
import { fetchSheetData } from "@/lib/sheets";
import { executeDataPipelineCore, type DataPipelineResult } from "@shared/pipeline";
import type { TransformResult } from "@shared/mapping";
import { createFirestoreTransformedDataRepo } from "@/lib/repos";
import type { TransformedDataRepoKey } from "@shared/repos";

/**
 * データロードパイプラインの実行結果
 */
export type PipelineResult = {
  success: boolean;
  metaId: string;
  transformResult: TransformResult;
  savedRecords: number;
  errorMessage?: string;
};

/**
 * データロードパイプラインの実行
 * シート取得 → マッピング適用 → 変換 → Firestore保存
 * 
 * @param userId - ユーザーID
 * @param projectId - プロジェクトID
 * @param folderId - フォルダID
 * @param sheetId - Google Sheets ID
 * @param sheetName - シート名
 * @param mapping - マッピング定義
 * @returns パイプライン実行結果
 */
export async function executeDataPipeline(
  userId: string,
  projectId: string,
  folderId: string,
  sheetId: string,
  sheetName: string,
  mapping: SheetMapping
): Promise<PipelineResult> {
  const transformedDataRepo = createFirestoreTransformedDataRepo(db);

  const result: DataPipelineResult = await executeDataPipelineCore(
    {
      now: () => Timestamp.now(),
      fetchSheetData: (spreadsheetId, range) => fetchSheetData(spreadsheetId, range),
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

  if (!result.success) {
    console.error("Pipeline execution failed:", result.errorMessage);
  }

  return result;
}

function buildTransformedDataRepoKey(
  userId: string,
  projectId: string,
  folderId: string,
  sheetId: string
): TransformedDataRepoKey {
  return { userId, projectId, folderId, sheetId };
}

/**
 * 最新の変換済みデータのメタ情報を取得
 */
export async function getLatestTransformedDataMeta(
  userId: string,
  projectId: string,
  folderId: string,
  sheetId: string
): Promise<TransformedDataMeta | null> {
  const repo = createFirestoreTransformedDataRepo(db);
  const key = buildTransformedDataRepoKey(userId, projectId, folderId, sheetId);
  const meta = await repo.getLatestMeta?.({ key });
  return (meta as unknown as TransformedDataMeta) ?? null;
}

/**
 * 変換済みデータのレコードを取得
 */
export async function getTransformedDataRecords(
  userId: string,
  projectId: string,
  folderId: string,
  sheetId: string,
  metaId: string,
  limitCount: number = 100
): Promise<TransformedDataRecord[]> {
  const repo = createFirestoreTransformedDataRepo(db);
  const key = buildTransformedDataRepoKey(userId, projectId, folderId, sheetId);
  const records = await repo.getRecords?.({ key, metaId, limitCount });
  return (records as unknown as TransformedDataRecord[]) ?? [];
}

/**
 * 変換履歴を取得
 */
export async function getTransformHistory(
  userId: string,
  projectId: string,
  folderId: string,
  sheetId: string,
  limitCount: number = 10
): Promise<TransformedDataMeta[]> {
  const repo = createFirestoreTransformedDataRepo(db);
  const key = buildTransformedDataRepoKey(userId, projectId, folderId, sheetId);
  const history = await repo.getHistory?.({ key, limitCount });
  return (history as unknown as TransformedDataMeta[]) ?? [];
}
