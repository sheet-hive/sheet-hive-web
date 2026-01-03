"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "../../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { Project } from "@/models/project";
import { isDemoMode } from "@/lib/appMode";
import { subscribeAuthUser, type AppUser } from "@/lib/authState";
import { demoApi } from "@/demo/demoApi";
import { subscribeDemoState } from "@/demo/demoStore";

export default function ProjectEditButton({ projectId }: { projectId: string }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    const unsub = subscribeAuthUser((u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !user.uid) return;

    if (isDemoMode()) {
      const load = async () => {
        const p = await demoApi.getProject(projectId);
        setProject(p);
      };
      void load();
      const unsub = subscribeDemoState(() => void load());
      return () => unsub();
    }

    const ref = doc(db, "users", user.uid, "projects", projectId);
    const unsub = onSnapshot(ref, (snap) => {
      setProject(snap.exists() ? (snap.data() as Project) : null);
    });
    return () => unsub();
  }, [user, projectId]);

  const canManage = () => {
    if (!user || !project) return false;
    if (project.ownerId === user.uid) return true;
    if (Array.isArray(project.admins) && project.admins.includes(user.uid)) return true;
    return false;
  };

  if (!canManage()) return null;

  return (
    <div className="mb-4">
      <Link href={`/projects/${projectId}/edit`} className="px-4 py-2 bg-black text-white rounded">プロジェクト情報を編集</Link>
    </div>
  );
}
