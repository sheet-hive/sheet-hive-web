"use client";

import { Timestamp } from "firebase/firestore";

import type { Project } from "@/models/project";
import type { Folder } from "@/models/folder";
import type { Sheet } from "@/models/sheet";
import type { Member } from "@/models/member";
import type { SheetData, SheetMetadata } from "@/lib/sheets";

import { DEMO_USER } from "@/lib/authState";
import { getDemoState, setDemoState } from "@/demo/demoStore";
import { DEMO_PROJECT_ID, DEMO_FOLDER_ID, DEMO_SHEET_ID, DEMO_SHEET_NAME } from "@/demo/demoData";

function folderKey(projectId: string, folderId: string): string {
  return `${projectId}/${folderId}`;
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const demoApi = {
  // --- user/profile ---
  getCurrentUserProfile: async () => {
    return {
      uid: DEMO_USER.uid,
      displayName: DEMO_USER.displayName,
      email: DEMO_USER.email,
    };
  },

  // --- projects ---
  listProjects: async (): Promise<Project[]> => {
    return getDemoState().projects;
  },

  getProject: async (projectId: string): Promise<Project | null> => {
    return getDemoState().projects.find((p) => p.id === projectId) ?? null;
  },

  createProject: async (input: { title: string; description?: string | null; status?: string | null }): Promise<Project> => {
    const now = Timestamp.now();
    const id = makeId("proj");
    const project: Project = {
      id,
      title: input.title,
      description: input.description ?? undefined,
      status: input.status ?? undefined,
      ownerId: DEMO_USER.uid,
      admins: [DEMO_USER.uid],
      createdAt: now,
      updatedAt: now,
    };

    setDemoState((prev) => ({
      ...prev,
      projects: [project, ...prev.projects],
      foldersByProjectId: { ...prev.foldersByProjectId, [id]: [] },
      membersByProjectId: {
        ...prev.membersByProjectId,
        [id]: [
          {
            id: DEMO_USER.uid,
            uid: DEMO_USER.uid,
            displayName: DEMO_USER.displayName,
            email: DEMO_USER.email,
            role: "admin",
            addedAt: now,
          } satisfies Member,
        ],
      },
    }));

    return project;
  },

  updateProject: async (projectId: string, patch: Partial<Project>): Promise<void> => {
    setDemoState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === projectId ? ({ ...p, ...patch, updatedAt: Timestamp.now() } as Project) : p)),
    }));
  },

  deleteProject: async (projectId: string): Promise<void> => {
    setDemoState((prev) => {
      const nextProjects = prev.projects.filter((p) => p.id !== projectId);
      const foldersByProjectId = { ...prev.foldersByProjectId };
      delete foldersByProjectId[projectId];
      const membersByProjectId = { ...prev.membersByProjectId };
      delete membersByProjectId[projectId];

      const nextSheetsByFolderKey: typeof prev.sheetsByFolderKey = { ...prev.sheetsByFolderKey };
      for (const key of Object.keys(nextSheetsByFolderKey)) {
        if (key.startsWith(`${projectId}/`)) delete nextSheetsByFolderKey[key];
      }

      return {
        ...prev,
        projects: nextProjects,
        foldersByProjectId,
        sheetsByFolderKey: nextSheetsByFolderKey,
        membersByProjectId,
      };
    });
  },

  // --- folders ---
  listFolders: async (projectId: string): Promise<Folder[]> => {
    const state = getDemoState();
    const existing = state.foldersByProjectId?.[projectId] ?? [];
    if (existing.length > 0) return existing;

    // fallback: sheetsByFolderKey からフォルダを推定（foldersByProjectId が欠けているケースの救済）
    const prefix = `${projectId}/`;
    const inferredFolderIds = Array.from(
      new Set(
        Object.keys(state.sheetsByFolderKey ?? {})
          .filter((k) => k.startsWith(prefix))
          .map((k) => k.slice(prefix.length).split("/")[0])
          .filter((id) => id && id.trim() !== "")
      )
    );

    if (inferredFolderIds.length === 0) return [];

    const inferred: Folder[] = inferredFolderIds.map((id) => ({
      id,
      name: id,
      parentId: null,
      createdAt: Timestamp.now(),
    }));

    // 以後の画面でも整合するよう、best-effort で状態に書き戻す
    setDemoState((prev) => ({
      ...prev,
      foldersByProjectId: {
        ...prev.foldersByProjectId,
        [projectId]: [...(prev.foldersByProjectId?.[projectId] ?? []), ...inferred],
      },
    }));

    return inferred;
  },

  getFolder: async (projectId: string, folderId: string): Promise<Folder | null> => {
    return (getDemoState().foldersByProjectId[projectId] ?? []).find((f) => f.id === folderId) ?? null;
  },

  createFolder: async (projectId: string, input: { name: string; parentId?: string | null }): Promise<Folder> => {
    const now = Timestamp.now();
    const id = makeId("folder");
    const folder: Folder = { id, name: input.name, parentId: input.parentId ?? null, createdAt: now };

    setDemoState((prev) => ({
      ...prev,
      foldersByProjectId: {
        ...prev.foldersByProjectId,
        [projectId]: [...(prev.foldersByProjectId[projectId] ?? []), folder],
      },
      sheetsByFolderKey: {
        ...prev.sheetsByFolderKey,
        [folderKey(projectId, id)]: [],
      },
    }));

    return folder;
  },

  updateFolder: async (projectId: string, folderId: string, patch: Partial<Folder>): Promise<void> => {
    setDemoState((prev) => ({
      ...prev,
      foldersByProjectId: {
        ...prev.foldersByProjectId,
        [projectId]: (prev.foldersByProjectId[projectId] ?? []).map((f) => (f.id === folderId ? ({ ...f, ...patch } as Folder) : f)),
      },
    }));
  },

  deleteFolder: async (projectId: string, folderId: string): Promise<void> => {
    setDemoState((prev) => {
      const nextFolders = (prev.foldersByProjectId[projectId] ?? []).filter((f) => f.id !== folderId);
      const nextFoldersByProjectId = { ...prev.foldersByProjectId, [projectId]: nextFolders };

      const key = folderKey(projectId, folderId);
      const sheetsByFolderKey = { ...prev.sheetsByFolderKey };
      delete sheetsByFolderKey[key];

      return { ...prev, foldersByProjectId: nextFoldersByProjectId, sheetsByFolderKey };
    });
  },

  // --- members ---
  listMembers: async (projectId: string): Promise<Member[]> => {
    return getDemoState().membersByProjectId[projectId] ?? [];
  },

  // --- sheets ---
  listSheets: async (projectId: string, folderId: string): Promise<Sheet[]> => {
    return getDemoState().sheetsByFolderKey[folderKey(projectId, folderId)] ?? [];
  },

  upsertSheet: async (projectId: string, folderId: string, sheet: Sheet): Promise<void> => {
    const key = folderKey(projectId, folderId);
    setDemoState((prev) => {
      const list = prev.sheetsByFolderKey[key] ?? [];
      const next = list.some((s) => s.id === sheet.id) ? list.map((s) => (s.id === sheet.id ? sheet : s)) : [sheet, ...list];
      return {
        ...prev,
        sheetsByFolderKey: { ...prev.sheetsByFolderKey, [key]: next },
      };
    });
  },

  deleteSheet: async (projectId: string, folderId: string, sheetId: string): Promise<void> => {
    const key = folderKey(projectId, folderId);
    setDemoState((prev) => ({
      ...prev,
      sheetsByFolderKey: {
        ...prev.sheetsByFolderKey,
        [key]: (prev.sheetsByFolderKey[key] ?? []).filter((s) => s.id !== sheetId),
      },
    }));
  },

  // --- demo sheets data ---
  getOrCreateDemoSheetEntry: async (sheetId: string): Promise<{ metadata: SheetMetadata; data: SheetData }> => {
    const state = getDemoState();
    const existing = state.demoSheetsById[sheetId];
    if (existing) return { metadata: existing.metadata, data: existing.data };

    // unknown sheetId: clone sample data
    const sample = state.demoSheetsById[DEMO_SHEET_ID];
    const metadata: SheetMetadata = {
      title: `サンプル（${sheetId}）`,
      sheets: [{ sheetId: 0, title: DEMO_SHEET_NAME }],
      sheetCount: 1,
    };
    const data: SheetData = { ...sample.data, range: DEMO_SHEET_NAME };

    setDemoState((prev) => ({
      ...prev,
      demoSheetsById: {
        ...prev.demoSheetsById,
        [sheetId]: { sheetId, metadata, data },
      },
    }));

    return { metadata, data };
  },
};

// convenience: expose the seeded ids (useful for docs/debug)
export const demoIds = {
  projectId: DEMO_PROJECT_ID,
  folderId: DEMO_FOLDER_ID,
  sheetId: DEMO_SHEET_ID,
};
