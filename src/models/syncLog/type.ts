import { Timestamp } from "firebase/firestore";

import type { SyncLog as CoreSyncLog, SyncStatus } from "@shared/types/syncLog";

export type { SyncStatus };
export type SyncLog = CoreSyncLog<Timestamp>;
