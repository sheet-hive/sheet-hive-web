import { useState, useEffect, useCallback } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Folder } from "@/models/folder";
import { Sheet } from "@/models/sheet";
import KPICard from "@/components/dashboard/KPICard";
import Loading from "@/components/layout/Loading";
import DataQualityChart from "@/components/dashboard/DataQualityChart";
import SheetRecordsChart from "@/components/dashboard/SheetRecordsChart";
import DashboardFilter, { DashboardFilters } from "@/components/dashboard/DashboardFilter";
import { isDemoMode } from "@/lib/appMode";
import { demoApi } from "@/demo/demoApi";
import { subscribeDemoState } from "@/demo/demoStore";

function toValidDate(input: unknown): Date | null {
  if (!input) return null;

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "string" || typeof input === "number") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === "object") {
    if (!isRecord(input)) return null;

    const toDateCandidate = input.toDate;
    if (typeof toDateCandidate === "function") {
      const d = (toDateCandidate as () => unknown)();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }

    const secondsCandidate = input.seconds ?? input._seconds;
    const nanosecondsCandidate = input.nanoseconds ?? input._nanoseconds;

    const seconds = typeof secondsCandidate === "number" ? secondsCandidate : null;
    const nanoseconds = typeof nanosecondsCandidate === "number" ? nanosecondsCandidate : 0;

    if (seconds !== null) {
      const ms = seconds * 1000 + Math.floor(nanoseconds / 1e6);
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

interface DashboardData {
  totalSheets: number;
  totalFolders: number;
  totalRecords: number;
  totalSuccessRecords: number;
  totalErrorRecords: number;
  dataQualityScore: number;
  lastValidationDate: Date | null;
  avgRecordsPerSheet: number;
  errorRate: number;
  maxRecordsInSheet: number;
  avgSheetsPerFolder: number;
}

interface ProjectDashboardContentProps {
  projectId: string;
  userId: string;
}

export default function ProjectDashboardContent({ projectId, userId }: ProjectDashboardContentProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalSheets: 0,
    totalFolders: 0,
    totalRecords: 0,
    totalSuccessRecords: 0,
    totalErrorRecords: 0,
    dataQualityScore: 0,
    lastValidationDate: null,
    avgRecordsPerSheet: 0,
    errorRate: 0,
    maxRecordsInSheet: 0,
    avgSheetsPerFolder: 0,
  });
  const [chartData, setChartData] = useState<Array<{
    date: string;
    qualityScore: number;
    successRate: number;
  }>>([]);
  const [sheetRecordsData, setSheetRecordsData] = useState<Array<{
    sheetName: string;
    records: number;
    successRecords: number;
    errorRecords: number;
  }>>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allSheets, setAllSheets] = useState<Sheet[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: "all",
    folderIds: [],
    sheetIds: [],
  });
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      if (isDemoMode()) {
        const folders = await demoApi.listFolders(projectId);

        let totalSheets = 0;
        let totalRecords = 0;
        let totalSuccessRecords = 0;
        let totalErrorRecords = 0;
        let latestValidation: Date | null = null;
        let maxRecordsInSheet = 0;
        let validatedSheetCount = 0;

        const qualityHistory: Array<{
          dateKey: string;
          dateLabel: string;
          totalRecords: number;
          successRecords: number;
        }> = [];

        const sheetRecordsArray: Array<{
          sheetName: string;
          records: number;
          successRecords: number;
          errorRecords: number;
        }> = [];

        const allSheetsArray: Sheet[] = [];

        for (const folder of folders) {
          const sheets = await demoApi.listSheets(projectId, folder.id!);
          sheets.forEach((sheet) => {
            allSheetsArray.push({ ...sheet, folderId: folder.id } as Sheet & { folderId: string });
          });
          totalSheets += sheets.length;

          for (const sheet of sheets) {
            const validationTotal = sheet.lastValidationTotalRows;
            const validationError = sheet.lastValidationErrorRows;
            const validatedAt = sheet.lastValidatedAt;

            const hasValidationStats =
              typeof validationTotal === "number" && typeof validationError === "number";
            if (!hasValidationStats) continue;

            validatedSheetCount += 1;
            const total = Math.max(0, validationTotal);
            const errorCount = Math.max(0, validationError);
            const successCount = Math.max(0, total - errorCount);

            totalRecords += total;
            totalSuccessRecords += successCount;
            totalErrorRecords += errorCount;
            if (total > maxRecordsInSheet) maxRecordsInSheet = total;

            sheetRecordsArray.push({
              sheetName: sheet.title || `Sheet ${sheet.id}`,
              records: total,
              successRecords: successCount,
              errorRecords: errorCount,
            });

            const validationDate = toValidDate(validatedAt);
            if (validationDate) {
              if (!latestValidation || validationDate > latestValidation) latestValidation = validationDate;
              const dateKey = validationDate.toISOString().slice(0, 10);
              const dateLabel = validationDate.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
              qualityHistory.push({ dateKey, dateLabel, totalRecords: total, successRecords: successCount });
            }
          }
        }

        const qualityScore = totalRecords > 0 ? Math.round((totalSuccessRecords / totalRecords) * 100) : 0;
        const avgRecordsPerSheet = validatedSheetCount > 0 ? Math.round(totalRecords / validatedSheetCount) : 0;
        const errorRate = totalRecords > 0 ? Math.round((totalErrorRecords / totalRecords) * 100 * 10) / 10 : 0;
        const avgSheetsPerFolder = folders.length > 0 ? Math.round((totalSheets / folders.length) * 10) / 10 : 0;

        const chartDataMap = new Map<string, { dateLabel: string; totalRecords: number; successRecords: number }>();
        qualityHistory.forEach((item) => {
          if (chartDataMap.has(item.dateKey)) {
            const existing = chartDataMap.get(item.dateKey)!;
            existing.totalRecords += item.totalRecords;
            existing.successRecords += item.successRecords;
          } else {
            chartDataMap.set(item.dateKey, {
              dateLabel: item.dateLabel,
              totalRecords: item.totalRecords,
              successRecords: item.successRecords,
            });
          }
        });

        const aggregatedChartData = Array.from(chartDataMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-10)
          .map(([, data]) => {
            const rate = data.totalRecords > 0 ? (data.successRecords / data.totalRecords) * 100 : 0;
            const score = Math.round(rate);
            return { date: data.dateLabel, qualityScore: score, successRate: score };
          });

        const topSheetRecords = sheetRecordsArray.sort((a, b) => b.records - a.records).slice(0, 10);

        setFolders(folders);
        setAllSheets(allSheetsArray);
        setDashboardData({
          totalSheets,
          totalFolders: folders.length,
          totalRecords,
          totalSuccessRecords,
          totalErrorRecords,
          dataQualityScore: qualityScore,
          lastValidationDate: latestValidation,
          avgRecordsPerSheet,
          errorRate,
          maxRecordsInSheet,
          avgSheetsPerFolder,
        });
        setChartData(aggregatedChartData);
        setSheetRecordsData(topSheetRecords);

        setLoading(false);
        return;
      }

      // フォルダ一覧取得
      const foldersRef = collection(db, `users/${userId}/projects/${projectId}/folders`);
      const foldersSnapshot = await getDocs(query(foldersRef));
      const folders = foldersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Folder[];

      // 全フォルダからシート一覧を取得
      let totalSheets = 0;
      let totalRecords = 0;
      let totalSuccessRecords = 0;
      let totalErrorRecords = 0;
      let latestValidation: Date | null = null;
      let maxRecordsInSheet = 0;
      let validatedSheetCount = 0;

      // チャートデータ用の配列（日付ごとの品質スコア）
      const qualityHistory: Array<{
        dateKey: string; // YYYY-MM-DD
        dateLabel: string; // 例: 12月29日
        totalRecords: number;
        successRecords: number;
      }> = [];

      // シート別レコード数データ
      const sheetRecordsArray: Array<{
        sheetName: string;
        records: number;
        successRecords: number;
        errorRecords: number;
      }> = [];

      // 全シート情報を保存（フィルター用）
      const allSheetsArray: Sheet[] = [];

      for (const folder of folders) {
        const sheetsRef = collection(
          db,
          `users/${userId}/projects/${projectId}/folders/${folder.id}/sheets`
        );
        const sheetsSnapshot = await getDocs(query(sheetsRef));
        const sheets = sheetsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Sheet[];

        // 全シート情報を保存（フォルダIDを追加）
        sheets.forEach((sheet) => {
          allSheetsArray.push({ ...sheet, folderId: folder.id } as Sheet & { folderId: string });
        });

        totalSheets += sheets.length;

        // 各シートのバリデーション結果から件数を集計（ダッシュボードはこれに統一）
        for (const sheet of sheets) {
          const validationTotal = sheet.lastValidationTotalRows;
          const validationError = sheet.lastValidationErrorRows;
          const validatedAt = sheet.lastValidatedAt;

          const hasValidationStats =
            typeof validationTotal === "number" &&
            typeof validationError === "number";

          if (!hasValidationStats) {
            // バリデーション未実行のシートは、集計に含めない
            continue;
          }

          validatedSheetCount += 1;

          const total = Math.max(0, validationTotal);
          const errorCount = Math.max(0, validationError);
          const successCount = Math.max(0, total - errorCount);

          totalRecords += total;
          totalSuccessRecords += successCount;
          totalErrorRecords += errorCount;

          if (total > maxRecordsInSheet) {
            maxRecordsInSheet = total;
          }

          sheetRecordsArray.push({
            sheetName: sheet.title || `Sheet ${sheet.id}`,
            records: total,
            successRecords: successCount,
            errorRecords: errorCount,
          });

          const validationDate = toValidDate(validatedAt);
          if (validationDate) {
            if (!latestValidation || validationDate > latestValidation) {
              latestValidation = validationDate;
            }

            const dateKey = validationDate.toISOString().slice(0, 10);
            const dateLabel = validationDate.toLocaleDateString("ja-JP", {
              month: "short",
              day: "numeric",
            });

            qualityHistory.push({
              dateKey,
              dateLabel,
              totalRecords: total,
              successRecords: successCount,
            });
          }
        }
      }

      // データ品質スコアを計算（成功率）
      const qualityScore = totalRecords > 0
        ? Math.round((totalSuccessRecords / totalRecords) * 100)
        : 0;

      // 追加の集計値を計算
      const avgRecordsPerSheet = validatedSheetCount > 0 
        ? Math.round(totalRecords / validatedSheetCount) 
        : 0;

      const errorRate = totalRecords > 0 
        ? Math.round((totalErrorRecords / totalRecords) * 100 * 10) / 10 // 小数点1桁
        : 0;
      
      const avgSheetsPerFolder = folders.length > 0 
        ? Math.round((totalSheets / folders.length) * 10) / 10 // 小数点1桁
        : 0;

      // チャートデータを日付で集約（レコード数で加重平均）
      const chartDataMap = new Map<
        string,
        { dateLabel: string; totalRecords: number; successRecords: number }
      >();

      qualityHistory.forEach((item) => {
        if (chartDataMap.has(item.dateKey)) {
          const existing = chartDataMap.get(item.dateKey)!;
          existing.totalRecords += item.totalRecords;
          existing.successRecords += item.successRecords;
        } else {
          chartDataMap.set(item.dateKey, {
            dateLabel: item.dateLabel,
            totalRecords: item.totalRecords,
            successRecords: item.successRecords,
          });
        }
      });

      const aggregatedChartData = Array.from(chartDataMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-10)
        .map(([, data]) => {
          const rate = data.totalRecords > 0 ? (data.successRecords / data.totalRecords) * 100 : 0;
          const score = Math.round(rate);
          return {
            date: data.dateLabel,
            qualityScore: score,
            successRate: score,
          };
        });

      // シート別レコード数を降順ソートして上位10件を取得
      const topSheetRecords = sheetRecordsArray
        .sort((a, b) => b.records - a.records)
        .slice(0, 10);

      // フォルダとシート情報を保存
      setFolders(folders);
      setAllSheets(allSheetsArray);

      setDashboardData({
        totalSheets,
        totalFolders: folders.length,
        totalRecords,
        totalSuccessRecords,
        totalErrorRecords,
        dataQualityScore: qualityScore,
        lastValidationDate: latestValidation,
        avgRecordsPerSheet,
        errorRate,
        maxRecordsInSheet,
        avgSheetsPerFolder,
      });
      
      setChartData(aggregatedChartData);
      setSheetRecordsData(topSheetRecords);
    } catch (error) {
      console.error("ダッシュボードデータの取得に失敗:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId, userId]);

  useEffect(() => {
    void loadDashboardData();
    if (!isDemoMode()) return;

    // demo: localStorage 更新（バリデーション実行など）を反映
    const unsub = subscribeDemoState(() => {
      void loadDashboardData();
    });
    return () => unsub();
  }, [loadDashboardData]);

  // フィルター適用された日付範囲を計算
  const getFilteredDateRange = () => {
    const now = new Date();
    switch (filters.dateRange) {
      case "week":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "month":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "3months":
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  };

  // フィルター適用されたデータを返す
  const getFilteredData = () => {
    const dateThreshold = getFilteredDateRange();
    
    // チャートデータのフィルタリング
    let filteredChartData = chartData;
    if (dateThreshold) {
      filteredChartData = chartData.filter(() => {
        // 簡易的な日付比較（実際の実装では適切な日付解析が必要）
        return true; // 現時点では全データを表示
      });
    }
    
    // シート別レコードのフィルタリング
    let filteredSheetRecords = sheetRecordsData;
    if (filters.sheetIds.length > 0 || filters.folderIds.length > 0) {
      const targetSheetIds = new Set<string>();
      
      // フォルダフィルターが適用されている場合
      if (filters.folderIds.length > 0) {
        allSheets
          .filter((sheet) => filters.folderIds.includes((sheet as Sheet & { folderId: string }).folderId || ''))
          .forEach((sheet) => {
            if (sheet.id) targetSheetIds.add(sheet.id);
          });
      }
      
      // シートフィルターが適用されている場合
      if (filters.sheetIds.length > 0) {
        filters.sheetIds.forEach((id) => targetSheetIds.add(id));
      }
      
      // フィルター適用（シート名でマッチング）
      filteredSheetRecords = sheetRecordsData.filter((record) => {
        const matchingSheet = allSheets.find((s) => s.title === record.sheetName);
        return matchingSheet && matchingSheet.id && targetSheetIds.has(matchingSheet.id);
      });
    }
    
    return {
      chartData: filteredChartData,
      sheetRecordsData: filteredSheetRecords,
    };
  };

  const filteredData = getFilteredData();

  return (
    <div>
      {loading ? (
        <Loading message="ダッシュボードデータを読み込み中..." />
      ) : (
        <div>
          {/* フィルター */}
          <DashboardFilter
            folders={folders.filter(f => f.id).map((f) => ({ id: f.id!, name: f.name }))}
            sheets={allSheets.filter(s => s.id).map((s) => ({ 
              id: s.id!, 
              title: s.title || 'Untitled',
              folderId: (s as Sheet & { folderId: string }).folderId || ''
            }))}
            filters={filters}
            onChange={setFilters}
          />

          {/* KPIカードグリッド - 上段 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <KPICard
              title="総シート数"
              value={dashboardData.totalSheets}
              subtitle={`${dashboardData.totalFolders} フォルダ`}
              loading={loading}
            />

            <KPICard
              title="総レコード数"
              value={dashboardData.totalRecords.toLocaleString()}
              subtitle={`成功: ${dashboardData.totalSuccessRecords.toLocaleString()}`}
              loading={loading}
            />

            <KPICard
              title="データ品質"
              value={`${dashboardData.dataQualityScore}%`}
              subtitle={`エラー: ${dashboardData.totalErrorRecords.toLocaleString()}件`}
              loading={loading}
            />

            <KPICard
              title="データ鮮度"
              value={
                dashboardData.lastValidationDate
                  ? getFreshness(dashboardData.lastValidationDate)
                  : "N/A"
              }
              subtitle={
                dashboardData.lastValidationDate
                  ? new Date(dashboardData.lastValidationDate).toLocaleString(
                      "ja-JP",
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )
                  : "未バリデーション"
              }
              loading={loading}
            />
          </div>

          {/* KPIカードグリッド - 下段（拡張指標） */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KPICard
              title="平均レコード数/シート"
              value={dashboardData.avgRecordsPerSheet.toLocaleString()}
              subtitle={dashboardData.totalRecords > 0 ? "バリデーション済みシートの平均" : "データなし"}
              loading={loading}
            />

            <KPICard
              title="エラー率"
              value={`${dashboardData.errorRate}%`}
              subtitle={`${dashboardData.totalErrorRecords.toLocaleString()} / ${dashboardData.totalRecords.toLocaleString()} 件`}
              loading={loading}
            />

            <KPICard
              title="最大シートサイズ"
              value={dashboardData.maxRecordsInSheet.toLocaleString()}
              subtitle="レコード数"
              loading={loading}
            />

            <KPICard
              title="平均シート数/フォルダ"
              value={dashboardData.avgSheetsPerFolder}
              subtitle={dashboardData.totalFolders > 0 ? `${dashboardData.totalFolders} フォルダの平均` : "データなし"}
              loading={loading}
            />
          </div>

          {/* チャートエリア */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                シート別レコード数（上位10件）
              </h3>
              <SheetRecordsChart data={filteredData.sheetRecordsData} />
            </div>

            <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                データ品質推移
              </h3>
              <DataQualityChart data={filteredData.chartData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// データ鮮度を計算するヘルパー関数
function getFreshness(lastSync: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(lastSync).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return "最新";
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;
  return "要更新";
}
