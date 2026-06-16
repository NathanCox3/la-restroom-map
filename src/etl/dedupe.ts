import { haversineMeters } from "../shared/geo";
import type { RestroomRecord, SourceRef, WheelchairStatus } from "../shared/types";

const sourcePriority: Record<string, number> = {
  "LA City Restroom": 90,
  OpenStreetMap: 70,
  "MVP sample": 20
};

export function dedupeRestrooms(records: RestroomRecord[]): RestroomRecord[] {
  const sorted = [...records].sort((a, b) => scoreRecord(b) - scoreRecord(a));
  const clusters: RestroomRecord[][] = [];

  for (const record of sorted) {
    const cluster = clusters.find((candidate) => shouldMerge(candidate[0], record));
    if (cluster) cluster.push(record);
    else clusters.push([record]);
  }

  return clusters.map(mergeCluster).sort((a, b) => a.name.localeCompare(b.name));
}

function shouldMerge(a: RestroomRecord, b: RestroomRecord): boolean {
  const distance = haversineMeters(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude }
  );
  if (isCandidateHost(a) || isCandidateHost(b)) {
    return distance <= 8 && tokenSimilarity(a.name, b.name) >= 0.5;
  }
  if (distance <= 12) return true;
  if (distance > 40) return false;
  return tokenSimilarity(a.name, b.name) >= 0.35;
}

function mergeCluster(cluster: RestroomRecord[]): RestroomRecord {
  const base = [...cluster].sort((a, b) => scoreRecord(b) - scoreRecord(a))[0];
  const sourceRefs = uniqueSourceRefs(cluster.flatMap((record) => record.sourceRefs));
  const notes = uniqueText(cluster.map((record) => record.notes).filter(Boolean) as string[]);
  const knownWheelchair = pickWheelchair(cluster.map((record) => record.wheelchair));
  const confidence = Math.min(0.98, Math.max(...cluster.map((record) => record.confidence)) + (cluster.length - 1) * 0.03);

  return {
    ...base,
    sourceRefs,
    notes: notes || base.notes,
    confidence,
    wheelchair: knownWheelchair,
    fee: cluster.some((record) => record.fee),
    keyRequired: cluster.some((record) => record.keyRequired),
    purchaseRequired: cluster.some((record) => record.purchaseRequired),
    hoursText: base.hoursText ?? cluster.find((record) => record.hoursText)?.hoursText ?? null,
    openingHoursOsm: base.openingHoursOsm ?? cluster.find((record) => record.openingHoursOsm)?.openingHoursOsm ?? null,
    genderNeutral: base.genderNeutral ?? cluster.find((record) => record.genderNeutral !== null)?.genderNeutral ?? null
  };
}

function scoreRecord(record: RestroomRecord): number {
  const priority = Math.max(...record.sourceRefs.map((ref) => sourcePriority[ref.source] ?? 50));
  return priority + record.confidence;
}

function tokenSimilarity(a: string, b: string): number {
  const aTokens = new Set(tokens(a));
  const bTokens = new Set(tokens(b));
  if (!aTokens.size || !bTokens.size) return 0;
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !["the", "and", "restroom", "toilet", "public"].includes(token));
}

function uniqueSourceRefs(refs: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.source}:${ref.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueText(values: string[]): string | null {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return unique.length ? unique.join(" ") : null;
}

function pickWheelchair(values: WheelchairStatus[]): WheelchairStatus {
  if (values.includes("yes")) return "yes";
  if (values.includes("limited")) return "limited";
  if (values.includes("no")) return "no";
  return "unknown";
}

function isCandidateHost(record: RestroomRecord): boolean {
  return record.sourceRefs.some((source) => source.source === "OpenStreetMap Candidate Host");
}
