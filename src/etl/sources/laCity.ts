import { stableId } from "../ids";
import type { SourceAdapter } from "../sourceAdapter";
import type { RestroomRecord, SourceAdapterResult } from "../../shared/types";
import { isInLaCore } from "../../shared/geo";

const sourceName = "LA City Restroom";
const datasetUrl = "https://data.lacity.org/City-Infrastructure-Service-Requests/Restroom/s5e6-2pbm";
const apiUrl = "https://data.lacity.org/resource/s5e6-2pbm.json?$limit=5000";

interface LaCityRow {
  the_geom?: {
    type?: string;
    coordinates?: [number, number];
  };
  facility?: string;
  level?: string;
  gender?: string;
  toilets?: string;
  urinals?: string;
  faucets?: string;
  notes?: string;
}

export const laCityAdapter: SourceAdapter = {
  name: sourceName,
  enabledByDefault: true,
  async fetchRecords(): Promise<SourceAdapterResult> {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "restroom-map-mvp/0.1"
      }
    });
    if (!response.ok) {
      throw new Error(`LA City request failed with ${response.status}`);
    }
    const rows = (await response.json()) as LaCityRow[];
    const importedAt = new Date().toISOString();
    const warnings: string[] = [];
    const records = rows
      .map((row, index) => normalizeLaCityRow(row, index, importedAt))
      .filter((record): record is RestroomRecord => {
        if (!record) return false;
        if (!isInLaCore(record.latitude, record.longitude)) {
          warnings.push(`Skipped ${record.name}: outside LA core bbox`);
          return false;
        }
        return true;
      });

    return { sourceName, records, warnings };
  }
};

function normalizeLaCityRow(row: LaCityRow, index: number, importedAt: string): RestroomRecord | null {
  const coordinates = row.the_geom?.coordinates;
  if (!coordinates || coordinates.length !== 2) return null;
  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const facility = row.facility?.trim() || "Port of Los Angeles restroom";
  const sourceId = [facility, row.level, row.gender, latitude.toFixed(7), longitude.toFixed(7), index].join("|");
  const fixtureCount = Number(row.toilets ?? 0) + Number(row.urinals ?? 0) + Number(row.faucets ?? 0);
  const confidence = fixtureCount > 0 ? 0.72 : 0.58;
  const notes = [
    row.gender ? `Gender: ${row.gender}` : null,
    row.level ? `Level ${row.level}` : null,
    row.toilets ? `${row.toilets} toilets` : null,
    row.urinals ? `${row.urinals} urinals` : null,
    row.notes?.trim() || null,
    "Source does not provide public hours; verify access on arrival."
  ]
    .filter(Boolean)
    .join(". ");

  return {
    id: stableId(sourceName, sourceId),
    name: facility,
    latitude,
    longitude,
    accessType: "unknown",
    operator: "Port of Los Angeles",
    address: null,
    context: row.level ? `Level ${row.level}` : null,
    hoursText: null,
    openingHoursOsm: null,
    wheelchair: "unknown",
    fee: false,
    keyRequired: false,
    purchaseRequired: false,
    genderNeutral: row.gender?.toLowerCase().includes("men/women") ? false : null,
    lastVerified: importedAt.slice(0, 10),
    confidence,
    notes,
    sourceRefs: [
      {
        source: sourceName,
        sourceId,
        url: datasetUrl,
        license: "Public-domain-style dataset metadata via Data.gov",
        importedAt,
        raw: row as Record<string, unknown>
      }
    ]
  };
}
