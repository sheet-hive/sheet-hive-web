"use client";
import { useState } from "react";
import DataGrid from "@/components/sheet/DataGrid";

// ダミーデータ生成関数
function generateTestData(rows: number, cols: number): string[][] {
  const categories = ["Electronics", "Furniture", "Clothing", "Food", "Books"];
  const statuses = ["Active", "Pending", "Completed", "Cancelled"];
  
  const headers = [
    "ID",
    "名前",
    "カテゴリ",
    "金額",
    "数量",
    "ステータス",
    "日付",
    "担当者",
    "備考",
    "評価"
  ].slice(0, cols);
  
  const data: string[][] = [headers];
  
  for (let i = 1; i <= rows; i++) {
    const row: string[] = [];
    for (let j = 0; j < cols; j++) {
      switch (j) {
        case 0: // ID
          row.push(`ID-${i.toString().padStart(6, "0")}`);
          break;
        case 1: // 名前
          row.push(`商品${i}`);
          break;
        case 2: // カテゴリ
          row.push(categories[i % categories.length]);
          break;
        case 3: // 金額
          row.push((Math.floor(Math.random() * 100000) + 1000).toLocaleString());
          break;
        case 4: // 数量
          row.push(Math.floor(Math.random() * 100 + 1).toString());
          break;
        case 5: // ステータス
          row.push(statuses[i % statuses.length]);
          break;
        case 6: // 日付
          const date = new Date(2024, 0, 1 + (i % 365));
          row.push(date.toISOString().split("T")[0]);
          break;
        case 7: // 担当者
          row.push(`担当者${(i % 50) + 1}`);
          break;
        case 8: // 備考
          row.push(i % 10 === 0 ? "重要案件" : "通常");
          break;
        case 9: // 評価
          row.push(`★`.repeat((i % 5) + 1));
          break;
        default:
          row.push(`データ${i}-${j}`);
      }
    }
    data.push(row);
  }
  
  return data;
}

export default function GridPerformanceTestPage() {
  const [testData, setTestData] = useState<string[][]>([]);
  const [metrics, setMetrics] = useState({
    rowCount: 0,
    colCount: 0,
    generationTime: 0,
    renderTime: 0,
    memoryUsed: 0,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [customRows, setCustomRows] = useState("100000");
  const [customCols, setCustomCols] = useState("10");

  const generateData = (rows: number, cols: number) => {
    setIsGenerating(true);
    
    // 次のティックでパフォーマンス計測を実行（purityルール回避）
    setTimeout(() => {
      // データ生成時間を計測
      const genStart = performance.now();
      const data = generateTestData(rows, cols);
      const genEnd = performance.now();
      
      // メモリ使用量を計測（概算）
      const jsonSize = new Blob([JSON.stringify(data)]).size;
      const memorySizeMB = (jsonSize / 1024 / 1024).toFixed(2);
      
      // レンダリング開始時間
      const renderStart = performance.now();
      
      setTestData(data);
      
      // レンダリング完了を次のフレームで確認
      requestAnimationFrame(() => {
        const renderEnd = performance.now();
        
        setMetrics({
          rowCount: rows,
          colCount: cols,
          generationTime: genEnd - genStart,
          renderTime: renderEnd - renderStart,
          memoryUsed: parseFloat(memorySizeMB),
        });
        
        setIsGenerating(false);
      });
    }, 0);
  };

  const presetTests = [
    { label: "1,000行", rows: 1000, cols: 10 },
    { label: "10,000行", rows: 10000, cols: 10 },
    { label: "50,000行", rows: 50000, cols: 10 },
    { label: "100,000行", rows: 100000, cols: 10 },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 text-black dark:text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">DataGrid パフォーマンステスト</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          仮想化スクロールと大量データ処理のパフォーマンスを検証
        </p>

        {/* テストコントロール */}
        <div className="mb-6 p-6 bg-neutral-100 dark:bg-neutral-800 rounded-lg space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-3">プリセットテスト</h2>
            <div className="flex flex-wrap gap-3">
              {presetTests.map((test) => (
                <button
                  key={test.label}
                  onClick={() => generateData(test.rows, test.cols)}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-400 text-white rounded"
                >
                  {test.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">カスタムテスト</h2>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={customRows}
                onChange={(e) => setCustomRows(e.target.value)}
                placeholder="行数"
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 rounded w-32"
              />
              <span>行 ×</span>
              <input
                type="number"
                value={customCols}
                onChange={(e) => setCustomCols(e.target.value)}
                placeholder="列数"
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 rounded w-32"
              />
              <span>列</span>
              <button
                onClick={() => generateData(parseInt(customRows), parseInt(customCols))}
                disabled={isGenerating}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-400 text-white rounded"
              >
                生成
              </button>
            </div>
          </div>
        </div>

        {/* パフォーマンスメトリクス */}
        {metrics.rowCount > 0 && (
          <div className="mb-6 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-3 text-green-800 dark:text-green-200">
              📊 パフォーマンスメトリクス
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">データサイズ</div>
                <div className="text-xl font-bold">
                  {metrics.rowCount.toLocaleString()} × {metrics.colCount}
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">生成時間</div>
                <div className="text-xl font-bold">{metrics.generationTime.toFixed(2)}ms</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">レンダリング</div>
                <div className="text-xl font-bold">{metrics.renderTime.toFixed(2)}ms</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">メモリ使用量</div>
                <div className="text-xl font-bold">{metrics.memoryUsed}MB</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">総計</div>
                <div className="text-xl font-bold">
                  {(metrics.generationTime + metrics.renderTime).toFixed(2)}ms
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-white dark:bg-neutral-800 rounded">
              <p className="text-sm">
                💡 <strong>仮想化の効果:</strong> {metrics.rowCount.toLocaleString()}行のデータでも、
                実際にレンダリングされるのは画面に表示される約20-30行のみ。
                スムーズなスクロールとフィルタリングが可能です。
              </p>
            </div>
          </div>
        )}

        {/* データグリッド */}
        {isGenerating ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-lg">データを生成中...</p>
          </div>
        ) : testData.length > 0 ? (
          <DataGrid data={testData} />
        ) : (
          <div className="p-12 text-center text-neutral-500">
            <p className="text-lg">テストを開始してください</p>
            <p className="text-sm mt-2">上のボタンからデータを生成できます</p>
          </div>
        )}
      </div>
    </div>
  );
}
