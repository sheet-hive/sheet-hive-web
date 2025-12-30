"use client";

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  rightLabel: string;
};

export default function ToggleRow(props: Props) {
  const { label, checked, onChange, disabled, rightLabel } = props;

  return (
    <label className="flex items-center justify-between gap-3 text-sm text-neutral-700 dark:text-neutral-300">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
        {rightLabel}
      </span>
    </label>
  );
}
