import { Timestamp } from "firebase/firestore";

import type { Folder as CoreFolder } from "@shared/types/folder";

export type Folder = CoreFolder<Timestamp>;
