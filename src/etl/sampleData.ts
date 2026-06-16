import type { RestroomRecord } from "../shared/types";
import { stableId } from "./ids";

const importedAt = new Date().toISOString();

export const sampleRestrooms: RestroomRecord[] = [
  {
    id: stableId("MVP sample", "22nd Street Park|-118.2832257|33.72534"),
    name: "22nd Street Park",
    latitude: 33.725340002287666,
    longitude: -118.28322566374709,
    accessType: "unknown",
    operator: "Port of Los Angeles",
    address: null,
    context: "San Pedro waterfront",
    hoursText: null,
    openingHoursOsm: null,
    wheelchair: "unknown",
    fee: false,
    keyRequired: false,
    purchaseRequired: false,
    genderNeutral: null,
    lastVerified: importedAt.slice(0, 10),
    confidence: 0.45,
    notes: "Demo fallback from LA City restroom sample. Verify access and hours before relying on it.",
    sourceRefs: [
      {
        source: "MVP sample",
        sourceId: "22nd Street Park",
        url: "https://data.lacity.org/City-Infrastructure-Service-Requests/Restroom/s5e6-2pbm",
        importedAt,
        license: "Public-domain-style dataset metadata via Data.gov"
      }
    ]
  },
  {
    id: stableId("MVP sample", "300 Water St|-118.2555396|33.7662197"),
    name: "300 Water St",
    latitude: 33.766219655424734,
    longitude: -118.25553963599644,
    accessType: "unknown",
    operator: "Port of Los Angeles",
    address: "300 Water St",
    context: "Port of Los Angeles",
    hoursText: null,
    openingHoursOsm: null,
    wheelchair: "unknown",
    fee: false,
    keyRequired: false,
    purchaseRequired: false,
    genderNeutral: false,
    lastVerified: importedAt.slice(0, 10),
    confidence: 0.45,
    notes: "Demo fallback from LA City restroom sample. Verify access and hours before relying on it.",
    sourceRefs: [
      {
        source: "MVP sample",
        sourceId: "300 Water St",
        url: "https://data.lacity.org/City-Infrastructure-Service-Requests/Restroom/s5e6-2pbm",
        importedAt,
        license: "Public-domain-style dataset metadata via Data.gov"
      }
    ]
  }
];
