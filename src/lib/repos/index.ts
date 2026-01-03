import type { Firestore } from "firebase/firestore";

import { isDemoMode } from "@/lib/appMode";
import {
	createDemoSheetMappingRepo,
	createDemoSyncLogRepo,
	createDemoTransformedDataRepo,
	createDemoValidationSpecRepo,
	createDemoValidationSpecTemplateRepo,
} from "@/demo/demoRepos";

import { createFirestoreSheetMappingRepo } from "./firestoreSheetMappingRepo";
import { createFirestoreValidationSpecRepo } from "./firestoreValidationSpecRepo";
import { createFirestoreValidationSpecTemplateRepo } from "./firestoreValidationSpecTemplateRepo";
import { createFirestoreTransformedDataRepo } from "./firestoreTransformedDataRepo";
import { createFirestoreSyncLogRepo } from "./firestoreSyncLogRepo";

export * from "./firestoreTransformedDataRepo";
export * from "./firestoreSyncLogRepo";
export * from "./firestoreSheetMappingRepo";
export * from "./firestoreValidationSpecRepo";
export * from "./firestoreValidationSpecTemplateRepo";

export function createSheetMappingRepo(db: Firestore) {
	return isDemoMode() ? createDemoSheetMappingRepo() : createFirestoreSheetMappingRepo(db);
}

export function createValidationSpecRepo(db: Firestore) {
	return isDemoMode() ? createDemoValidationSpecRepo() : createFirestoreValidationSpecRepo(db);
}

export function createValidationSpecTemplateRepo(db: Firestore) {
	return isDemoMode() ? createDemoValidationSpecTemplateRepo() : createFirestoreValidationSpecTemplateRepo(db);
}

export function createTransformedDataRepo(db: Firestore) {
	return isDemoMode() ? createDemoTransformedDataRepo() : createFirestoreTransformedDataRepo(db);
}

export function createSyncLogRepo(db: Firestore) {
	return isDemoMode() ? createDemoSyncLogRepo() : createFirestoreSyncLogRepo(db);
}
