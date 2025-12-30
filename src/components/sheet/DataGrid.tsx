"use client";
import React from "react";
import Loading from "../layout/Loading";
import { useDataGridLogic } from "@/hooks/useDataGridLogic";

type DataGridProps = {
  data: string[][];
  loading?: boolean;
};

export default function DataGrid({ data, loading }: DataGridProps) {
  const {
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    tableData,
    columns,
    table,
    rows,
    rowVirtualizer,
    tableContainerRef,
    flexRender,
  } = useDataGridLogic({ data });

  if (loading) {
    return <Loading message="データを読み込んでいます..." />;
  }

  if (data.length === 0) {
    return <div className="p-8 text-center text-neutral-500">データがありません</div>;
  }

  return (
    <div className="w-full h-full flex flex-col min-w-0">
      {/* グローバル検索とフィルター情報 */}
      <div className="mb-4 p-4 bg-neutral-100 dark:bg-neutral-800 rounded space-y-3">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="全体を検索..."
            className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 rounded text-sm"
          />
          {(globalFilter || columnFilters.length > 0) && (
            <button
              onClick={() => {
                setGlobalFilter("");
                setColumnFilters([]);
              }}
              className="px-3 py-2 text-sm bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded"
            >
              フィルタークリア
            </button>
          )}
        </div>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          {rows.length.toLocaleString()} / {tableData.length.toLocaleString()} 行表示 × {columns.length} 列
          {columnFilters.length > 0 && (
            <span className="ml-2 text-blue-600 dark:text-blue-400">
              ({columnFilters.length} カラムフィルター適用中)
            </span>
          )}
        </div>
      </div>

      <div
        ref={tableContainerRef}
        className="overflow-x-auto overflow-y-auto max-w-full border border-neutral-300 dark:border-neutral-700 rounded"
        style={{ height: "600px" }}
      >
        <table className="min-w-max w-full border-collapse">
          <thead className="bg-neutral-100 dark:bg-neutral-800 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <React.Fragment key={headerGroup.id}>
                <tr>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-left text-sm font-semibold"
                    >
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: " 🔼",
                          desc: " 🔽",
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    </th>
                  ))}
                </tr>
                {/* カラムフィルター行 */}
                <tr>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={`${header.id}-filter`}
                      className="border border-neutral-300 dark:border-neutral-600 px-2 py-1 bg-neutral-50 dark:bg-neutral-900"
                    >
                      <input
                        type="text"
                        value={(header.column.getFilterValue() ?? "") as string}
                        onChange={(e) => header.column.setFilterValue(e.target.value)}
                        placeholder="フィルター..."
                        className="w-full px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                  ))}
                </tr>
              </React.Fragment>
            ))}
          </thead>
          <tbody>
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <>
                {/* 上部の空白スペース */}
                {rowVirtualizer.getVirtualItems()[0]?.start > 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }}
                    />
                  </tr>
                )}
                
                {/* 実際に表示される行 */}
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="border border-neutral-300 dark:border-neutral-600 px-3 py-1 text-sm"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                
                {/* 下部の空白スペース */}
                {(() => {
                  const lastItem = rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1];
                  const paddingBottom = lastItem
                    ? rowVirtualizer.getTotalSize() - (lastItem.start + lastItem.size)
                    : 0;
                  return paddingBottom > 0 ? (
                    <tr>
                      <td colSpan={columns.length} style={{ height: `${paddingBottom}px` }} />
                    </tr>
                  ) : null;
                })()}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
