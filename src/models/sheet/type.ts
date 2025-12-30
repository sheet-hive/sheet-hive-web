import { Timestamp } from "firebase/firestore";

import type { Sheet as CoreSheet } from "@shared/types/sheet";

export type Sheet = CoreSheet<Timestamp>;
