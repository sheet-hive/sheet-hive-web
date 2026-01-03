"use client";

import { Timestamp } from "firebase/firestore";

import { buildInitialDemoState, type DemoState } from "@/demo/demoData";

const STORAGE_KEY = "sheethive_demo_state_v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Timestamp) {
    return { __type: "Timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  return value;
}

function jsonReviver(_key: string, value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    (value as { __type?: unknown }).__type === "Timestamp" &&
    typeof (value as { seconds?: unknown }).seconds === "number" &&
    typeof (value as { nanoseconds?: unknown }).nanoseconds === "number"
  ) {
    const v = value as { seconds: number; nanoseconds: number };
    return new Timestamp(v.seconds, v.nanoseconds);
  }
  return value;
}

function loadRaw(): DemoState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw, jsonReviver) as DemoState;
  } catch {
    return null;
  }
}

function saveRaw(state: DemoState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state, jsonReplacer));
}

export function ensureDemoState(): DemoState {
  const existing = loadRaw();
  if (!existing) {
    const next = buildInitialDemoState();
    saveRaw(next);
    return next;
  }

  // 既存ユーザーの localStorage を壊さずに、新しく追加した初期デモデータだけ差し込む
  const seeded = buildInitialDemoState();
  let changed = false;

  const next: DemoState = { ...existing };

  // 壊れた/古い localStorage からでも復旧できるよう、主要構造を正規化
  if (!Array.isArray(next.projects)) {
    next.projects = seeded.projects;
    changed = true;
  }
  if (!next.foldersByProjectId || typeof next.foldersByProjectId !== "object") {
    next.foldersByProjectId = seeded.foldersByProjectId;
    changed = true;
  }
  if (!next.sheetsByFolderKey || typeof next.sheetsByFolderKey !== "object") {
    next.sheetsByFolderKey = seeded.sheetsByFolderKey;
    changed = true;
  }
  if (!next.membersByProjectId || typeof next.membersByProjectId !== "object") {
    next.membersByProjectId = seeded.membersByProjectId;
    changed = true;
  }
  if (!next.demoSheetsById || typeof next.demoSheetsById !== "object") {
    next.demoSheetsById = seeded.demoSheetsById;
    changed = true;
  }
  if (!next.mappings || typeof next.mappings !== "object") {
    next.mappings = {};
    changed = true;
  }
  if (!next.validationSpecs || typeof next.validationSpecs !== "object") {
    next.validationSpecs = {};
    changed = true;
  }
  if (!next.validationSpecTemplates || typeof next.validationSpecTemplates !== "object") {
    next.validationSpecTemplates = {};
    changed = true;
  }
  if (!next.transformedData || typeof next.transformedData !== "object") {
    next.transformedData = {};
    changed = true;
  }
  if (!next.transformedMetaIndex || typeof next.transformedMetaIndex !== "object") {
    next.transformedMetaIndex = {};
    changed = true;
  }
  if (!next.syncLogs || typeof next.syncLogs !== "object") {
    next.syncLogs = {};
    changed = true;
  }

  // projects: seeded にあるが既存に無いものだけ補完
  for (const seededProject of seeded.projects) {
    if (!next.projects.some((p) => p.id === seededProject.id)) {
      next.projects = [...next.projects, seededProject];
      changed = true;
    }
  }

  // demoSheetsById: 無いものだけ補完
  for (const [sheetId, entry] of Object.entries(seeded.demoSheetsById)) {
    if (!next.demoSheetsById[sheetId]) {
      next.demoSheetsById = { ...next.demoSheetsById, [sheetId]: entry };
      changed = true;
    }
  }

  // demoSheetsById: 既存にあっても、旧シード由来のまま（未編集の可能性が高い）データは安全にマイグレーション
  // - ユーザーが編集している可能性を考慮し、「旧ヘッダが一致する場合のみ」置換する
  const oldTypesHeader = ["ID", "整数", "小数", "真偽", "日付", "時刻", "日時", "メール", "電話"];
  const typesSheetId = "demo-sheet-types";
  const currentTypes = next.demoSheetsById[typesSheetId];
  const seededTypes = seeded.demoSheetsById[typesSheetId];
  if (currentTypes && seededTypes) {
    const currentHeader = currentTypes.data?.values?.[0];
    const isOldHeader =
      Array.isArray(currentHeader) &&
      currentHeader.length === oldTypesHeader.length &&
      currentHeader.every((v, i) => v === oldTypesHeader[i]);

    if (isOldHeader) {
      next.demoSheetsById = { ...next.demoSheetsById, [typesSheetId]: seededTypes };
      changed = true;
    }
  }

  // foldersByProjectId: seeded にあるが既存に無いフォルダだけ補完
  for (const [projectId, seededFolders] of Object.entries(seeded.foldersByProjectId ?? {})) {
    const current = next.foldersByProjectId?.[projectId] ?? [];
    const existingIds = new Set(current.map((f) => f.id).filter((x): x is string => typeof x === "string"));
    const toAdd = seededFolders.filter((f) => f.id && !existingIds.has(f.id));
    if (toAdd.length > 0) {
      next.foldersByProjectId = {
        ...next.foldersByProjectId,
        [projectId]: [...current, ...toAdd],
      };
      changed = true;
    }
  }

  // sheetsByFolderKey: デモ初期フォルダに、無いシートだけ追加
  for (const [folderKey, seededSheets] of Object.entries(seeded.sheetsByFolderKey)) {
    const current = next.sheetsByFolderKey[folderKey] ?? [];
    const existingIds = new Set(current.map((s) => s.id).filter((x): x is string => typeof x === "string"));
    const toAdd = seededSheets.filter((s) => s.id && !existingIds.has(s.id));
    if (toAdd.length > 0) {
      next.sheetsByFolderKey = {
        ...next.sheetsByFolderKey,
        [folderKey]: [...current, ...toAdd],
      };
      changed = true;
    }
  }

  // sheetsByFolderKey: 旧タイトルのままのシートは、見た目だけ新しいタイトルへ更新
  // （デモ用途で、かつ固定IDなので、最小限の更新に留める）
  for (const [folderKey, sheets] of Object.entries(next.sheetsByFolderKey)) {
    const idx = sheets.findIndex((s) => s.id === "demo-sheet-types" && s.title === "型いろいろ（デモ）");
    if (idx === -1) continue;

    const seededSheets = seeded.sheetsByFolderKey[folderKey] ?? [];
    const seededTypesSheet = seededSheets.find((s) => s.id === "demo-sheet-types");
    if (!seededTypesSheet) continue;

    const updated = sheets.slice();
    updated[idx] = { ...updated[idx], title: seededTypesSheet.title, url: seededTypesSheet.url };
    next.sheetsByFolderKey = { ...next.sheetsByFolderKey, [folderKey]: updated };
    changed = true;
  }

  // foldersByProjectId: sheetsByFolderKey に存在するフォルダ参照を補完
  // - これが欠けていると、ダッシュボード（listFolders→listSheets）でシート数が0になる
  for (const key of Object.keys(next.sheetsByFolderKey ?? {})) {
    const [projectId, folderId] = key.split("/");
    if (!projectId || !folderId) continue;

    const currentFolders = next.foldersByProjectId?.[projectId] ?? [];
    const hasFolder = currentFolders.some((f) => f.id === folderId);
    if (hasFolder) continue;

    const seededFolder = (seeded.foldersByProjectId?.[projectId] ?? []).find((f) => f.id === folderId);
    const folderToAdd =
      seededFolder ??
      ({
        id: folderId,
        name: folderId,
        parentId: null,
        createdAt: Timestamp.now(),
      } as const);

    next.foldersByProjectId = {
      ...next.foldersByProjectId,
      [projectId]: [...currentFolders, folderToAdd],
    };
    changed = true;
  }

  if (changed) saveRaw(next);
  return next;
}

export function getDemoState(): DemoState {
  return ensureDemoState();
}

export function setDemoState(updater: (prev: DemoState) => DemoState): DemoState {
  const prev = ensureDemoState();
  const next = updater(prev);
  saveRaw(next);
  for (const l of listeners) l();
  return next;
}

export function subscribeDemoState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetDemoState(): void {
  const next = buildInitialDemoState();
  saveRaw(next);
  for (const l of listeners) l();
}
