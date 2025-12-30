import { Timestamp } from "firebase/firestore";
import type { TransformedDataMeta as CoreTransformedDataMeta } from "@shared/types/transformedData";
import type { TransformedDataRecord as CoreTransformedDataRecord } from "@shared/types/transformedData";
import type { TransformStatus } from "@shared/types/transformedData";

export type { TransformStatus } from "@shared/types/transformedData";

/**
 * 変換済みデータのメタ情報
 */
export type TransformedDataMeta = {
  id?: string;
  sheetId: string;
  sheetName: string;
  mappingId: string; // 使用したマッピング定義のID
  transformedAt: Timestamp;
  status: TransformStatus;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: CoreTransformedDataMeta<Timestamp>["errors"];
  dataCount: number; // 保存されたレコード数
};

/**
 * 変換済みデータレコード
 */
export type TransformedDataRecord = {
  id?: string;
  rowIndex: number; // 元のシートでの行番号
  data: CoreTransformedDataRecord<Timestamp>["data"]; // フィールド名: 値のマップ
  hasError: boolean; // この行にエラーがあるか
  createdAt: Timestamp;
};
