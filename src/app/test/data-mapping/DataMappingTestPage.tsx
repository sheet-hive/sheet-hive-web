"use client";
import { useState } from "react";
import { detectHeaderRow, inferDataType, generateAutoMapping } from "@/lib/dataMapping";

// テスト用データセット
const testDatasets = {
  standard: {
    name: "標準的なデータ",
    data: [
      ["ID", "名前", "年齢", "入社日", "在籍中"],
      ["1", "山田太郎", "25", "2020-04-01", "true"],
      ["2", "佐藤花子", "30", "2018-07-15", "true"],
      ["3", "鈴木一郎", "28", "2019-10-01", "false"],
      ["4", "田中美咲", "32", "2017-03-20", "true"],
    ],
  },
  headerOnSecondRow: {
    name: "2行目がヘッダ",
    data: [
      ["", "", "", "※このシートは売上データです", ""],
      ["商品ID", "商品名", "価格", "販売数", "売上日"],
      ["A001", "ノートPC", "120000", "5", "2024-01-15"],
      ["A002", "マウス", "2500", "20", "2024-01-16"],
      ["A003", "キーボード", "8000", "10", "2024-01-17"],
    ],
  },
  mixedTypes: {
    name: "混在データ型",
    data: [
      ["コード", "数値", "金額", "日付", "フラグ", "備考"],
      ["CODE-001", "100", "1,500", "2024/01/01", "○", "テストデータ"],
      ["CODE-002", "200.5", "2,300", "2024年1月2日", "×", ""],
      ["CODE-003", "300", "3,100", "01/03/2024", "yes", "重要"],
      ["CODE-004", "abc", "4,500", "invalid", "no", "サンプル"],
    ],
  },
  noHeader: {
    name: "ヘッダなし（全て数値）",
    data: [
      ["1", "100", "200", "300"],
      ["2", "150", "250", "350"],
      ["3", "200", "300", "400"],
      ["4", "250", "350", "450"],
    ],
  },
  emptyAndNull: {
    name: "空白・欠損値あり",
    data: [
      ["ID", "名前", "メール", "電話番号", "住所"],
      ["1", "山田太郎", "yamada@example.com", "090-1234-5678", "東京都"],
      ["2", "", "sato@example.com", "", ""],
      ["3", "鈴木一郎", "", "080-9876-5432", "大阪府"],
      ["4", "田中美咲", "tanaka@example.com", "", ""],
    ],
  },
};

export default function DataMappingTestPage() {
  const [selectedDataset, setSelectedDataset] = useState<keyof typeof testDatasets>("standard");
  const [testResults, setTestResults] = useState<{
    headerResult: { headerRowIndex: number; confidence: number; reason: string; candidateHeaders: string[] };
    typeInferences: Array<{ dataType: string; confidence: number; sampleValues: string[]; nullCount: number; totalCount: number }>;
    autoMapping: { headerRowIndex: number; dataStartRowIndex: number; mappings: Array<{ columnIndex: number; columnName: string; fieldName: string; dataType: string; confidence: number }> };
  } | null>(null);

  const runTest = () => {
    const data = testDatasets[selectedDataset].data;
    
    // ヘッダ検出テスト
    const headerResult = detectHeaderRow(data);
    
    // 型推定テスト（各カラムごと）
    const typeInferences = data[0].map((_, colIndex) => {
      const columnData = data.slice(1).map((row) => row[colIndex] || "");
      return inferDataType(columnData);
    });
    
    // 自動マッピング生成テスト
    const autoMapping = generateAutoMapping(data);
    
    setTestResults({
      headerResult,
      typeInferences,
      autoMapping: autoMapping as unknown as {
        headerRowIndex: number;
        dataStartRowIndex: number;
        mappings: Array<{
          columnIndex: number;
          columnName: string;
          fieldName: string;
          dataType: string;
          confidence: number;
        }>;
      },
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 text-black dark:text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">データマッピング機能テスト</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          ヘッダ検出、型推定、自動マッピング生成のロジックを検証
        </p>

        {/* データセット選択 */}
        <div className="mb-6 p-6 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">テストデータ選択</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            {Object.entries(testDatasets).map(([key, dataset]) => (
              <button
                key={key}
                onClick={() => setSelectedDataset(key as keyof typeof testDatasets)}
                className={`px-4 py-2 rounded ${
                  selectedDataset === key
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                }`}
              >
                {dataset.name}
              </button>
            ))}
          </div>
          <button
            onClick={runTest}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
          >
            テスト実行
          </button>
        </div>

        {/* 選択中のデータプレビュー */}
        <div className="mb-6 p-6 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">データプレビュー</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-neutral-300 dark:border-neutral-600">
              <tbody>
                {testDatasets[selectedDataset].data.map((row, rowIndex) => (
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

        {/* テスト結果 */}
        {testResults && (
          <div className="space-y-6">
            {/* ヘッダ検出結果 */}
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h2 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200">
                📋 ヘッダ行検出結果
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">検出された行</div>
                  <div className="text-2xl font-bold">
                    {testResults.headerResult.headerRowIndex + 1}行目
                  </div>
                </div>
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">信頼度</div>
                  <div className="text-2xl font-bold">
                    {(testResults.headerResult.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-neutral-600 dark:text-neutral-400">判定理由</div>
                <div className="text-sm">{testResults.headerResult.reason}</div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-neutral-600 dark:text-neutral-400">検出されたヘッダ</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {testResults.headerResult.candidateHeaders.map((header: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-800 rounded text-sm"
                    >
                      {header || `(空-Col${idx})`}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 型推定結果 */}
            <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h2 className="text-lg font-semibold mb-3 text-green-800 dark:text-green-200">
                🔍 カラムごとの型推定結果
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-neutral-300 dark:border-neutral-600">
                  <thead className="bg-neutral-100 dark:bg-neutral-800">
                    <tr>
                      <th className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-left text-sm">
                        カラム
                      </th>
                      <th className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-left text-sm">
                        推定型
                      </th>
                      <th className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-left text-sm">
                        信頼度
                      </th>
                      <th className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-left text-sm">
                        サンプル値
                      </th>
                      <th className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-left text-sm">
                        欠損数
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.typeInferences.map((result, idx: number) => (
                      <tr key={idx}>
                        <td className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm">
                          {testDatasets[selectedDataset].data[0][idx] || `Column ${idx}`}
                        </td>
                        <td className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              result.dataType === "integer" ||
                              result.dataType === "decimal" ||
                              result.dataType === "number"
                                ? "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100"
                                : result.dataType === "date"
                                ? "bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-100"
                                : result.dataType === "time"
                                ? "bg-sky-100 dark:bg-sky-800 text-sky-800 dark:text-sky-100"
                                : result.dataType === "datetime"
                                ? "bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100"
                                : result.dataType === "boolean"
                                ? "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100"
                                : "bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100"
                            }`}
                          >
                            {result.dataType}
                          </span>
                        </td>
                        <td className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm">
                          {(result.confidence * 100).toFixed(0)}%
                        </td>
                        <td className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm">
                          {result.sampleValues.slice(0, 3).join(", ")}
                        </td>
                        <td className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm">
                          {result.nullCount} / {result.totalCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 自動マッピング結果 */}
            <div className="p-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <h2 className="text-lg font-semibold mb-3 text-purple-800 dark:text-purple-200">
                ⚙️ 自動マッピング生成結果
              </h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">ヘッダ行</div>
                  <div className="text-xl font-bold">
                    {testResults.autoMapping.headerRowIndex + 1}行目
                  </div>
                </div>
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">データ開始行</div>
                  <div className="text-xl font-bold">
                    {testResults.autoMapping.dataStartRowIndex + 1}行目
                  </div>
                </div>
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">フィールド数</div>
                  <div className="text-xl font-bold">{testResults.autoMapping.mappings.length}</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-neutral-300 dark:border-neutral-600">
                  <thead className="bg-neutral-100 dark:bg-neutral-800">
                    <tr>
                      <th className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-left text-sm">
                        列番号
                      </th>
                      <th className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-left text-sm">
                        カラム名
                      </th>
                      <th className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-left text-sm">
                        フィールド名
                      </th>
                      <th className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-left text-sm">
                        データ型
                      </th>
                      <th className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-left text-sm">
                        信頼度
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.autoMapping.mappings.map((mapping, idx: number) => (
                      <tr key={idx}>
                        <td className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm">
                          {mapping.columnIndex}
                        </td>
                        <td className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm font-semibold">
                          {mapping.columnName}
                        </td>
                        <td className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm">
                          {mapping.fieldName}
                        </td>
                        <td className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              mapping.dataType === "integer" ||
                              mapping.dataType === "decimal" ||
                              mapping.dataType === "number"
                                ? "bg-blue-100 dark:bg-blue-800"
                                : mapping.dataType === "date"
                                ? "bg-purple-100 dark:bg-purple-800"
                                : mapping.dataType === "boolean"
                                ? "bg-green-100 dark:bg-green-800"
                                : "bg-neutral-100 dark:bg-neutral-700"
                            }`}
                          >
                            {mapping.dataType}
                          </span>
                        </td>
                        <td className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm">
                          {(mapping.confidence * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
