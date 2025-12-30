import type { Firestore } from "firebase/firestore";
import { collection, doc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import type { SyncLogRepo, SyncLogRepoKey } from "@shared/repos";
import type { SyncLog } from "@shared/types/syncLog";
import type { Timestamp } from "firebase/firestore";

function syncLogsCollection(db: Firestore, key: SyncLogRepoKey) {
  return collection(
    db,
    "users",
    key.userId,
    "projects",
    key.projectId,
    "folders",
    key.folderId,
    "sheets",
    key.sheetId,
    "syncLogs"
  );
}

export function createFirestoreSyncLogRepo(db: Firestore): SyncLogRepo<Timestamp> {
  return {
    upsert: async ({ key, log }) => {
      const col = syncLogsCollection(db, key);
      const ref = log.id ? doc(col, log.id) : doc(col);
      await setDoc(ref, { ...log, id: ref.id } as unknown as SyncLog<Timestamp>);
    },

    list: async ({ key, limitCount = 5 }) => {
      const col = syncLogsCollection(db, key);
      const q = query(col, orderBy("startedAt", "desc"), limit(limitCount));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SyncLog<Timestamp>, "id">),
      }));
    },
  };
}
