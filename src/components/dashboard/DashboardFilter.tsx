"use client";

import React, { useState } from "react";

export interface DashboardFilters {
  dateRange: "all" | "week" | "month" | "3months";
  folderIds: string[];
  sheetIds: string[];
}

interface DashboardFilterProps {
  folders: Array<{ id: string; name: string }>;
  sheets: Array<{ id: string; title: string; folderId: string }>;
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}

export default function DashboardFilter({
  folders,
  sheets,
  filters,
  onChange,
}: DashboardFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDateRangeChange = (range: DashboardFilters["dateRange"]) => {
    onChange({ ...filters, dateRange: range });
  };

  const handleFolderToggle = (folderId: string) => {
    const newFolderIds = filters.folderIds.includes(folderId)
      ? filters.folderIds.filter((id) => id !== folderId)
      : [...filters.folderIds, folderId];
    onChange({ ...filters, folderIds: newFolderIds });
  };

  const handleSheetToggle = (sheetId: string) => {
    const newSheetIds = filters.sheetIds.includes(sheetId)
      ? filters.sheetIds.filter((id) => id !== sheetId)
      : [...filters.sheetIds, sheetId];
    onChange({ ...filters, sheetIds: newSheetIds });
  };

  const handleResetFilters = () => {
    onChange({
      dateRange: "all",
      folderIds: [],
      sheetIds: [],
    });
  };

  // フィルタリングされたシートを表示
  const filteredSheets = filters.folderIds.length > 0
    ? sheets.filter((sheet) => filters.folderIds.includes(sheet.folderId))
    : sheets;

  const activeFilterCount =
    (filters.dateRange !== "all" ? 1 : 0) +
    filters.folderIds.length +
    filters.sheetIds.length;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 mb-6">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
              フィルター
            </h3>
            {activeFilterCount > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                {activeFilterCount} 件適用中
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                リセット
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            >
              {isExpanded ? "▲" : "▼"}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* 日付範囲フィルター */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                期間
              </label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "all", label: "全期間" },
                  { value: "week", label: "1週間" },
                  { value: "month", label: "1ヶ月" },
                  { value: "3months", label: "3ヶ月" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      handleDateRangeChange(
                        option.value as DashboardFilters["dateRange"]
                      )
                    }
                    className={`px-3 py-1 text-xs rounded border ${
                      filters.dateRange === option.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-600"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* フォルダフィルター */}
            {folders.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  フォルダ
                </label>
                <div className="flex gap-2 flex-wrap">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleFolderToggle(folder.id)}
                      className={`px-3 py-1 text-xs rounded border ${
                        filters.folderIds.includes(folder.id)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-600"
                      }`}
                    >
                      {folder.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* シートフィルター */}
            {filteredSheets.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  シート {filters.folderIds.length > 0 && "(選択フォルダのみ)"}
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {filteredSheets.map((sheet) => (
                    <label
                      key={sheet.id}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.sheetIds.includes(sheet.id)}
                        onChange={() => handleSheetToggle(sheet.id)}
                        className="rounded border-neutral-300 dark:border-neutral-600"
                      />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">
                        {sheet.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
