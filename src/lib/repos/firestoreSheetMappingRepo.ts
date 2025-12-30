import type { Firestore } from "firebase/firestore";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, writeBatch } from "firebase/firestore";
import type { SheetMappingRepo, SheetMappingRepoKey } from "@shared/repos";
import type { SheetMapping } from "@shared/types/mapping";
import type { Timestamp } from "firebase/firestore";

function sheetDocRef(db: Firestore, key: SheetMappingRepoKey) {
  if (key.projectId && key.folderId) {
    return doc(
      db,
      "users",
      key.userId,
      "projects",
      key.projectId,
      "folders",
      key.folderId,
      "sheets",
      key.sheetId
    );
  }

  return doc(db, "users", key.userId, "sheets", key.sheetId);
}

function mappingDocRef(db: Firestore, key: SheetMappingRepoKey, mappingId: string) {
  return doc(sheetDocRef(db, key), "mappings", mappingId);
}

export function createFirestoreSheetMappingRepo(db: Firestore): SheetMappingRepo<Timestamp> {
  return {
    get: async ({ key, mappingId }) => {
      const ref = mappingDocRef(db, key, mappingId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return { id: snap.id, ...(snap.data() as Omit<SheetMapping<Timestamp>, "id">) };
    },

    save: async ({ key, mappingId, mapping }) => {
      const ref = mappingDocRef(db, key, mappingId);
      await setDoc(ref, mapping as unknown as SheetMapping<Timestamp>);
    },

    deleteAll: async ({ key }) => {
      // Firestore は親doc削除でもサブコレクションが残るため明示的に削除する
      // 500件ずつバッチ削除（Web SDK の上限に合わせる）
      const parent = sheetDocRef(db, key);
      while (true) {
        const colRef = collection(parent, "mappings");
        const snap = await getDocs(query(colRef, limit(500)));
        if (snap.empty) return;

        const batch = writeBatch(db);
        for (const d of snap.docs) batch.delete(d.ref);
        await batch.commit();
      }
    },
  };
}
