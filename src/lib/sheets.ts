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

export const fetchSheetMetadata = client.fetchSheetMetadata;
export const fetchSheetData = client.fetchSheetData;
export const fetchSheetDataBatch = client.fetchSheetDataBatch;
