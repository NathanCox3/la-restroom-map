import { computeOpenStatus } from "../shared/hours";
import { haversineMeters } from "../shared/geo";
import type { AppStats, RestroomQuery, RestroomRecord, RestroomWithStatus } from "../shared/types";

export function applyRestroomQuery(records: RestroomRecord[], query: RestroomQuery, now = new Date()): RestroomWithStatus[] {
  const origin =
    Number.isFinite(query.lat) && Number.isFinite(query.lng)
      ? { latitude: query.lat as number, longitude: query.lng as number }
      : null;

  return records
    .map((record) => {
      const distanceMeters = origin
        ? haversineMeters(origin, { latitude: record.latitude, longitude: record.longitude })
        : null;
      const openStatus = computeOpenStatus(record.openingHoursOsm ?? record.hoursText, now);
      return { ...record, openStatus, distanceMeters };
    })
    .filter((record) => {
      if (query.bbox) {
        const [minLng, minLat, maxLng, maxLat] = query.bbox;
        if (
          record.longitude < minLng ||
          record.longitude > maxLng ||
          record.latitude < minLat ||
          record.latitude > maxLat
        ) {
          return false;
        }
      }
      if (query.radiusMeters && record.distanceMeters !== null && record.distanceMeters > query.radiusMeters) return false;
      if (query.openNow && record.openStatus !== "open") return false;
      if (query.accessible && !["yes", "limited"].includes(record.wheelchair)) return false;
      if (query.free && (record.fee || record.keyRequired || record.purchaseRequired)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.openStatus === "closed" && b.openStatus !== "closed") return 1;
      if (b.openStatus === "closed" && a.openStatus !== "closed") return -1;
      if (a.distanceMeters !== null && b.distanceMeters !== null) {
        const distanceDelta = a.distanceMeters - b.distanceMeters;
        if (Math.abs(distanceDelta) > 500) return distanceDelta;
      }
      if (a.openStatus !== b.openStatus) {
        if (a.openStatus === "open") return -1;
        if (b.openStatus === "open") return 1;
      }
      if (isCandidateHost(a) !== isCandidateHost(b)) return isCandidateHost(a) ? 1 : -1;
      if (a.distanceMeters !== null && b.distanceMeters !== null) return a.distanceMeters - b.distanceMeters;
      return b.confidence - a.confidence;
    })
    .slice(0, query.limit ?? 500)
    .map(stripRawSourcePayloads);
}

export function buildStats(records: RestroomRecord[]): AppStats {
  const sourceCounts = new Map<string, number>();
  for (const record of records) {
    for (const source of record.sourceRefs) {
      sourceCounts.set(source.source, (sourceCounts.get(source.source) ?? 0) + 1);
    }
  }
  return {
    total: records.length,
    openKnown: records.filter((record) => record.hoursText || record.openingHoursOsm).length,
    accessibilityKnown: records.filter((record) => record.wheelchair !== "unknown").length,
    sourceCounts: [...sourceCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    lowConfidence: records.filter((record) => record.confidence < 0.65).length
  };
}

function isCandidateHost(record: RestroomRecord): boolean {
  return record.sourceRefs.some((source) => source.source === "OpenStreetMap Candidate Host");
}

function stripRawSourcePayloads(record: RestroomWithStatus): RestroomWithStatus {
  return {
    ...record,
    sourceRefs: record.sourceRefs.map(({ raw: _raw, ...source }) => source)
  };
}
