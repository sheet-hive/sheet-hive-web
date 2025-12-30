"use client";

type Props = {
  label: string;

  enabled: boolean;
  setEnabled: (enabled: boolean) => void;

  text: string;
  setText: (text: string) => void;

  canEdit: boolean;

  input: {
    min?: number;
    step?: number | "any";
    placeholder?: string;
  };

  autoEnableWhenValidNumber: (n: number) => boolean;
  normalizeOnCommit?: (n: number) => number;

  onCommit: (enabled: boolean, value: number | null) => void;
};

export default function RuleToggleNumberInput(props: Props) {
  const { label, enabled, setEnabled, text, setText, canEdit, input, autoEnableWhenValidNumber, normalizeOnCommit, onCommit } =
    props;

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
                onCommit(false, null);
              }
            }}
            disabled={!canEdit}
          />
          有効
        </span>
      </label>

      <input
        type="number"
        min={input.min}
        step={input.step}
        value={text}
        onChange={(e) => {
          const nextText = e.target.value;
          setText(nextText);

          if (!enabled) {
            const n = Number(nextText);
            if (Number.isFinite(n) && autoEnableWhenValidNumber(n)) {
              setEnabled(true);
            }
          }
        }}
        onBlur={() => {
          if (!canEdit) return;
          if (!enabled) return;

          const n = Number(text);
          if (!Number.isFinite(n) || !autoEnableWhenValidNumber(n)) {
            setEnabled(false);
            setText("");
            onCommit(false, null);
            return;
          }

          const normalized = normalizeOnCommit ? normalizeOnCommit(n) : n;
          onCommit(true, normalized);
        }}
        disabled={!canEdit}
        placeholder={input.placeholder}
        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded text-sm"
      />
    </div>
  );
}
