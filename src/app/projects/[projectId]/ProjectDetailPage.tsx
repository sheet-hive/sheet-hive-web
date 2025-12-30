"use client";
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ProjectFolders from "../../../components/project/ProjectFolders";
import ProjectDashboardContent from "../../../components/project/ProjectDashboardContent";
import ProjectMembers from "../../../components/project/ProjectMembers";
import Title from "@/components/layout/Title";
import Sidebar from "@/components/layout/Sidebar";
import Tabs, { TabPanel } from "@/components/layout/Tabs";
import { Project } from "@/models/project";
import Loading from "@/components/layout/Loading";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default function ProjectDetailPage({ params }: ProjectPageProps) {
  const [user, setUser] = useState<User | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    params.then((p) => {
      setProjectId(p.projectId);
    });
  }, [params]);

  useEffect(() => {
    if (!user || !projectId) return;
    const fetchProject = async () => {
      try {
        const docRef = doc(db, "users", user.uid, "projects", projectId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProject({ id: docSnap.id, ...docSnap.data() } as Project);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [user, projectId]);

  if (loading) {
    return <Loading fullScreen message="プロジェクトを読み込んでいます..." />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-black">
      <Sidebar
        menuItems={[
          { label: "ホーム", href: "/projects"},
          { label: "プロジェクト一覧", href: "/projects"},
          { label: "プロジェクト編集", href: `/projects/${projectId}/edit`},
        ]}
      />
      <main className="flex-1 p-8 text-black dark:text-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Title text={project?.title ?? ""} />
          </div>

          {/* タブUI */}
          <Tabs
            tabs={[
              { id: "dashboard", label: "ダッシュボード" },
              { id: "folders", label: "フォルダ" },
              { id: "members", label: "メンバー" },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* タブコンテンツ */}
          <TabPanel isActive={activeTab === "dashboard"}>
            {user && <ProjectDashboardContent projectId={projectId} userId={user.uid} />}
          </TabPanel>

          <TabPanel isActive={activeTab === "folders"}>
            <ProjectFolders projectId={projectId} />
          </TabPanel>

          <TabPanel isActive={activeTab === "members"}>
            <ProjectMembers projectId={projectId} />
          </TabPanel>
        </div>
      </main>
    </div>
  );
}
