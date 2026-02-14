"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type MenuItem = {
  label: string;
  href: string;
  disabled?: boolean;
};

type SidebarProps = {
  menuItems: MenuItem[];
};

export default function Sidebar({ menuItems }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* ハンバーガーメニューボタン (モバイルのみ表示) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-16 left-2 z-50 p-2 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 md:hidden"
        aria-label="メニューを開く"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* オーバーレイ (モバイルでメニューが開いているとき) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`
          fixed md:static top-0 left-0 h-full z-40 
          w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 p-4
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <nav className="pt-16 md:pt-0">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.label}>
                {item.disabled ? (
                  <div className="flex items-center gap-3 px-3 py-2 rounded text-neutral-400 cursor-not-allowed">
                    <span>{item.label}</span>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                      pathname === item.href
                        ? "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white font-medium"
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span>{item.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
