"use client";

type Props = {
  label: string;

  enabled: boolean;
  setEnabled: (enabled: boolean) => void;

  text: string;
  setText: (text: string) => void;

  canEdit: boolean;

  placeholder?: string;

  normalizeOnCommit?: (text: string) => string;

  onCommit: (enabled: boolean, value: string) => void;
};

export default function RuleToggleTextInput(props: Props) {
  const { label, enabled, setEnabled, text, setText, canEdit, placeholder, normalizeOnCommit, onCommit } = props;

  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-3 text-sm text-neutral-700 dark:text-neutral-300">
        <span>{label}</span>
        <span className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              const next = e.target.checked;
              setEnabled(next);
              if (!next) {
                setText("");
                onCommit(false, "");
              }
            }}
            disabled={!canEdit}
          />
          有効
        </span>
      </label>

      <input
        type="text"
        value={text}
        onChange={(e) => {
          const nextText = e.target.value;
          setText(nextText);
          if (!enabled && nextText.trim() !== "") {
            setEnabled(true);
          }
        }}
        onBlur={() => {
          if (!canEdit) return;
          if (!enabled) return;

          const normalized = normalizeOnCommit ? normalizeOnCommit(text) : text.trim();
          if (!normalized) {
            setEnabled(false);
            setText("");
            onCommit(false, "");
            return;
          }

          onCommit(true, normalized);
        }}
        disabled={!canEdit}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded text-sm"
      />
    </div>
  );
}
