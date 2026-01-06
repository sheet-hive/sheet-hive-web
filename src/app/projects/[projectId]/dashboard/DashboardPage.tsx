"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { collection, query, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isDemoMode } from "@/lib/appMode";
import { demoApi } from "@/demo/demoApi";
import { subscribeDemoState } from "@/demo/demoStore";
import { Folder } from "@/models/folder";
import { Sheet } from "@/models/sheet";
import { Project } from "@/models/project";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import KPICard from "@/components/dashboard/KPICard";

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
  dataQualityScore: number; // 0-100のスコア
  lastValidationDate: Date | null;
}

export default function DashboardPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalSheets: 0,
    totalFolders: 0,
    totalRecords: 0,
    totalSuccessRecords: 0,
    totalErrorRecords: 0,
    dataQualityScore: 0,
    lastValidationDate: null,
  });
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      if (isDemoMode()) {
        const project = await demoApi.getProject(projectId);
        setProject(project);

        const folders = await demoApi.listFolders(projectId);

        let totalSheets = 0;
        let totalRecords = 0;
        let totalSuccessRecords = 0;
        let totalErrorRecords = 0;
        let latestValidation: Date | null = null;

        for (const folder of folders) {
          if (!folder.id) continue;
          const sheets = await demoApi.listSheets(projectId, folder.id);
          totalSheets += sheets.length;

          for (const sheet of sheets) {
            const validationTotal = sheet.lastValidationTotalRows;
            const validationError = sheet.lastValidationErrorRows;
            const validatedAt = sheet.lastValidatedAt;

            const hasValidationStats = typeof validationTotal === "number" && typeof validationError === "number";
            if (hasValidationStats) {
              const total = Math.max(0, validationTotal);
              const errorCount = Math.max(0, validationError);
              const successCount = Math.max(0, total - errorCount);
              totalRecords += total;
              totalSuccessRecords += successCount;
              totalErrorRecords += errorCount;
            }

            if (validatedAt) {
              const validationDate = toValidDate(validatedAt);
              if (validationDate && (!latestValidation || validationDate > latestValidation)) {
                latestValidation = validationDate;
              }
            }
          }
        }

        const qualityScore = totalRecords > 0 ? Math.round((totalSuccessRecords / totalRecords) * 100) : 0;

        setDashboardData({
          totalSheets,
          totalFolders: folders.length,
          totalRecords,
          totalSuccessRecords,
          totalErrorRecords,
          dataQualityScore: qualityScore,
          lastValidationDate: latestValidation,
        });

        return;
      }

      // プロジェクト情報取得
      const projectDoc = await getDoc(doc(db, `projects/${projectId}`));
      if (projectDoc.exists()) {
        setProject({ id: projectDoc.id, ...projectDoc.data() } as Project);
      }

      // フォルダ一覧取得
      const foldersRef = collection(db, `projects/${projectId}/folders`);
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

      for (const folder of folders) {
        const sheetsRef = collection(
          db,
          `projects/${projectId}/folders/${folder.id}/sheets`
        );
        const sheetsSnapshot = await getDocs(query(sheetsRef));
        const sheets = sheetsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Sheet[];

        totalSheets += sheets.length;

        // 各シートのバリデーション結果から件数を集計
        for (const sheet of sheets) {
          const validationTotal = sheet.lastValidationTotalRows;
          const validationError = sheet.lastValidationErrorRows;
          const validatedAt = sheet.lastValidatedAt;

          const hasValidationStats =
            typeof validationTotal === "number" &&
            typeof validationError === "number";

          if (hasValidationStats) {
            const total = Math.max(0, validationTotal);
            const errorCount = Math.max(0, validationError);
            const successCount = Math.max(0, total - errorCount);

            totalRecords += total;
            totalSuccessRecords += successCount;
            totalErrorRecords += errorCount;
          }

          if (validatedAt) {
            const validationDate = toValidDate(validatedAt);
            if (validationDate && (!latestValidation || validationDate > latestValidation)) {
              latestValidation = validationDate;
            }
          }
        }
      }

      // データ品質スコアを計算（成功率）
      const qualityScore = totalRecords > 0
        ? Math.round((totalSuccessRecords / totalRecords) * 100)
        : 0;

      setDashboardData({
        totalSheets,
        totalFolders: folders.length,
        totalRecords,
        totalSuccessRecords,
        totalErrorRecords,
        dataQualityScore: qualityScore,
        lastValidationDate: latestValidation,
      });
    } catch (error) {
      console.error("ダッシュボードデータの取得に失敗:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDashboardData();
    if (!isDemoMode()) return;

    const unsub = subscribeDemoState(() => {
      void loadDashboardData();
    });
    return () => unsub();
  }, [loadDashboardData]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-900">
      <Header />
      <div className="flex flex-1">
        <Sidebar menuItems={[]} />
        <main className="flex-1 p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-neutral-500">読み込み中...</div>
            </div>
          ) : (
            <div>
              {/* ヘッダー */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
                  {project?.title || "プロジェクト"} ダッシュボード
                </h1>
                <p className="text-neutral-600 dark:text-neutral-400">
                  プロジェクト全体のKPIと分析結果を表示
                </p>
              </div>

              {/* KPIカードグリッド */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KPICard
                  title="総シート数"
                  value={dashboardData.totalSheets}
                  subtitle={`${dashboardData.totalFolders} フォルダ`}
                  loading={loading}
                />

                <KPICard
                  title="総レコード数"
                  value={dashboardData.totalRecords}
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

              {/* チャートエリア（プレースホルダー） */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    シート別レコード数
                  </h3>
                  <div className="h-64 flex items-center justify-center text-neutral-400">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📊</div>
                      <div>チャートは次のスプリントで実装</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    データ品質スコア
                  </h3>
                  <div className="h-64 flex items-center justify-center text-neutral-400">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📈</div>
                      <div>チャートは次のスプリントで実装</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
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
