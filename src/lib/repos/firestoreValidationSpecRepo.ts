import type { Firestore } from "firebase/firestore";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, Timestamp, writeBatch } from "firebase/firestore";

import type { ValidationSpecRepo, ValidationSpecRepoKey } from "@shared/repos";
import {
  buildValidationSpecDocData,
  parseValidationSpecFromDocData,
  sanitizeValidationSpecDocDataForFirestore,
} from "@shared/mapping";

function sheetDocRef(db: Firestore, key: ValidationSpecRepoKey) {
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

function specDocRef(db: Firestore, key: ValidationSpecRepoKey, specId: string) {
  return doc(sheetDocRef(db, key), "validationSpecs", specId || "default");
}

export function createFirestoreValidationSpecRepo(db: Firestore): ValidationSpecRepo {
  return {
    get: async ({ key, specId }) => {
      const ref = specDocRef(db, key, specId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return parseValidationSpecFromDocData(snap.data() as unknown);
    },

    save: async ({ key, specId, spec }) => {
      const ref = specDocRef(db, key, specId);
      const data = buildValidationSpecDocData({ spec, updatedAt: Timestamp.now() });
      await setDoc(ref, sanitizeValidationSpecDocDataForFirestore(data), { merge: true });
    },

    deleteAll: async ({ key }) => {
      // Firestore は親doc削除でもサブコレクションが残るため明示的に削除する
      // 500件ずつバッチ削除（Web SDK の上限に合わせる）
      const parent = sheetDocRef(db, key);
      while (true) {
        const colRef = collection(parent, "validationSpecs");
        const snap = await getDocs(query(colRef, limit(500)));
        if (snap.empty) return;

        const batch = writeBatch(db);
        for (const d of snap.docs) batch.delete(d.ref);
        await batch.commit();
      }
    },
  };
}
