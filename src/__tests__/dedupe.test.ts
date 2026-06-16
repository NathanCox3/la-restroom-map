import { describe, expect, it } from "vitest";
import { dedupeRestrooms } from "../etl/dedupe";
import type { RestroomRecord } from "../shared/types";

const base: RestroomRecord = {
  id: "one",
  name: "Beach restroom",
  latitude: 33.77,
  longitude: -118.19,
  accessType: "public",
  operator: null,
  address: null,
  context: null,
  hoursText: null,
  openingHoursOsm: null,
  wheelchair: "unknown",
  fee: false,
  keyRequired: false,
  purchaseRequired: false,
  genderNeutral: null,
  lastVerified: "2026-06-16",
  confidence: 0.7,
  notes: null,
  sourceRefs: [{ source: "OpenStreetMap", sourceId: "node/1", importedAt: "2026-06-16T00:00:00Z" }]
};

describe("dedupeRestrooms", () => {
  it("merges records that are very close together", () => {
    const records = dedupeRestrooms([
      base,
      {
        ...base,
        id: "two",
        latitude: 33.77003,
        longitude: -118.19003,
        sourceRefs: [{ source: "LA City Restroom", sourceId: "row/1", importedAt: "2026-06-16T00:00:00Z" }]
      }
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].sourceRefs).toHaveLength(2);
  });

  it("keeps distant restrooms separate", () => {
    const records = dedupeRestrooms([
      base,
      {
        ...base,
        id: "far",
        latitude: 33.8,
        longitude: -118.22
      }
    ]);
    expect(records).toHaveLength(2);
  });
});
