import { Timestamp } from "firebase/firestore";

import type { UserProfile as CoreUserProfile } from "@shared/types/user";

export type UserProfile = CoreUserProfile<Timestamp>;
