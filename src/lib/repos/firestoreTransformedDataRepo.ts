import type { Firestore } from "firebase/firestore";
import { collection, doc, getDocs, limit, orderBy, query, setDoc, writeBatch } from "firebase/firestore";
import type { TransformedDataRepo, TransformedDataRepoKey } from "@shared/repos";
import type { TransformedDataMeta, TransformedDataRecord } from "@shared/types/transformedData";
import type { Timestamp } from "firebase/firestore";

function transformedDataMetaCollection(db: Firestore, key: TransformedDataRepoKey) {
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
    "transformedData"
  );
}

export function createFirestoreTransformedDataRepo(db: Firestore): TransformedDataRepo<Timestamp> {
  return {
    saveMetaAndRecords: async ({ key, meta, records }) => {
      const metaCol = transformedDataMetaCollection(db, key);
      const metaRef = doc(metaCol);
      await setDoc(metaRef, meta as unknown as TransformedDataMeta<Timestamp>);

      const recordsCol = collection(metaRef, "records");
      const batchSize = 500;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = records.slice(i, i + batchSize);
        for (const record of chunk) {
          const recordRef = doc(recordsCol);
          batch.set(recordRef, record as unknown as TransformedDataRecord<Timestamp>);
        }
        await batch.commit();
      }

      return { metaId: metaRef.id };
    },

    getLatestMeta: async ({ key }) => {
      const metaCol = transformedDataMetaCollection(db, key);
      const q = query(metaCol, orderBy("transformedAt", "desc"), limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const d = snapshot.docs[0];
      return { id: d.id, ...(d.data() as Omit<TransformedDataMeta<Timestamp>, "id">) };
    },

    getHistory: async ({ key, limitCount = 10 }) => {
      const metaCol = transformedDataMetaCollection(db, key);
      const q = query(metaCol, orderBy("transformedAt", "desc"), limit(limitCount));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<TransformedDataMeta<Timestamp>, "id">),
      }));
    },

    getRecords: async ({ key, metaId, limitCount = 100 }) => {
      const metaCol = transformedDataMetaCollection(db, key);
      const metaRef = doc(metaCol, metaId);
      const recordsCol = collection(metaRef, "records");
      const q = query(recordsCol, orderBy("rowIndex", "asc"), limit(limitCount));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<TransformedDataRecord<Timestamp>, "id">),
      }));
    },
  };
}
