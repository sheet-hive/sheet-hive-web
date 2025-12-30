"use client";

import type { ReactNode } from "react";

type SettingsBoxProps = {
  title: string;
  children: ReactNode;
};

export default function SettingsBox({ title, children }: SettingsBoxProps) {
  return (
    <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}
