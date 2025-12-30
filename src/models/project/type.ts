import { Timestamp } from "firebase/firestore";

import type { Project as CoreProject } from "@shared/types/project";

export type Project = CoreProject<Timestamp>;
