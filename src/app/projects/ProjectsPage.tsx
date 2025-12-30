"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { Project } from "@/models/project";
import Sidebar from "@/components/layout/Sidebar";
import Loading from "@/components/layout/Loading";

export default function ProjectsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const col = collection(db, "users", user.uid, "projects");
    const q = query(col, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Project[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<Project, 'id'>;
        arr.push({ id: d.id, ...data });
      });
      setProjects(arr);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  if (loading) {
    return <Loading fullScreen message="プロジェクトを読み込んでいます..." />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-black">
      <Sidebar
        menuItems={[
          { label: "ホーム", href: "/"},
          { label: "プロジェクトの追加", href: "/projects/new"},
        ]}
      />
      <main className="flex-1 p-8 text-black dark:text-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold">Projects</h1>
          </div>

          <section className="p-4 bg-white dark:bg-neutral-900 rounded shadow">
            <h2 className="font-medium mb-2">プロジェクト一覧</h2>
            {loading ? (
              <div></div>
            ) : projects.length === 0 ? (
              <div className="text-neutral-500">プロジェクトがありません</div>
            ) : (
              <ul className="space-y-3">
                {projects.map((p) => (
                  <li key={p.id} className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/projects/${p.id}`} className="text-lg font-semibold hover:underline">
                        {p.title}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-500">{p.status}</span>
                      </div>
                    </div>
                    <div className="text-sm text-neutral-400">{p.description}</div>
                    <div className="flex gap-2 mt-2">
                      <Link href={`/projects/${p.id}`} className="px-3 py-1 bg-white dark:bg-neutral-700 text-black dark:text-white rounded">詳細</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
