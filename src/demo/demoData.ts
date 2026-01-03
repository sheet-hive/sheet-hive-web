import { Timestamp } from "firebase/firestore";

import type { Project } from "@/models/project";
import type { Folder } from "@/models/folder";
import type { Sheet } from "@/models/sheet";
import type { Member } from "@/models/member";
import type { SheetData, SheetMetadata } from "@/lib/sheets";

export const DEMO_PROJECT_ID = "demo-project";
export const DEMO_FOLDER_ID = "demo-folder";
export const DEMO_SHEET_ID = "demo-sheet";
export const DEMO_SHEET_ID_TYPES = "demo-sheet-types";
export const DEMO_SHEET_ID_CONTACTS = "demo-sheet-contacts";
export const DEMO_SHEET_NAME = "Sheet1";

export type DemoSheetEntry = {
  sheetId: string;
  metadata: SheetMetadata;
  data: SheetData;
};

export type DemoState = {
  projects: Project[];
  foldersByProjectId: Record<string, Folder[]>;
  sheetsByFolderKey: Record<string, Sheet[]>; // key = `${projectId}/${folderId}`
  membersByProjectId: Record<string, Member[]>;
  demoSheetsById: Record<string, DemoSheetEntry>;

  // repos
  mappings: Record<string, unknown>; // key = JSON.stringify({userId,projectId,folderId,sheetId,mappingId})
  validationSpecs: Record<string, unknown>; // key = JSON.stringify({userId,projectId,folderId,sheetId,specId})
  validationSpecTemplates: Record<string, unknown>; // key = templateId
  transformedData: Record<string, unknown>; // key = JSON.stringify({userId,projectId,folderId,sheetId,metaId})
  transformedMetaIndex: Record<string, string[]>; // key = JSON.stringify({userId,projectId,folderId,sheetId}) -> metaId[]
  syncLogs: Record<string, unknown[]>; // key = JSON.stringify({userId,projectId,folderId,sheetId}) -> logs[]
};

export function buildInitialDemoState(): DemoState {
  const now = Timestamp.now();

  const project: Project = {
    id: DEMO_PROJECT_ID,
    title: "サンプルプロジェクト",
    description: "仮データで、マッピング/バリデーション/変換の流れを体験できます。",
    status: "進行中",
    ownerId: "demo-user",
    admins: ["demo-user"],
    createdAt: now,
    updatedAt: now,
  };

  const folder: Folder = {
    id: DEMO_FOLDER_ID,
    name: "2025年 売上",
    parentId: null,
    createdAt: now,
  };

  const sheet: Sheet = {
    id: DEMO_SHEET_ID,
    sheetId: DEMO_SHEET_ID,
    url: "https://docs.google.com/spreadsheets/d/demo-sheet",
    title: "売上データ",
    sheetCount: 1,
    addedAt: now,
    lastFetched: now,
    isAccessible: true,
    lastError: null,
  };

  const sheetTypes: Sheet = {
    id: DEMO_SHEET_ID_TYPES,
    sheetId: DEMO_SHEET_ID_TYPES,
    url: `https://docs.google.com/spreadsheets/d/${DEMO_SHEET_ID_TYPES}`,
    title: "受注データ",
    sheetCount: 1,
    addedAt: now,
    lastFetched: now,
    isAccessible: true,
    lastError: null,
  };

  const sheetContacts: Sheet = {
    id: DEMO_SHEET_ID_CONTACTS,
    sheetId: DEMO_SHEET_ID_CONTACTS,
    url: `https://docs.google.com/spreadsheets/d/${DEMO_SHEET_ID_CONTACTS}`,
    title: "連絡先",
    sheetCount: 1,
    addedAt: now,
    lastFetched: now,
    isAccessible: true,
    lastError: null,
  };

  const members: Member[] = [
    {
      id: "demo-user",
      uid: "demo-user",
      displayName: "Demo User",
      email: "demo@example.com",
      role: "admin",
      addedAt: now,
    },
  ];

  const metadata: SheetMetadata = {
    title: "売上データ",
    sheets: [{ sheetId: 0, title: DEMO_SHEET_NAME }],
    sheetCount: 1,
  };

  const metadataTypes: SheetMetadata = {
    title: "受注データ",
    sheets: [{ sheetId: 0, title: DEMO_SHEET_NAME }],
    sheetCount: 1,
  };

  const metadataContacts: SheetMetadata = {
    title: "連絡先データ",
    sheets: [{ sheetId: 0, title: DEMO_SHEET_NAME }],
    sheetCount: 1,
  };

  const values: string[][] = [
    ["日付", "商品", "カテゴリ", "売上", "担当"],
    ["2025-01-05", "A-100", "食品", "1200", "田中"],
    ["2025-01-06", "B-200", "日用品", "800", "佐藤"],
    ["2025-01-07", "A-100", "食品", "1500", "田中"],
    ["2025-01-08", "C-300", "雑貨", "", "鈴木"],
    ["2025-01-09", "D-400", "食品", "2100", "佐藤"],
    ["2025-01-10", "B-200", "日用品", "700", "田中"],
  ];

  const data: SheetData = {
    range: DEMO_SHEET_NAME,
    majorDimension: "ROWS",
    values,
  };

  // 変換/バリデーション用に、いろんな型のデータを混在させる（不正値も少し混ぜる）
  const valuesTypes: string[][] = [
    [
      "レコードID",
      "注文数量",
      "割引率",
      "契約中フラグ",
      "受注日",
      "出荷時刻",
      "最終更新日時",
      "連絡先メール",
      "連絡先電話",
    ],
    ["1", "10", "3.14", "true", "2025-01-05", "09:10:11", "2025-01-05 09:10:11", "taro@example.com", "090-1234-5678"],
    ["2", "-5", "0.5", "false", "2025-02-28", "23:59:59", "2025-02-28T23:59:59", "hanako@example.com", "03-1234-5678"],
    // ここから不正/境界値
    ["3", "not-int", "1,234.56", "yes", "2025-02-30", "25:61:00", "invalid", "bad-mail", "abcd"],
    ["4", "", "", "", "", "", "", "", ""],
  ];

  const dataTypes: SheetData = {
    range: DEMO_SHEET_NAME,
    majorDimension: "ROWS",
    values: valuesTypes,
  };

  // 連絡先系（メール/電話/郵便番号など）
  const valuesContacts: string[][] = [
    ["氏名", "メール", "電話", "郵便番号", "都道府県", "住所", "年齢"],
    ["田中 太郎", "taro@example.com", "090-1234-5678", "100-0001", "東京都", "千代田区1-1-1", "30"],
    ["佐藤 花子", "hanako@example.com", "03-1234-5678", "150-0002", "東京都", "渋谷区2-2-2", "25"],
    // わざと不正値を混ぜる
    ["", "not-an-email", "phone", "9999999", "", "", "-1"],
  ];

  const dataContacts: SheetData = {
    range: DEMO_SHEET_NAME,
    majorDimension: "ROWS",
    values: valuesContacts,
  };

  const demoSheet: DemoSheetEntry = {
    sheetId: DEMO_SHEET_ID,
    metadata,
    data,
  };

  const demoSheetTypes: DemoSheetEntry = {
    sheetId: DEMO_SHEET_ID_TYPES,
    metadata: metadataTypes,
    data: dataTypes,
  };

  const demoSheetContacts: DemoSheetEntry = {
    sheetId: DEMO_SHEET_ID_CONTACTS,
    metadata: metadataContacts,
    data: dataContacts,
  };

  const folderKey = `${DEMO_PROJECT_ID}/${DEMO_FOLDER_ID}`;

  return {
    projects: [project],
    foldersByProjectId: {
      [DEMO_PROJECT_ID]: [folder],
    },
    sheetsByFolderKey: {
      [folderKey]: [sheet, sheetTypes, sheetContacts],
    },
    membersByProjectId: {
      [DEMO_PROJECT_ID]: members,
    },
    demoSheetsById: {
      [DEMO_SHEET_ID]: demoSheet,
      [DEMO_SHEET_ID_TYPES]: demoSheetTypes,
      [DEMO_SHEET_ID_CONTACTS]: demoSheetContacts,
    },

    mappings: {},
    validationSpecs: {},
    validationSpecTemplates: {},
    transformedData: {},
    transformedMetaIndex: {},
    syncLogs: {},
  };
}
