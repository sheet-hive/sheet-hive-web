"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { isDemoMode } from "@/lib/appMode";
import { subscribeAuthUser, type AppUser } from "@/lib/authState";

export default function Header() {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const unsub = subscribeAuthUser((u) => setUser(u));
    return () => unsub();
  }, []);

  return (
    <header className="w-full bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
      <div className="w-full px-2 sm:px-4 py-1.5 flex items-center">
        {/* 左端: Homeボタン */}
        <div className="flex-shrink-0">
          <Link href="/" className="block hover:opacity-80 transition-opacity" aria-label="トップへ戻る">
            <Image
              src="/logo_light.png"
              alt="SheetHive Logo"
              width={120}
              height={36}
              priority
              className="h-7 sm:h-9 w-auto dark:hidden"
            />
            <Image
              src="/logo_dark.png"
              alt="SheetHive Logo"
              width={120}
              height={36}
              priority
              className="h-7 sm:h-9 w-auto hidden dark:block"
            />
          </Link>
        </div>

        {/* 中央: 拡張可能な空白 */}
        <div className="flex-grow"></div>

        {/* 右端: プロフィールボタン */}
        <div className="flex-shrink-0 flex items-center gap-1 sm:gap-3">
          {isDemoMode() && (
            <div className="text-xs px-1.5 sm:px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200">
              Demo
            </div>
          )}
          <div className="hidden sm:block text-sm text-gray-700 dark:text-gray-200">{user ? user.displayName : ""}</div>
          <Link href="/profile" className="p-1.5 sm:p-2 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-black dark:text-white" aria-label="プロフィールへ">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.63 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
