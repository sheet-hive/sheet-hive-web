"use client";

import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  children: ReactNode;
};

export default function SelectField(props: Props) {
  const { label, value, onChange, disabled, children } = props;

  return (
    <div className="space-y-2">
      <div className="text-sm text-neutral-700 dark:text-neutral-300">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded text-sm"
      >
        {children}
      </select>
    </div>
  );
}
