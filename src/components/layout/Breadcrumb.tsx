"use client";
import React from "react";
import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  maxVisible?: number; // 表示する最大アイテム数（デフォルト: 4）
  onBeforeNavigate?: (href: string) => boolean;
};

export default function Breadcrumb({ items, maxVisible = 4, onBeforeNavigate }: BreadcrumbProps) {
  // 階層が深い場合は中間を省略
  const displayItems = React.useMemo(() => {
    if (items.length <= maxVisible) {
      return items;
    }

    // 最初と最後の2つを表示、中間を省略
    const firstItems = items.slice(0, 1);
    const lastItems = items.slice(-2);
    
    return [
      ...firstItems,
      { label: "...", href: undefined },
      ...lastItems,
    ];
  }, [items, maxVisible]);

  return (
    <nav className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
      {displayItems.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="text-neutral-400 dark:text-neutral-600">›</span>
          )}
          {item.href ? (
            <Link
              href={item.href}
              onClick={(e) => {
                if (!item.href) return;
                if (!onBeforeNavigate) return;
                const ok = onBeforeNavigate(item.href);
                if (!ok) e.preventDefault();
              }}
              className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className={index === displayItems.length - 1 ? "font-medium text-black dark:text-white" : ""}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
