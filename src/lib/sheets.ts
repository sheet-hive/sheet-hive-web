import { isDemoMode } from "@/lib/appMode";
import { demoApi } from "@/demo/demoApi";
import { auth } from "./firebase";
import { createSheetsApiClient, isTokenExpiredError, type FetchLike, type SheetData, type SheetMetadata } from "@shared/sheets";

export type { SheetData, SheetMetadata };
export { isTokenExpiredError };

const fetchLike: FetchLike = async (input, init) => {
  const res = await fetch(input, init as unknown as RequestInit);
  return {
    ok: res.ok,
    status: res.status,
    json: () => res.json() as Promise<unknown>,
  };
};

const client = createSheetsApiClient({
  fetch: fetchLike,
  getIdToken: async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    return user.getIdToken();
  },
});

export const fetchSheetMetadata = async (spreadsheetId: string): Promise<SheetMetadata> => {
  if (isDemoMode()) {
    const { metadata } = await demoApi.getOrCreateDemoSheetEntry(spreadsheetId);
    return metadata;
  }
  return client.fetchSheetMetadata(spreadsheetId);
};

export const fetchSheetData = async (spreadsheetId: string, range: string = "Sheet1"): Promise<SheetData> => {
  if (isDemoMode()) {
    const { data } = await demoApi.getOrCreateDemoSheetEntry(spreadsheetId);
    return { ...data, range };
  }
  return client.fetchSheetData(spreadsheetId, range);
};

export const fetchSheetDataBatch = async (spreadsheetId: string, ranges: string[]) => {
  if (isDemoMode()) {
    const valueRanges = await Promise.all(
      ranges.map(async (r) => {
        const d = await fetchSheetData(spreadsheetId, r);
        return { range: d.range, majorDimension: d.majorDimension, values: d.values };
      })
    );
    return { spreadsheetId, valueRanges };
  }
  return client.fetchSheetDataBatch(spreadsheetId, ranges);
};
