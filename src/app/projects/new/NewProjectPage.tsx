"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import Sidebar from "@/components/layout/Sidebar";
import { isDemoMode } from "@/lib/appMode";
import { subscribeAuthUser, type AppUser } from "@/lib/authState";
import { demoApi } from "@/demo/demoApi";

export default function NewProjectPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("進行中");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeAuthUser((u) => setUser(u));
    return () => unsub();
  }, []);

  const createProject = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) return alert("ログインしてください");
    if (!title.trim()) return alert("タイトルを入力してください");
    
    setIsSubmitting(true);
    try {
      if (isDemoMode()) {
        await demoApi.createProject({
          title: title.trim(),
          description: description.trim() || null,
          status,
        });
        router.push("/projects");
        return;
      }
      const col = collection(db, "users", user.uid, "projects");
      const ref = await addDoc(col, {
        title: title.trim(),
        description: description.trim() || null,
        status,
        ownerId: user.uid,
        admins: [user.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add creator to members subcollection as admin
      try {
        await setDoc(doc(db, "users", user.uid, "projects", ref.id, "members", user.uid), {
          uid: user.uid,
          email: user.email ?? null,
          displayName: user.displayName ?? null,
          role: "admin",
          addedAt: serverTimestamp(),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("failed to add creator to members subcollection:", err);
      }
      
      // Redirect to projects list
      router.push("/projects");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      alert("プロジェクトの作成に失敗しました");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-black">
      <Sidebar
        menuItems={[
          { label: "ホーム", href: "/"},
          { label: "プロジェクト一覧", href: "/projects"},
        ]}
      />
      <main className="flex-1 p-8 text-black dark:text-white">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-semibold mb-6">新規プロジェクト作成</h1>

          <section className="p-6 bg-white dark:bg-neutral-900 rounded shadow">
            <form onSubmit={createProject} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-1">
                  タイトル *
                </label>
                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="プロジェクト名を入力"
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-800 text-black dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-1">
                  説明（任意）
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="プロジェクトの説明を入力"
                  rows={4}
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-neutral-800 text-black dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium mb-1">
                  ステータス
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3 py-2 border rounded bg-white dark:bg-neutral-800 text-black dark:text-white"
                >
                  <option>進行中</option>
                  <option>完了</option>
                  <option>保留</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
                >
                  {isSubmitting ? "作成中..." : "作成"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/projects")}
                  className="px-6 py-2 bg-gray-200 dark:bg-neutral-700 text-black dark:text-white rounded hover:bg-gray-300 dark:hover:bg-neutral-600"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
