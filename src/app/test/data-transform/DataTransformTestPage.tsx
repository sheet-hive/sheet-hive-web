"use client";
import { useState } from "react";
import { transformSheetData, formatTransformError, getTransformSummary } from "@/lib/dataTransform";
import { DataType } from "@/models/mapping";

// テスト用データセット
const testDatasets = {
  clean: {
    name: "正常なデータ",
    data: [
      ["ID", "名前", "年齢", "入社日", "在籍中"],
      ["1", "山田太郎", "25", "2020-04-01", "true"],
      ["2", "佐藤花子", "30", "2018-07-15", "yes"],
      ["3", "鈴木一郎", "28", "2019-10-01", "○"],
      ["4", "田中美咲", "32", "2017-03-20", "はい"],
    ],
    mappings: [
      { columnIndex: 0, columnName: "ID", fieldName: "id", dataType: "integer" as DataType },
      { columnIndex: 1, columnName: "名前", fieldName: "name", dataType: "string" as DataType },
      { columnIndex: 2, columnName: "年齢", fieldName: "age", dataType: "integer" as DataType },
      { columnIndex: 3, columnName: "入社日", fieldName: "joinDate", dataType: "date" as DataType },
      { columnIndex: 4, columnName: "在籍中", fieldName: "isActive", dataType: "boolean" as DataType },
    ],
  },
  withErrors: {
    name: "エラーを含むデータ",
    data: [
      ["商品ID", "商品名", "価格", "販売日", "在庫あり"],
      ["A001", "ノートPC", "120000", "2024-01-15", "true"],
      ["A002", "マウス", "無料", "2024-01-16", "yes"],
      ["A003", "キーボード", "8,000", "invalid-date", "maybe"],
      ["", "モニター", "25000", "2024-01-18", "no"],
    ],
    mappings: [
      { columnIndex: 0, columnName: "商品ID", fieldName: "productId", dataType: "string" as DataType },
      { columnIndex: 1, columnName: "商品名", fieldName: "name", dataType: "string" as DataType },
      { columnIndex: 2, columnName: "価格", fieldName: "price", dataType: "integer" as DataType },
      { columnIndex: 3, columnName: "販売日", fieldName: "saleDate", dataType: "date" as DataType },
      { columnIndex: 4, columnName: "在庫あり", fieldName: "inStock", dataType: "boolean" as DataType },
    ],
  },
  japaneseFormats: {
    name: "日本語フォーマット",
    data: [
      ["受注番号", "金額", "受注日", "完了"],
      ["1", "1,500,000", "2024年1月15日", "○"],
      ["2", "2,300,500", "2024年2月20日", "×"],
      ["3", "980,000", "2024年3月5日", "はい"],
      ["4", "15,000", "2024年4月10日", "いいえ"],
    ],
    mappings: [
      { columnIndex: 0, columnName: "受注番号", fieldName: "orderId", dataType: "integer" as DataType },
      { columnIndex: 1, columnName: "金額", fieldName: "amount", dataType: "integer" as DataType },
      { columnIndex: 2, columnName: "受注日", fieldName: "orderDate", dataType: "date" as DataType },
      { columnIndex: 3, columnName: "完了", fieldName: "isCompleted", dataType: "boolean" as DataType },
    ],
  },
};

export default function DataTransformTestPage() {
  const [selectedDataset, setSelectedDataset] = useState<keyof typeof testDatasets>("clean");
  const [result, setResult] = useState<{
    success: boolean;
    data: Record<string, string | number | Date | boolean | null>[];
    errors: Array<{ rowIndex: number; columnIndex: number; fieldName: string; originalValue: string; expectedType: DataType; errorMessage: string }>;
    totalRows: number;
    successRows: number;
    errorRows: number;
  } | null>(null);

  const runTransform = () => {
    const dataset = testDatasets[selectedDataset];
    const transformResult = transformSheetData(
      dataset.data,
      dataset.mappings,
      1 // ヘッダ行の次から開始
    );
    setResult(transformResult);
  };

  const dataset = testDatasets[selectedDataset];

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 text-black dark:text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">データ変換機能テスト</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          マッピング定義に基づいてデータを変換し、バリデーションを実行
        </p>

        {/* データセット選択 */}
        <div className="mb-6 p-6 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">テストデータ選択</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            {Object.entries(testDatasets).map(([key, ds]) => (
              <button
                key={key}
                onClick={() => setSelectedDataset(key as keyof typeof testDatasets)}
                className={`px-4 py-2 rounded ${
                  selectedDataset === key
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                }`}
              >
                {ds.name}
              </button>
            ))}
          </div>
          <button
            onClick={runTransform}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
          >
            変換実行
          </button>
        </div>

        {/* 元データ */}
        <div className="mb-6 p-6 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">元データ（生データ）</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-neutral-300 dark:border-neutral-600">
              <tbody>
                {dataset.data.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        className={`border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm ${
                          rowIndex === 0 ? "bg-neutral-200 dark:bg-neutral-700 font-semibold" : ""
                        }`}
                      >
                        {cell || <span className="text-neutral-400">(空)</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* マッピング定義 */}
        <div className="mb-6 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200">
            📋 マッピング定義
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-neutral-300 dark:border-neutral-600">
              <thead className="bg-neutral-100 dark:bg-neutral-800">
                <tr>
                  <th className="border px-3 py-2 text-left text-sm">カラム名</th>
                  <th className="border px-3 py-2 text-left text-sm">フィールド名</th>
                  <th className="border px-3 py-2 text-left text-sm">データ型</th>
                </tr>
              </thead>
              <tbody>
                {dataset.mappings.map((mapping, idx) => (
                  <tr key={idx}>
                    <td className="border px-3 py-2 text-sm">{mapping.columnName}</td>
                    <td className="border px-3 py-2 text-sm font-mono">{mapping.fieldName}</td>
                    <td className="border px-3 py-2 text-sm">
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-800 rounded text-xs">
                        {mapping.dataType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 変換結果 */}
        {result && (
          <div className="space-y-6">
            {/* サマリー */}
            <div className={`p-6 rounded-lg border ${
              result.success
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
            }`}>
              <h2 className="text-lg font-semibold mb-3">📊 変換結果サマリー</h2>
              <div className="text-lg mb-4">{getTransformSummary(result)}</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">総行数</div>
                  <div className="text-2xl font-bold">{result.totalRows}</div>
                </div>
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">成功</div>
                  <div className="text-2xl font-bold text-green-600">{result.successRows}</div>
                </div>
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">エラー</div>
                  <div className="text-2xl font-bold text-red-600">{result.errorRows}</div>
                </div>
              </div>
            </div>

            {/* エラー詳細 */}
            {result.errors.length > 0 && (
              <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <h2 className="text-lg font-semibold mb-3 text-red-800 dark:text-red-200">
                  ❌ 変換エラー詳細
                </h2>
                <div className="space-y-2">
                  {result.errors.map((error, idx: number) => (
                    <div key={idx} className="p-3 bg-white dark:bg-neutral-800 rounded text-sm">
                      <div className="font-mono text-red-600 dark:text-red-400">
                        {formatTransformError(error)}
                      </div>
                      <div className="text-neutral-600 dark:text-neutral-400 mt-1">
                        元の値: &quot;{error.originalValue}&quot; → 期待される型: {error.expectedType}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 変換後データ */}
            <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h2 className="text-lg font-semibold mb-3 text-green-800 dark:text-green-200">
                ✅ 変換後データ（JSON形式）
              </h2>
              <pre className="bg-white dark:bg-neutral-800 p-4 rounded overflow-x-auto text-xs">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
