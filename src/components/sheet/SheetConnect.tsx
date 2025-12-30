"use client";
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { fetchSheetMetadata, isTokenExpiredError } from "../../lib/sheets";

function extractSheetId(input: string) {
  const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  // assume raw id
  return input.trim();
}

type SheetConnectProps = {
  projectId?: string;
  folderId?: string;
  onSheetAdded?: () => void;
};

export default function SheetConnect({ projectId, folderId, onSheetAdded }: SheetConnectProps) {
  const [user, setUser] = useState<User | null>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubAuth();
  }, []);

  const addSheet = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) return alert("ログインしてください");
    const sheetId = extractSheetId(input);
    if (!sheetId) return alert("シートIDを入力してね");
    
    try {
      // Google Sheets API でメタデータを取得
      let title: string | null = null;
      let sheetCount = 0;
      let isAccessible = false;
      let lastError: string | null = null;
      
      try {
        const metadata = await fetchSheetMetadata(sheetId);
        title = metadata.title;
        sheetCount = metadata.sheets?.length ?? 0;
        isAccessible = true;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Failed to fetch sheet metadata:", err);
        
        // トークン期限切れの場合は特別に処理
        if (err instanceof Error && isTokenExpiredError(err)) {
          alert("アクセストークンの有効期限が切れました。一度サインアウトして、再度サインインしてください。");
          return; // シート登録を中止
        }
        
        // その他のエラーの場合は、メタデータ取得に失敗してもシート登録は続行
        isAccessible = false;
        lastError = err instanceof Error ? err.message : "メタデータの取得に失敗しました";
      }

      const ref = projectId && folderId
        ? doc(db, "users", user.uid, "projects", projectId, "folders", folderId, "sheets", sheetId)
        : doc(db, "users", user.uid, "sheets", sheetId);
      
      await setDoc(
        ref,
        {
          sheetId,
          url: input,
          title,
          sheetCount,
          addedAt: serverTimestamp(),
          lastFetched: serverTimestamp(),
          isAccessible,
          lastError,
        },
        { merge: true }
      );
      
      setInput("");
      if (onSheetAdded) onSheetAdded();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      alert("シートの保存に失敗しました");
    }
  };

  return (
    <div className="max-w-2xl p-6 bg-white dark:bg-neutral-900 text-black dark:text-white rounded shadow-lg">
      <h2 className="text-xl font-semibold mb-4">シートを追加</h2>
      <form onSubmit={addSheet} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="スプレッドシートのURLまたはIDを入力"
          className="flex-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-black dark:text-white px-3 py-2 rounded"
        />
        <button className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-gray-200">追加</button>
      </form>
    </div>
  );
}
