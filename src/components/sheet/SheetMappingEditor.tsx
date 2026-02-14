"use client";
import { FieldMapping, DataType, SheetMapping } from "@/models/mapping";
import { useSheetMappingEditorLogic } from "@/hooks/useSheetMappingEditorLogic";
import InfoDialog from "@/components/common/InfoDialog";
import { useCallback, useState } from "react";

type SheetMappingEditorProps = {
  sheetData: string[][];
  initialMapping?: SheetMapping;
  initialHasChanges?: boolean;
  onSave: (mapping: SheetMapping) => Promise<void>;
  onHasChangesChange?: (hasChanges: boolean) => void;
};

const dataTypeLabels: Record<DataType, string> = {
  string: "文字列",
  integer: "整数",
  decimal: "小数",
  date: "日付",
  time: "時刻",
  datetime: "日時",
  boolean: "真偽値",
  phone: "電話番号",
  unknown: "不明",
  number: "数値(旧)",
};

const dataTypeColors: Record<DataType, string> = {
  string: "bg-orange-100 dark:bg-orange-700 text-orange-800 dark:text-orange-100",
  integer: "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100",
  decimal: "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100",
  date: "bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-100",
  time: "bg-sky-100 dark:bg-sky-800 text-sky-800 dark:text-sky-100",
  datetime: "bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100",
  boolean: "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100",
  phone: "bg-yellow-100 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-100",
  unknown: "bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100",
  number: "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100",
};

export default function SheetMappingEditor({
  sheetData,
  initialMapping,
  initialHasChanges,
  onSave,
  onHasChangesChange,
}: SheetMappingEditorProps) {
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [infoDialogTitle, setInfoDialogTitle] = useState("");
  const [infoDialogMessage, setInfoDialogMessage] = useState("");

  const openInfoDialog = useCallback((title: string, message: string) => {
    setInfoDialogTitle(title);
    setInfoDialogMessage(message);
    setInfoDialogOpen(true);
  }, []);

  const closeInfoDialog = useCallback(() => {
    setInfoDialogOpen(false);
  }, []);

  const {
    mapping,
    isSaving,
    hasChanges,
    handleFieldNameChange,
    handleDataTypeChange,
    handleRemoveMapping,
    handleHeaderRowChange,
    handleKeyColumnChange,
    handleSave,
  } = useSheetMappingEditorLogic({
    sheetData,
    initialMapping,
    initialHasChanges,
    onSave,
    onHasChangesChange,
    onNotify: openInfoDialog,
  });

  if (!mapping) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">マッピングを推定中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InfoDialog
        open={infoDialogOpen}
        title={infoDialogTitle}
        message={infoDialogMessage}
        onClose={closeInfoDialog}
      />

      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">マッピング設定</h2>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            シートのカラム名・フィールド名・データ型（推定/指定）を設定します
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {/* 基本設定 */}
      <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
        <h3 className="font-semibold mb-3">基本設定</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">
              ヘッダ行
            </label>
            <select
              value={mapping.headerRowIndex}
              onChange={(e) => handleHeaderRowChange(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded"
            >
              {sheetData.slice(0, 5).map((_, idx) => (
                <option key={idx} value={idx}>
                  {idx + 1}行目
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">
              データ開始行
            </label>
            <div className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded">
              {mapping.dataStartRowIndex + 1}行目
            </div>
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1">キー列</label>
            <select
              value={String(mapping.keyColumnIndex ?? 0)}
              onChange={(e) => handleKeyColumnChange(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded"
            >
              {mapping.fields
                .slice()
                .sort((a, b) => a.columnIndex - b.columnIndex)
                .map((f) => (
                  <option key={f.columnIndex} value={String(f.columnIndex)}>
                    {f.columnIndex + 1}: {f.columnName}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* マッピング一覧 */}
      <div className="border border-neutral-300 dark:border-neutral-600 rounded-lg overflow-x-auto">
        <table className="w-full min-w-max">{/* prevent wrapping on small screens */}
          <thead className="bg-neutral-100 dark:bg-neutral-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold w-12">列</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">カラム名</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">フィールド名</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">データ型</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">サンプル</th>
              <th className="px-4 py-3 text-left text-sm font-semibold w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {mapping.fields.map((fieldMapping: FieldMapping, index: number) => {
              // サンプルデータ取得
              const sampleData = sheetData
                .slice(mapping.dataStartRowIndex, mapping.dataStartRowIndex + 3)
                .map((row) => row[fieldMapping.columnIndex])
                .filter((v) => v);

              return (
                <tr key={index} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                    {fieldMapping.columnIndex + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{fieldMapping.columnName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={fieldMapping.fieldName}
                      onChange={(e) => handleFieldNameChange(index, e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="フィールド名"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={fieldMapping.dataType}
                      onChange={(e) => handleDataTypeChange(index, e.target.value as DataType)}
                      className={`w-full px-2 py-1 text-xs font-semibold rounded ${
                        dataTypeColors[fieldMapping.dataType]
                      }`}
                    >
                      {Object.entries(dataTypeLabels).map(([type, label]) => (
                        <option key={type} value={type}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate max-w-[200px]">
                      {sampleData.length > 0 ? sampleData.join(", ") : "(データなし)"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRemoveMapping(index)}
                      className="text-red-600 hover:text-red-700 text-sm"
                      title="削除"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
        <div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">マッピング数</div>
          <div className="text-2xl font-bold">{mapping.fields.length}</div>
        </div>
        <div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">データ行数</div>
          <div className="text-2xl font-bold">
            {sheetData.length - mapping.dataStartRowIndex}
          </div>
        </div>
        <div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">変更</div>
          <div className="text-2xl font-bold">
            {hasChanges ? "⚠️ 未保存" : "✅ 保存済"}
          </div>
        </div>
      </div>
    </div>
  );
}
