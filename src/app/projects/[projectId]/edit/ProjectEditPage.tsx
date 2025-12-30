"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { Project } from "@/models/project";
import Title from "@/components/layout/Title";
import Loading from "@/components/layout/Loading";
import Sidebar from "@/components/layout/Sidebar";

export default function ProjectEditPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) router.push("/login");
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user || !user.uid) return;
    const ref = doc(db, "users", user.uid, "projects", projectId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const proj = snap.data() as Project;
        setProject(proj);
        setTitle(proj.title || "");
        setDescription(proj.description || "");
        setStatus(proj.status || "active");
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user, projectId]);

  const canManage = () => {
    if (!user || !project) return false;
    if (project.ownerId === user.uid) return true;
    if (Array.isArray(project.admins) && project.admins.includes(user.uid)) return true;
    return false;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canManage()) return;

    setSaving(true);
    try {
      const ref = doc(db, "users", user.uid, "projects", projectId);
      await updateDoc(ref, {
        title,
        description,
        status,
        updatedAt: Timestamp.now(),
      });
      router.push(`/projects/${projectId}`);
    } catch (err) {
      console.error("Failed to update project:", err);
      alert("プロジェクトの更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/projects/${projectId}`);
  };

  const handleDelete = async () => {
    if (!user || !canManage()) return;

    const confirmMessage = `プロジェクト「${project?.title}」を削除しますか？\n\nこの操作は取り消せません。プロジェクト内のすべてのフォルダ、シート、データが削除されます。`;
    
    if (!window.confirm(confirmMessage)) return;

    // 二重確認
    const confirmText = window.prompt(
      "削除を確定するには、プロジェクト名を正確に入力してください:\n" + project?.title
    );
    
    if (confirmText !== project?.title) {
      alert("プロジェクト名が一致しません。削除をキャンセルしました。");
      return;
    }

    setDeleting(true);
    try {
      const ref = doc(db, "users", user.uid, "projects", projectId);
      await deleteDoc(ref);
      alert("プロジェクトを削除しました");
      router.push("/projects");
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("プロジェクトの削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Loading />;
  if (!project || !canManage()) {
    return (
      <div className="p-8">
        <p className="text-red-600">このプロジェクトを編集する権限がありません</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-black">
      <Sidebar
        menuItems={[
          { label: "ホーム", href: "/" },
          { label: "プロジェクト一覧", href: "/projects" },
        ]}
      />
      <main className="flex-1 p-8 text-black dark:text-white">
        <div className="max-w-3xl mx-auto">
            <Title text="プロジェクト情報を編集" />
            <form onSubmit={handleSave} className="mt-6 space-y-6">
                <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    プロジェクト名 <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例: 売上管理プロジェクト"
                />
                </div>

                <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    説明
                </label>
                <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="プロジェクトの説明を入力してください"
                />
                </div>

                <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ステータス
                </label>
                <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="active">アクティブ</option>
                    <option value="archived">アーカイブ</option>
                    <option value="paused">一時停止</option>
                </select>
                </div>

                <div className="flex gap-4 pt-4">
                <button
                    type="submit"
                    disabled={saving || !title.trim() || deleting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? "保存中..." : "保存"}
                </button>
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving || deleting}
                    className="px-6 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                    キャンセル
                </button>
                </div>
            </form>

            {/* 削除セクション */}
            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-6">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                    プロジェクトを削除
                </h3>
                <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                    プロジェクトを削除すると、すべてのフォルダ、シート、データが完全に削除されます。この操作は取り消せません。
                </p>
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving || deleting}
                    className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                    {deleting ? "削除中..." : "プロジェクトを削除"}
                </button>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
