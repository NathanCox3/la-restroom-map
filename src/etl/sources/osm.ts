import { normalizeAccess, normalizeWheelchair, parseBooleanTag } from "../../shared/access";
import { LA_CORE_BBOX, isInLaCore } from "../../shared/geo";
import type { AccessType, RestroomRecord, SourceAdapterResult } from "../../shared/types";
import { stableId } from "../ids";
import type { SourceAdapter } from "../sourceAdapter";

const sourceName = "OpenStreetMap";
const overpassUrl = "https://overpass-api.de/api/interpreter";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export const osmAdapter: SourceAdapter = {
  name: sourceName,
  enabledByDefault: true,
  async fetchRecords(): Promise<SourceAdapterResult> {
    const [minLng, minLat, maxLng, maxLat] = LA_CORE_BBOX;
    const query = `
[out:json][timeout:50];
(
  node["amenity"="toilets"](${minLat},${minLng},${maxLat},${maxLng});
  way["amenity"="toilets"](${minLat},${minLng},${maxLat},${maxLng});
  relation["amenity"="toilets"](${minLat},${minLng},${maxLat},${maxLng});
);
out center tags;
`;
    const body = new URLSearchParams({ data: query });
    const response = await fetch(overpassUrl, {
      method: "POST",
      body,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "restroom-map-mvp/0.1"
      }
    });
    if (!response.ok) {
      throw new Error(`Overpass request failed with ${response.status}`);
    }
    const payload = (await response.json()) as OverpassResponse;
    const importedAt = new Date().toISOString();
    const warnings: string[] = [];
    const records = payload.elements
      .map((element) => normalizeOsmElement(element, importedAt))
      .filter((record): record is RestroomRecord => {
        if (!record) return false;
        if (!isInLaCore(record.latitude, record.longitude)) {
          warnings.push(`Skipped OSM record ${record.id}: outside LA core bbox`);
          return false;
        }
        if (record.accessType === "restricted") return false;
        return true;
      });
    return { sourceName, records, warnings };
  }
};

function normalizeOsmElement(element: OverpassElement, importedAt: string): RestroomRecord | null {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const tags = element.tags ?? {};
  const accessType = inferAccess(tags);
  const sourceId = `${element.type}/${element.id}`;
  const name = tags.name?.trim() || tags.operator?.trim() || tags.description?.trim() || "Public restroom";
  const openingHours = tags.opening_hours?.trim() || null;
  const fee = parseBooleanTag(tags.fee) ?? false;
  const keyRequired = parseBooleanTag(tags.locked) === true || Boolean(tags["toilets:doorcode"]);
  const purchaseRequired = accessType === "customers" || tags.access === "customers";
  const wheelchair = normalizeWheelchair(tags.wheelchair);
  const genderNeutral =
    parseBooleanTag(tags.unisex) ?? (tags.gender_segregated === "no" ? true : tags.gender_segregated === "yes" ? false : null);

  const confidence =
    0.55 +
    (accessType === "public" ? 0.1 : 0) +
    (openingHours ? 0.08 : 0) +
    (wheelchair !== "unknown" ? 0.05 : 0) +
    (tags.name ? 0.04 : 0);

  return {
    id: stableId(sourceName, sourceId),
    name,
    latitude: latitude as number,
    longitude: longitude as number,
    accessType,
    operator: tags.operator ?? null,
    address: formatOsmAddress(tags),
    context: tags.description ?? null,
    hoursText: openingHours,
    openingHoursOsm: openingHours,
    wheelchair,
    fee,
    keyRequired,
    purchaseRequired,
    genderNeutral,
    lastVerified: importedAt.slice(0, 10),
    confidence: Math.min(confidence, 0.9),
    notes: formatOsmNotes(tags),
    sourceRefs: [
      {
        source: sourceName,
        sourceId,
        url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        license: "Open Database License (ODbL)",
        importedAt,
        raw: element as unknown as Record<string, unknown>
      }
    ]
  };
}

function inferAccess(tags: Record<string, string>): AccessType {
  if (tags.access) return normalizeAccess(tags.access);
  if (tags["toilets:access"]) return normalizeAccess(tags["toilets:access"]);
  return "public";
}

function formatOsmAddress(tags: Record<string, string>): string | null {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"],
    tags["addr:postcode"]
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function formatOsmNotes(tags: Record<string, string>): string | null {
  const notes = [
    tags.description,
    tags.note,
    tags.fee === "yes" ? "Fee may apply." : null,
    tags.access === "customers" ? "May require purchase." : null,
    tags.locked === "yes" ? "May be locked." : null
  ].filter(Boolean);
  return notes.length ? notes.join(" ") : null;
}
