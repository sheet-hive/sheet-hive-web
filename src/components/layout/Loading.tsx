import React from "react";

type LoadingProps = {
  message?: string;
  fullScreen?: boolean; // 全画面表示かどうか
};

export default function Loading({ message = "読み込み中...", fullScreen = false }: LoadingProps) {
  const containerClass = fullScreen
    ? "fixed inset-0 flex items-center justify-center bg-white dark:bg-neutral-900 z-50"
    : "flex items-center justify-center p-12";

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center gap-4">
        {/* スピナーアニメーション */}
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-neutral-200 dark:border-neutral-700 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-600 dark:border-blue-400 rounded-full border-t-transparent animate-spin"></div>
        </div>
        {/* メッセージ */}
        <p className="text-neutral-600 dark:text-neutral-400 text-sm">{message}</p>
      </div>
    </div>
  );
}
