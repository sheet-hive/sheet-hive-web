"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../../lib/firebase";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  return (
    <header className="w-full bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
      <div className="w-full px-4 py-1.5 flex items-center">
        {/* 左端: Homeボタン */}
        <div className="flex-shrink-0">
          <Link href="/" className="block hover:opacity-80 transition-opacity" aria-label="トップへ戻る">
            <Image
              src="/logo_light.png"
              alt="SheetHive Logo"
              width={120}
              height={36}
              priority
              className="h-9 w-auto dark:hidden"
            />
            <Image
              src="/logo_dark.png"
              alt="SheetHive Logo"
              width={120}
              height={36}
              priority
              className="h-9 w-auto hidden dark:block"
            />
          </Link>
        </div>

        {/* 中央: 拡張可能な空白 */}
        <div className="flex-grow"></div>

        {/* 右端: プロフィールボタン */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <div className="text-sm text-gray-700 dark:text-gray-200">{user ? user.displayName : ""}</div>
          <Link href="/profile" className="p-2 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-black dark:text-white" aria-label="プロフィールへ">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.63 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
