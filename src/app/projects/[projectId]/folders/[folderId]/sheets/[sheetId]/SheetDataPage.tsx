"use client";
import { use } from "react";
import DataGrid from "@/components/sheet/DataGrid";
import Sidebar from "@/components/layout/Sidebar";
import Breadcrumb from "@/components/layout/Breadcrumb";
import { Timestamp } from "firebase/firestore";
import Loading from "@/components/layout/Loading";
import SheetMappingEditor from "@/components/sheet/SheetMappingEditor";
import AlertDialog from "@/components/common/AlertDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ValidationTab from "@/components/sheet/validation/ValidationTab";
import { formatTransformError, getTransformSummary } from "@/lib/dataTransform";
import { useSheetDataPageLogic } from "@/hooks/useSheetDataPageLogic";

type PageProps = {
  params: Promise<{
    projectId: string;
    folderId: string;
    sheetId: string;
  }>;
};


export default function SheetDataPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { projectId, folderId, sheetId } = resolvedParams;
  const logic = useSheetDataPageLogic({ projectId, folderId, sheetId });

  if (logic.isInitialLoading) {
    return <Loading fullScreen message="シートを読み込んでいます..." />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-900 text-black dark:text-white">
      <AlertDialog
        open={logic.showMissingMappingAlert}
        message={"バリデーションを実行するにはマッピング設定が必要です。\n先に「マッピング設定」タブで設定してください。"}
        okText="OK"
        onClose={() => logic.setShowMissingMappingAlert(false)}
      />
      <ConfirmDialog
        open={logic.showUnsavedMappingDialog}
        title="未保存"
        message={"未保存のマッピング設定があります。\n設定を破棄して移動しますか？"}
        okText="はい"
        cancelText="キャンセル"
        onCancel={logic.confirmDialogCancel}
        onConfirm={logic.confirmDialogConfirm}
      />
      <div className="flex flex-1">
        <Sidebar menuItems={[]} />
        <main className="flex-1 p-6 min-w-0">
          <div className="mb-6">
            <Breadcrumb
              items={[
                { label: logic.project?.title || "...", href: `/projects/${projectId}` },
                { label: logic.folder?.name || "...", href: `/projects/${projectId}/folders/${folderId}` },
                { label: logic.metadata?.title || sheetId },
              ]}
              onBeforeNavigate={(href) => {
                if (!logic.mappingDirty) return true;
                logic.requestNavigate(href);
                return false;
              }}
            />
            <h1 className="text-2xl font-bold mt-4 mb-2">シートデータ</h1>
            
            {/* タブ */}
            <div className="flex gap-4 border-b border-neutral-300 dark:border-neutral-700 mb-4">
              <button
                onClick={() => logic.requestTabChange("data")}
                className={`px-4 py-2 font-semibold transition-colors ${
                  logic.activeTab === "data"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
              >
                データ
              </button>
              <button
                onClick={() => logic.requestTabChange("mapping")}
                className={`px-4 py-2 font-semibold transition-colors ${
                  logic.activeTab === "mapping"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
              >
                マッピング設定
              </button>
              <button
                onClick={() => logic.requestTabChange("validation")}
                className={`px-4 py-2 font-semibold transition-colors ${
                  logic.activeTab === "validation"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
              >
                バリデーション
              </button>
              <button
                onClick={() => logic.requestTabChange("transform")}
                className={`px-4 py-2 font-semibold transition-colors ${
                  logic.activeTab === "transform"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
              >
                データ変換
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <label htmlFor="sheetSelect" className="text-sm">シート:</label>
              <select
                id="sheetSelect"
                value={logic.selectedSheet}
                onChange={(e) => logic.setSelectedSheet(e.target.value)}
                className="px-3 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded text-sm"
              >
                {logic.metadata?.sheets && logic.metadata.sheets.length > 0 ? (
                  logic.metadata.sheets.map((sheet) => (
                    <option key={sheet.sheetId} value={sheet.title}>
                      {sheet.title}
                    </option>
                  ))
                ) : (
                  <option value="Sheet1">Sheet1 (デフォルト)</option>
                )}
              </select>
              <label htmlFor="range" className="text-sm">範囲:</label>
              <input
                id="range"
                type="text"
                value={logic.range}
                onChange={(e) => logic.setRange(e.target.value)}
                placeholder="A1:Z1000 (省略可)"
                className="px-3 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded text-sm w-40"
              />
              <button
                onClick={logic.handleSync}
                disabled={logic.syncing}
                className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-neutral-400 disabled:cursor-not-allowed"
              >
                {logic.syncing ? "同期中..." : "手動同期"}
              </button>
              <a
                href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                元のシートを開く
              </a>
            </div>

            {/* 同期ログ */}
            {logic.syncLogs.length > 0 && (
              <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700">
                <button
                  onClick={() => logic.setShowSyncLogs(!logic.showSyncLogs)}
                  className="w-full flex items-center justify-between text-sm font-semibold mb-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <span>最近の同期履歴</span>
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {logic.showSyncLogs ? "▼" : "▶"}
                  </span>
                </button>
                {logic.showSyncLogs && (
                  <ul className="space-y-1">
                    {logic.syncLogs.map((log) => (
                      <li key={log.id} className="text-xs flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded ${
                          log.status === "success" ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" :
                          log.status === "failed" ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" :
                          log.status === "partial" ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200" :
                          "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        }`}>
                          {log.status}
                        </span>
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {log.startedAt instanceof Timestamp ? log.startedAt.toDate().toLocaleString("ja-JP") : ""}
                        </span>
                        <span className="text-neutral-500">
                          {log.recordsProcessed > 0 && `${log.recordsSuccess}/${log.recordsProcessed}件成功`}
                        </span>
                        {log.errorMessage && (
                          <span className="text-red-600 dark:text-red-400">{log.errorMessage}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {logic.activeTab === "data" ? (
            logic.error ? (
              <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200">
                {logic.error}
              </div>
            ) : (
              <DataGrid data={logic.sheetData?.values || []} loading={logic.loading} />
            )
          ) : logic.activeTab === "mapping" ? (
            <SheetMappingEditor
              sheetData={logic.sheetData?.values || []}
              initialMapping={logic.mapping || undefined}
              initialHasChanges={logic.mappingDirty}
              onHasChangesChange={logic.setMappingDirty}
              onSave={logic.handleSaveMapping}
            />
          ) : logic.activeTab === "validation" ? (
            <ValidationTab
              user={logic.user}
              projectId={projectId}
              folderId={folderId}
              sheetId={sheetId}
              selectedSheet={logic.selectedSheet}
              sheetData={logic.sheetData}
              loading={logic.loading}
              mapping={logic.mapping}
            />
          ) : (
            <div className="space-y-6">
              {/* 変換実行セクション */}
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h2 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200">
                  データ変換・保存
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  マッピング定義に基づいてデータを変換し、Firestoreに保存します
                </p>
                <button
                  onClick={logic.handleTransformData}
                  disabled={logic.isTransforming || !logic.mapping}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {logic.isTransforming ? "変換中..." : "変換実行"}
                </button>
                {!logic.mapping && (
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
                    ⚠️ マッピング設定が必要です。先に「マッピング設定」タブでマッピングを作成してください。
                  </p>
                )}
              </div>

              {/* 変換結果 */}
              {logic.transformResult && (
                <div className={`p-6 rounded-lg border ${
                  logic.transformResult.success
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                    : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
                }`}>
                  <h2 className="text-lg font-semibold mb-3">変換結果</h2>
                  <div className="text-lg mb-4">
                    {getTransformSummary(logic.transformResult.transformResult)}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">総行数</div>
                      <div className="text-2xl font-bold">{logic.transformResult.transformResult.totalRows}</div>
                    </div>
                    <div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">成功</div>
                      <div className="text-2xl font-bold text-green-600">
                        {logic.transformResult.transformResult.successRows}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">エラー</div>
                      <div className="text-2xl font-bold text-red-600">
                        {logic.transformResult.transformResult.errorRows}
                      </div>
                    </div>
                  </div>

                  {/* エラー詳細 */}
                  {logic.transformResult.transformResult.errors.length > 0 && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 rounded">
                      <h3 className="font-semibold mb-2 text-red-800 dark:text-red-200">
                        エラー詳細
                      </h3>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {logic.transformResult.transformResult.errors.slice(0, 10).map((error, idx: number) => (
                          <div key={idx} className="text-sm font-mono text-red-600 dark:text-red-400">
                            {formatTransformError(error)}
                          </div>
                        ))}
                        {logic.transformResult.transformResult.errors.length > 10 && (
                          <div className="text-sm text-neutral-600 dark:text-neutral-400">
                            ...他 {logic.transformResult.transformResult.errors.length - 10} 件のエラー
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 最新の変換結果 */}
              {logic.latestTransform && (
                <div className="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <h2 className="text-lg font-semibold mb-3">最新の変換データ</h2>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">変換日時</div>
                      <div className="text-sm">
                        {logic.latestTransform.transformedAt?.toDate().toLocaleString("ja-JP")}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">ステータス</div>
                      <div className="text-sm">
                        {logic.latestTransform.status === "success" ? "✅ 成功" : 
                         logic.latestTransform.status === "partial" ? "⚠️ 一部エラー" : "❌ 失敗"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">総行数</div>
                      <div className="text-xl font-bold">{logic.latestTransform.totalRows}</div>
                    </div>
                    <div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">保存レコード数</div>
                      <div className="text-xl font-bold text-blue-600">{logic.latestTransform.dataCount}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 変換履歴 */}
              {logic.transformHistory.length > 0 && (
                <div className="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <h2 className="text-lg font-semibold mb-3">変換履歴</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-neutral-300 dark:border-neutral-600">
                      <thead className="bg-neutral-100 dark:bg-neutral-700">
                        <tr>
                          <th className="border px-3 py-2 text-left text-sm">変換日時</th>
                          <th className="border px-3 py-2 text-left text-sm">ステータス</th>
                          <th className="border px-3 py-2 text-left text-sm">総行数</th>
                          <th className="border px-3 py-2 text-left text-sm">成功</th>
                          <th className="border px-3 py-2 text-left text-sm">エラー</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logic.transformHistory.map((item, idx) => (
                          <tr key={idx} className="hover:bg-neutral-100 dark:hover:bg-neutral-700">
                            <td className="border px-3 py-2 text-sm">
                              {item.transformedAt?.toDate().toLocaleString("ja-JP")}
                            </td>
                            <td className="border px-3 py-2 text-sm">
                              {item.status === "success" ? "✅ 成功" : 
                               item.status === "partial" ? "⚠️ 一部エラー" : "❌ 失敗"}
                            </td>
                            <td className="border px-3 py-2 text-sm">{item.totalRows}</td>
                            <td className="border px-3 py-2 text-sm text-green-600">{item.successRows}</td>
                            <td className="border px-3 py-2 text-sm text-red-600">{item.errorRows}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
