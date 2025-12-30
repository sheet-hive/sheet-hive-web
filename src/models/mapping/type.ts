import { Timestamp } from "firebase/firestore";

export type { DataType, TypeInferenceResult, HeaderDetectionResult, FieldMapping } from "@shared/types/mapping";
import type { SheetMapping as CoreSheetMapping } from "@shared/types/mapping";

// Web (Firestore) 用の Timestamp を合成して互換維持
export type SheetMapping = CoreSheetMapping<Timestamp>;
