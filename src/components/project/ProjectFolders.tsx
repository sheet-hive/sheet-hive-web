"use client";
import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import Link from "next/link";
import { Folder } from "@/models/folder";
import { isDemoMode } from "@/lib/appMode";
import { subscribeAuthUser, type AppUser } from "@/lib/authState";
import { demoApi } from "@/demo/demoApi";
import { subscribeDemoState } from "@/demo/demoStore";

type FolderNode = Folder & { children: FolderNode[] };

export default function ProjectFolders({ projectId }: { projectId: string }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAuthUser((u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !user.uid) return;

    if (isDemoMode()) {
      const load = async () => {
        const list = await demoApi.listFolders(projectId);
        setFolders(list);
        setLoading(false);
      };
      void load();
      const unsub = subscribeDemoState(() => void load());
      return () => unsub();
    }

    const col = collection(db, "users", user.uid, "projects", projectId, "folders");
    const q = query(col, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Folder[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<Folder, 'id'>;
        arr.push({ id: d.id, ...data });
      });
      setFolders(arr);
      setLoading(false);
    });
    return () => unsub();
  }, [user, projectId]);

  const createFolder = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) return alert("ログインしてください");
    if (!name.trim()) return alert("フォルダ名を入力してください");
    try {
      if (isDemoMode()) {
        await demoApi.createFolder(projectId, { name: name.trim(), parentId: parentId || null });
        setName("");
        setParentId(null);
        return;
      }
      const col = collection(db, "users", user.uid, "projects", projectId, "folders");
      await addDoc(col, { name: name.trim(), parentId: parentId || null, createdAt: serverTimestamp() });
      setName("");
      setParentId(null);
    } catch (err) {
      console.error(err);
      alert("フォルダ作成に失敗しました");
    }
  };

  const startEditing = (folder: FolderNode) => {
    setEditingId(folder.id!);
    setEditingName(folder.name);
    setMenuOpenId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveFolder = async (folderId: string) => {
    if (!user || !editingName.trim()) return;
    try {
      if (isDemoMode()) {
        await demoApi.updateFolder(projectId, folderId, { name: editingName.trim() });
        setEditingId(null);
        setEditingName("");
        return;
      }
      const folderRef = doc(db, "users", user.uid, "projects", projectId, "folders", folderId);
      await updateDoc(folderRef, { name: editingName.trim() });
      setEditingId(null);
      setEditingName("");
    } catch (err) {
      console.error(err);
      alert("フォルダ名の変更に失敗しました");
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!user) return;
    if (!confirm("このフォルダを削除しますか？")) return;
    try {
      if (isDemoMode()) {
        await demoApi.deleteFolder(projectId, folderId);
        setMenuOpenId(null);
        return;
      }
      const folderRef = doc(db, "users", user.uid, "projects", projectId, "folders", folderId);
      await deleteDoc(folderRef);
      setMenuOpenId(null);
    } catch (err) {
      console.error(err);
      alert("フォルダの削除に失敗しました");
    }
  };

  const buildTree = (items: Folder[]) => {
    const map = new Map<string, FolderNode>();
    items.forEach((it) => map.set(it.id!, { ...it, children: [] }));
    const roots: FolderNode[] = [];
    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const renderNode = (node: FolderNode, depth = 0) => (
    <li key={node.id} className="py-1">
      <div className="flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded px-2 py-1 relative">
        <span style={{ marginLeft: depth * 12 }} className="text-sm">
          •
        </span>
        {editingId === node.id ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border rounded bg-white dark:bg-neutral-700 text-black dark:text-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveFolder(node.id!);
                if (e.key === "Escape") cancelEditing();
              }}
            />
            <button onClick={() => saveFolder(node.id!)} className="text-xs text-green-600 hover:text-green-700">
              保存
            </button>
            <button onClick={cancelEditing} className="text-xs text-gray-600 hover:text-gray-700">
              キャンセル
            </button>
          </div>
        ) : (
          <>
            <Link href={`/projects/${projectId}/folders/${node.id}`} className="text-sm hover:underline ml-2 flex-1">
              {node.name}
            </Link>
            <button
              onClick={() => setMenuOpenId(menuOpenId === node.id ? null : node.id!)}
              className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 px-1"
              title="メニュー"
            >
              ⋮
            </button>
            {menuOpenId === node.id && (
              <div className="absolute right-0 top-8 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded shadow-lg z-10 min-w-[120px]">
                <button
                  onClick={() => startEditing(node)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 text-black dark:text-white"
                >
                  名前の変更
                </button>
                <button
                  onClick={() => deleteFolder(node.id!)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 text-red-600"
                >
                  削除
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {node.children.length > 0 && <ul className="ml-4">{node.children.map((c) => renderNode(c, depth + 1))}</ul>}
    </li>
  );

  const roots = buildTree(folders);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    if (menuOpenId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpenId]);

  return (
    <div className="mb-6 p-4 bg-white dark:bg-neutral-900 rounded shadow">
      <h2 className="font-medium mb-2">フォルダ</h2>
      <form onSubmit={createFolder} className="flex gap-2 mb-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="新しいフォルダ名" className="flex-1 px-3 py-2 border rounded bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white" />
        <select value={parentId ?? ""} onChange={(e) => setParentId(e.target.value || null)} className="px-2 py-2 border rounded bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white">
          <option value="">ルート</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <button className="px-3 py-2 bg-black text-white rounded">作成</button>
      </form>

      <div>
        {loading ? (
          <div></div>
        ) : folders.length === 0 ? (
          <div className="text-sm text-neutral-500">フォルダがありません</div>
        ) : (
          <ul className="space-y-1">{roots.map((r) => renderNode(r))}</ul>
        )}
      </div>
    </div>
  );
}
