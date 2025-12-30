"use client";

type Props = {
  label: string;

  value: string;
  setValue: (value: string) => void;

  canEdit: boolean;

  placeholder?: string;
  normalizeOnCommit?: (value: string) => string;
  onCommit: (value: string) => void;
};

export default function TextField(props: Props) {
  const { label, value, setValue, canEdit, placeholder, normalizeOnCommit, onCommit } = props;

  return (
    <div className="space-y-2">
      <div className="text-sm text-neutral-700 dark:text-neutral-300">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (!canEdit) return;
          const normalized = normalizeOnCommit ? normalizeOnCommit(value) : value;
          onCommit(normalized);
        }}
        disabled={!canEdit}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded text-sm"
      />
    </div>
  );
}
