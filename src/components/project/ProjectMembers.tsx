"use client";
import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  addDoc,
} from "firebase/firestore";
import { Member } from "@/models/member";
import { Project } from "@/models/project";
import Loading from "@/components/layout/Loading";
import { isDemoMode } from "@/lib/appMode";
import { subscribeAuthUser, type AppUser } from "@/lib/authState";
import { demoApi } from "@/demo/demoApi";
import { subscribeDemoState } from "@/demo/demoStore";

export default function ProjectMembers({ projectId }: { projectId: string }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const loading = loadingProject || loadingMembers;

  const [inviteInput, setInviteInput] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  useEffect(() => {
    const unsub = subscribeAuthUser((u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !user.uid || !projectId || typeof projectId !== "string") return;

    if (isDemoMode()) {
      const load = async () => {
        const p = await demoApi.getProject(projectId);
        const list = await demoApi.listMembers(projectId);
        setProject(p);
        setMembers(list);
        setLoadingProject(false);
        setLoadingMembers(false);
      };
      void load();
      const unsub = subscribeDemoState(() => void load());
      return () => unsub();
    }

    let unsubProj: (() => void) | null = null;
    let unsubMembers: (() => void) | null = null;

    const projRef = doc(db, "users", user.uid, "projects", projectId);
    unsubProj = onSnapshot(projRef, (snap) => {
      console.log("DEBUG proj snapshot:", {
        path: projRef.path ?? "unknown",
        exists: snap.exists(),
        data: snap.exists() ? snap.data() : null,
      });
      setProject(snap.exists() ? (snap.data() as Project) : null);
      setLoadingProject(false);
    });

    const membersCol = collection(db, "users", user.uid, "projects", projectId, "members");
    const q = query(membersCol, orderBy("displayName"));
    unsubMembers = onSnapshot(q, (snap) => {
      console.log("DEBUG members snapshot: size=", snap.size);
      const arr: Member[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<Member, 'id'>;
        arr.push({ id: d.id, ...data });
      });
      setMembers(arr);
      setLoadingMembers(false);
    });

    return () => {
      if (unsubMembers) unsubMembers();
      if (unsubProj) unsubProj();
    };
  }, [user, projectId]);

  // Debug: log and expose IDs for troubleshooting
  useEffect(() => {
    console.log("DEBUG ProjectMembers - user.uid:", user?.uid, "project.ownerId:", project?.ownerId);
  }, [user, project]);

  const canManage = () => {
    if (!user || !project || loading) return false;
    if (project.ownerId === user.uid) return true;
    if (Array.isArray(project.admins) && project.admins.includes(user.uid)) return true;
    return false;
  };

  const invite = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) return alert("ログインしてください");
    if (!canManage()) return alert("権限がありません");
    if (isDemoMode()) return alert("Demo Modeでは招待は無効です");
    const value = inviteInput.trim();
    if (!value) return;
    try {
      const membersCol = collection(db, "users", user.uid, "projects", projectId, "members");
      // If looks like email, store with auto id; if looks like uid (no @) use as id
      if (value.includes("@")) {
        await addDoc(membersCol, {
          uid: null,
          email: value,
          displayName: null,
          role: inviteRole,
          invitedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, "users", user.uid, "projects", projectId, "members", value), {
          uid: value,
          email: null,
          displayName: null,
          role: inviteRole,
          invitedAt: serverTimestamp(),
        });
      }
      setInviteInput("");
    } catch (err) {
      console.error(err);
      alert("招待に失敗しました");
    }
  };

  const changeRole = async (m: Member, newRole: string) => {
    if (!user || !m.id) return;
    if (!canManage()) return alert("権限がありません");
    if (isDemoMode()) return alert("Demo Modeではロール変更は無効です");
    try {
      await setDoc(doc(db, "users", user.uid, "projects", projectId, "members", m.id), { role: newRole }, { merge: true });
    } catch (err) {
      console.error(err);
      alert("ロール変更に失敗しました");
    }
  };

  const removeMember = async (m: Member) => {
    if (!user || !m.id) return;
    if (!canManage()) return alert("権限がありません");
    if (isDemoMode()) return alert("Demo Modeでは削除は無効です");
    if (!confirm("メンバーを削除しますか？")) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "projects", projectId, "members", m.id));
    } catch (err) {
      console.error(err);
      alert("削除に失敗しました");
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-neutral-900 rounded shadow">
      <h3 className="text-lg font-medium mb-3">メンバー管理</h3>
      <div className="mb-4">
        {!loading && !canManage() && (
          <div className="text-sm text-yellow-400 mb-2">あなたはメンバー管理の権限を持っていません（閲覧のみ）</div>
        )}
        <form onSubmit={invite} className="flex flex-col sm:flex-row gap-2">
          <input value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} placeholder="メールアドレスまたはUIDを入力" className="flex-1 px-3 py-2 border rounded bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white" />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="px-2 py-2 border rounded bg-neutral-50 dark:bg-neutral-800 text-black dark:text-white">
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <button disabled={!canManage() || isDemoMode()} className="px-3 py-2 bg-black text-white rounded">招待</button>
        </form>
      </div>

      <div>
        {loading ? (
          <Loading message="メンバー情報を読み込み中..." />
        ) : members.length === 0 ? (
          <div className="text-sm text-neutral-500">メンバーがいません</div>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between p-2 bg-neutral-50 dark:bg-neutral-800 rounded">
                <div>
                  <div className="font-medium">{m.displayName ?? m.email ?? m.uid}</div>
                  <div className="text-sm text-neutral-400">{m.email ?? m.uid}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={m.role ?? "member"} onChange={(e) => changeRole(m, e.target.value)} className="px-2 py-1 border rounded bg-white dark:bg-neutral-700 text-black dark:text-white">
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                  <button onClick={() => removeMember(m)} disabled={!canManage()} className="text-sm text-red-500">削除</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
