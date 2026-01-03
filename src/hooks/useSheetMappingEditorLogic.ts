import { useEffect, useState } from "react";
import type { DataType, FieldMapping, SheetMapping } from "@/models/mapping";
import { generateAutoMapping } from "@/lib/dataMapping";

function cloneForEdit(m: SheetMapping): SheetMapping {
  return {
    ...m,
    fields: m.fields.map((f) => ({ ...f })),
  };
}

export function useSheetMappingEditorLogic(input: {
  sheetData: string[][];
  initialMapping?: SheetMapping;
  initialHasChanges?: boolean;
  onSave: (mapping: SheetMapping) => Promise<void>;
  onHasChangesChange?: (hasChanges: boolean) => void;
  onNotify?: (title: string, message: string) => void;
}) {
  const { sheetData, initialMapping, initialHasChanges, onSave, onHasChangesChange, onNotify } = input;

  const [mapping, setMapping] = useState<SheetMapping | null>(() =>
    initialMapping ? cloneForEdit(initialMapping) : null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(() => initialHasChanges ?? false);

  useEffect(() => {
    onHasChangesChange?.(hasChanges);
  }, [hasChanges, onHasChangesChange]);

  // 親から mapping が更新されたときは同期する（ただし編集中の上書きはしない）
  useEffect(() => {
    if (!initialMapping) return;
    if (hasChanges) return;
    setMapping(cloneForEdit(initialMapping));
    setHasChanges(initialHasChanges ?? false);
  }, [initialMapping, initialHasChanges, hasChanges]);

  // 初回マウント時に自動検出（初期マッピングがない場合）
  useEffect(() => {
    if (!initialMapping && sheetData.length > 0) {
      try {
        const autoMapping = generateAutoMapping(sheetData);
        setMapping(cloneForEdit(autoMapping));
        setHasChanges(true);
      } catch (error) {
        console.error("マッピング推定エラー:", error);
        alert("マッピング推定に失敗しました");
      }
    }
  }, [initialMapping, sheetData]);

  const handleFieldNameChange = (index: number, newName: string) => {
    setMapping((prev) => {
      if (!prev) return prev;
      const nextFields = prev.fields.map((f, i) => (i === index ? { ...f, fieldName: newName } : f));
      return { ...prev, fields: nextFields };
    });
    setHasChanges(true);
  };

  const handleDataTypeChange = (index: number, newType: DataType) => {
    setMapping((prev) => {
      if (!prev) return prev;
      const nextFields = prev.fields.map((f, i) => (i === index ? { ...f, dataType: newType } : f));
      return { ...prev, fields: nextFields };
    });
    setHasChanges(true);
  };

  const handleRemoveMapping = (index: number) => {
    setMapping((prev) => {
      if (!prev) return prev;
      const nextFields = prev.fields.filter((_, i) => i !== index);
      return { ...prev, fields: nextFields };
    });
    setHasChanges(true);
  };

  const handleHeaderRowChange = (newRow: number) => {
    setMapping((prev) => {
      if (!prev) return prev;
      const nextFields = prev.fields.map((m: FieldMapping) => ({
        ...m,
        columnName: sheetData[newRow]?.[m.columnIndex] || `Column ${m.columnIndex}`,
      }));
      return {
        ...prev,
        headerRowIndex: newRow,
        dataStartRowIndex: newRow + 1,
        fields: nextFields,
      };
    });
    setHasChanges(true);
  };

  const handleKeyColumnChange = (newColIndex: number) => {
    setMapping((prev) => {
      if (!prev) return prev;
      return { ...prev, keyColumnIndex: newColIndex };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!mapping) return;
    setIsSaving(true);
    try {
      await onSave(mapping);
      setHasChanges(false);
      if (onNotify) onNotify("マッピング保存", "マッピング設定を保存しました");
      else alert("マッピング設定を保存しました");
    } catch (error) {
      console.error("保存エラー:", error);
      if (onNotify) onNotify("マッピング保存", "保存に失敗しました");
      else alert("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    mapping,
    isSaving,
    hasChanges,
    handleFieldNameChange,
    handleDataTypeChange,
    handleRemoveMapping,
    handleHeaderRowChange,
    handleKeyColumnChange,
    handleSave,
  };
}
