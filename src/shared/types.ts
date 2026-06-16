export type AccessType = "public" | "customers" | "restricted" | "unknown";
export type WheelchairStatus = "yes" | "no" | "limited" | "unknown";
export type OpenStatus = "open" | "closed" | "unknown";

export interface SourceRef {
  source: string;
  sourceId: string;
  url?: string;
  license?: string;
  importedAt: string;
  raw?: Record<string, unknown>;
}

export interface RestroomRecord {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  accessType: AccessType;
  operator: string | null;
  address: string | null;
  context: string | null;
  hoursText: string | null;
  openingHoursOsm: string | null;
  wheelchair: WheelchairStatus;
  fee: boolean;
  keyRequired: boolean;
  purchaseRequired: boolean;
  genderNeutral: boolean | null;
  lastVerified: string | null;
  confidence: number;
  notes: string | null;
  sourceRefs: SourceRef[];
}

export interface RestroomWithStatus extends RestroomRecord {
  openStatus: OpenStatus;
  distanceMeters: number | null;
}

export interface RestroomQuery {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  bbox?: [number, number, number, number];
  openNow?: boolean;
  accessible?: boolean;
  free?: boolean;
  limit?: number;
}

export interface SourceAdapterResult {
  sourceName: string;
  records: RestroomRecord[];
  warnings: string[];
}

export interface AppStats {
  total: number;
  openKnown: number;
  accessibilityKnown: number;
  sourceCounts: Array<{ source: string; count: number }>;
  lowConfidence: number;
}
