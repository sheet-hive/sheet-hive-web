"use client";
import Title from "@/components/layout/Title";
import Sidebar from "@/components/layout/Sidebar";
import SheetConnect from "@/components/sheet/SheetConnect";
import SheetList from "@/components/sheet/SheetList";
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Folder } from "@/models/folder";
import { Project } from "@/models/project";
import { Sheet } from "@/models/sheet";
import Breadcrumb from "@/components/layout/Breadcrumb";
import Loading from "@/components/layout/Loading";

type FolderPageProps = {
  params: Promise<{ projectId: string; folderId: string }>;
};

export default function FolderDetailPage({ params }: FolderPageProps) {
  const [user, setUser] = useState<User | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetsLoading, setSheetsLoading] = useState(true);
  const [projectId, setProjectId] = useState("");
  const [folderId, setFolderId] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    params.then((p) => {
      setProjectId(p.projectId);
    setFolderId(p.folderId);
    });
  }, [params]);

  useEffect(() => {
    if (!user || !projectId || !folderId) return;
    const fetchData = async () => {
      try {
        // Fetch project
        const projectRef = doc(db, "users", user.uid, "projects", projectId);
        const projectSnap = await getDoc(projectRef);
        if (projectSnap.exists()) {
          setProject({ id: projectSnap.id, ...projectSnap.data() } as Project);
        }
        
        // Fetch folder
        const folderRef = doc(db, "users", user.uid, "projects", projectId, "folders", folderId);
        const folderSnap = await getDoc(folderRef);
        if (folderSnap.exists()) {
          setFolder({ id: folderSnap.id, ...folderSnap.data() } as Folder);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, projectId, folderId]);

  useEffect(() => {
    if (!user || !projectId || !folderId) return;
    const col = collection(db, "users", user.uid, "projects", projectId, "folders", folderId, "sheets");
    const q = query(col, orderBy("addedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Sheet[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<Sheet, 'id'>;
        arr.push({ id: d.id, ...data });
      });
      setSheets(arr);
      setSheetsLoading(false);
    });
    return () => unsub();
  }, [user, projectId, folderId]);

  if (loading) {
    return <Loading fullScreen message="フォルダを読み込んでいます..." />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-black">
      <Sidebar
        menuItems={[
          { label: "ホーム", href: "/projects"},
          { label: project?.title ?? "プロジェクト", href: `/projects/${projectId}`},
        ]}
      />
      <main className="flex-1 p-8 text-black dark:text-white">
        <div className="max-w-3xl mx-auto">
          <Breadcrumb
            items={[
              { label: project?.title || "...", href: `/projects/${projectId}` },
              { label: folder?.name || folderId },
            ]}
          />
          <Title text={folder?.name ?? ""} />
          <div className="mt-6 space-y-6">
            <SheetConnect projectId={projectId} folderId={folderId} />
            <SheetList 
              user={user}
              sheets={sheets}
              loading={sheetsLoading}
              projectId={projectId}
              folderId={folderId}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
