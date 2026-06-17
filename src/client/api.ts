import type { AppStats, RestroomWithStatus } from "../shared/types";

export interface RestroomApiQuery {
  lat?: number;
  lng?: number;
  bbox?: [number, number, number, number];
  radiusMeters?: number;
  openNow?: boolean;
  accessible?: boolean;
  free?: boolean;
  limit?: number;
}

export async function fetchRestrooms(query: RestroomApiQuery): Promise<RestroomWithStatus[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === false) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const response = await fetch(`/api/restrooms?${params.toString()}`);
  if (!response.ok) throw new Error("Unable to load restroom data");
  return response.json() as Promise<RestroomWithStatus[]>;
}

export async function fetchStats(): Promise<AppStats> {
  const response = await fetch("/api/stats");
  if (!response.ok) throw new Error("Unable to load stats");
  return response.json() as Promise<AppStats>;
}

export async function fetchReviewQueue(): Promise<RestroomWithStatus[]> {
  const response = await fetch("/api/admin/import-review");
  if (!response.ok) throw new Error("Unable to load review queue");
  return response.json() as Promise<RestroomWithStatus[]>;
}
