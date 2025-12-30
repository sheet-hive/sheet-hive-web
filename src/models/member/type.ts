import { Timestamp } from "firebase/firestore";

import type { Member as CoreMember } from "@shared/types/member";

export type Member = CoreMember<Timestamp>;
