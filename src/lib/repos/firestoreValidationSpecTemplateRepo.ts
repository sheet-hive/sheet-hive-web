import type { Firestore } from "firebase/firestore";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";

import type { ValidationSpecTemplate, ValidationSpecTemplateRepo } from "@shared/repos";
import {
  buildValidationSpecDocData,
  parseValidationSpecFromDocData,
  sanitizeValidationSpecDocDataForFirestore,
} from "@shared/mapping";
import type { SheetMapping } from "@shared/types/mapping";

function templatesColRef(db: Firestore, userId: string) {
  return collection(db, "users", userId, "validationSpecTemplates");
}

function templateDocRef(db: Firestore, userId: string, templateId: string) {
  return doc(templatesColRef(db, userId), templateId);
}

export function createFirestoreValidationSpecTemplateRepo(db: Firestore): ValidationSpecTemplateRepo {
  return {
    list: async ({ userId, limit: limitCount }) => {
      const colRef = templatesColRef(db, userId);
      const snap = await getDocs(
        query(colRef, limit(limitCount ?? 200))
      );

      const out: ValidationSpecTemplate[] = [];
      for (const d of snap.docs) {
        const data = d.data() as unknown as {
          name?: unknown;
          schemaSignature?: unknown;
          headerKeys?: unknown;
          mapping?: unknown;
          [key: string]: unknown;
        };
        const spec = parseValidationSpecFromDocData(data);
        if (!spec) continue;

        const headerKeys = Array.isArray(data.headerKeys)
          ? data.headerKeys.filter((v) => typeof v === "string")
          : [];

        const mapping = (data.mapping ?? undefined) as SheetMapping<unknown> | undefined;

        out.push({
          templateId: d.id,
          name: typeof data.name === "string" ? data.name : d.id,
          schemaSignature: typeof data.schemaSignature === "string" ? data.schemaSignature : "",
          headerKeys,
          spec,
          mapping,
        });
      }
      return out;
    },

    save: async ({ userId, templateId, name, schemaSignature, headerKeys, spec, mapping }) => {
      const id = templateId && templateId.trim() !== "" ? templateId : doc(templatesColRef(db, userId)).id;
      const ref = templateDocRef(db, userId, id);

      const docData = buildValidationSpecDocData({ spec, updatedAt: Timestamp.now() });
      const sanitized = sanitizeValidationSpecDocDataForFirestore(docData) as unknown as Record<string, unknown>;
      await setDoc(
        ref,
        {
          ...sanitized,
          name,
          schemaSignature,
          headerKeys,
          ...(mapping ? { mapping } : {}),
        },
        { merge: true }
      );

      return { templateId: id };
    },

    get: async ({ userId, templateId }) => {
      const snap = await getDoc(templateDocRef(db, userId, templateId));
      if (!snap.exists()) return null;
      const data = snap.data() as unknown as { name?: unknown; schemaSignature?: unknown; headerKeys?: unknown; mapping?: unknown };
      const spec = parseValidationSpecFromDocData(data);
      if (!spec) return null;

      const headerKeys = Array.isArray(data.headerKeys) ? data.headerKeys.filter((v) => typeof v === "string") : [];
      const mapping = (data.mapping ?? undefined) as SheetMapping<unknown> | undefined;

      return {
        templateId: snap.id,
        name: typeof data.name === "string" ? data.name : snap.id,
        schemaSignature: typeof data.schemaSignature === "string" ? data.schemaSignature : "",
        headerKeys,
        spec,
        mapping,
      } satisfies ValidationSpecTemplate;
    },
  };
}
