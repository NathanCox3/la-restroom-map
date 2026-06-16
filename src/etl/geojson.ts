import type { RestroomRecord } from "../shared/types";

export function toGeoJson(records: RestroomRecord[]) {
  return {
    type: "FeatureCollection",
    features: records.map((record) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [record.longitude, record.latitude]
      },
      properties: {
        id: record.id,
        name: record.name,
        accessType: record.accessType,
        operator: record.operator,
        hoursText: record.hoursText,
        openingHoursOsm: record.openingHoursOsm,
        wheelchair: record.wheelchair,
        fee: record.fee,
        keyRequired: record.keyRequired,
        purchaseRequired: record.purchaseRequired,
        confidence: record.confidence,
        lastVerified: record.lastVerified,
        sources: record.sourceRefs.map((source) => source.source)
      }
    }))
  };
}
