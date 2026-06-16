import { normalizeAccess, normalizeWheelchair, parseBooleanTag } from "../../shared/access";
import { LA_CORE_BBOX, isInLaCore } from "../../shared/geo";
import type { AccessType, RestroomRecord, SourceAdapterResult } from "../../shared/types";
import { stableId } from "../ids";
import type { SourceAdapter } from "../sourceAdapter";

const sourceName = "OpenStreetMap Candidate Host";
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

const amenityPattern = [
  "restaurant",
  "fast_food",
  "cafe",
  "bar",
  "pub",
  "fuel",
  "library",
  "community_centre",
  "cinema",
  "theatre",
  "arts_centre",
  "marketplace",
  "bus_station",
  "ferry_terminal",
  "townhall",
  "college",
  "university",
  "hospital",
  "clinic",
  "place_of_worship"
].join("|");

const shopPattern = ["supermarket", "mall", "department_store", "convenience", "chemist", "variety_store"].join("|");
const tourismPattern = ["museum", "gallery", "hotel", "motel", "aquarium", "theme_park", "zoo"].join("|");
const leisurePattern = ["sports_centre", "stadium", "fitness_centre", "marina", "park"].join("|");

export const osmCandidateHostsAdapter: SourceAdapter = {
  name: sourceName,
  enabledByDefault: false,
  async fetchRecords(): Promise<SourceAdapterResult> {
    const importedAt = new Date().toISOString();
    const warnings: string[] = [];
    const bySourceId = new Map<string, RestroomRecord>();

    const tiles = splitBbox(LA_CORE_BBOX, 5, 4);
    for (const [index, bbox] of tiles.entries()) {
      try {
        console.log(`${sourceName}: tile ${index + 1}/${tiles.length}`);
        const payload = await fetchCandidateTile(bbox);
        for (const element of payload.elements) {
          const record = normalizeCandidateElement(element, importedAt);
          if (!record) continue;
          if (!isInLaCore(record.latitude, record.longitude)) continue;
          if (!bySourceId.has(record.sourceRefs[0].sourceId)) {
            bySourceId.set(record.sourceRefs[0].sourceId, record);
          }
        }
        await delay(250);
      } catch (error) {
        warnings.push(`Candidate host tile ${bbox.join(",")} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { sourceName, records: [...bySourceId.values()], warnings };
  }
};

async function fetchCandidateTile([minLng, minLat, maxLng, maxLat]: [number, number, number, number]): Promise<OverpassResponse> {
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = `
[out:json][timeout:75];
(
  node["amenity"~"^(${amenityPattern})$"](${bbox});
  node["shop"~"^(${shopPattern})$"](${bbox});
  node["tourism"~"^(${tourismPattern})$"](${bbox});
  node["leisure"~"^(${leisurePattern})$"](${bbox});
  node["public_transport"="station"](${bbox});
  way["amenity"~"^(fuel|library|community_centre|cinema|theatre|arts_centre|marketplace|bus_station|ferry_terminal|townhall)$"](${bbox});
  relation["amenity"~"^(fuel|library|community_centre|cinema|theatre|arts_centre|marketplace|bus_station|ferry_terminal|townhall)$"](${bbox});
  way["tourism"~"^(museum|gallery|aquarium|theme_park|zoo)$"](${bbox});
  relation["tourism"~"^(museum|gallery|aquarium|theme_park|zoo)$"](${bbox});
  way["leisure"~"^(sports_centre|stadium|marina|park)$"](${bbox});
  relation["leisure"~"^(sports_centre|stadium|marina|park)$"](${bbox});
);
out center tags;
`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const response = await fetch(overpassUrl, {
    method: "POST",
    body: new URLSearchParams({ data: query }),
    signal: controller.signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "restroom-map-mvp/0.1 deep-candidate-import"
    }
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`Overpass candidate request failed with ${response.status}`);
  return response.json() as Promise<OverpassResponse>;
}

function normalizeCandidateElement(element: OverpassElement, importedAt: string): RestroomRecord | null {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const tags = element.tags ?? {};
  if (tags.amenity === "toilets" || tags.toilets === "no") return null;

  const sourceId = `${element.type}/${element.id}`;
  const category = hostCategory(tags);
  const accessType = inferCandidateAccess(tags);
  const name = tags.name?.trim() || tags.operator?.trim() || category.label;
  const hasToiletTag = tags.toilets === "yes" || Boolean(tags["toilets:access"]);
  const confidence = hasToiletTag ? 0.54 : category.baseConfidence;
  const purchaseRequired = accessType === "customers" || category.purchaseLikely;

  return {
    id: stableId(sourceName, sourceId),
    name,
    latitude: latitude as number,
    longitude: longitude as number,
    accessType,
    operator: tags.operator ?? null,
    address: formatOsmAddress(tags),
    context: category.label,
    hoursText: tags.opening_hours ?? null,
    openingHoursOsm: tags.opening_hours ?? null,
    wheelchair: normalizeWheelchair(tags["toilets:wheelchair"] ?? tags.wheelchair),
    fee: parseBooleanTag(tags.fee) ?? false,
    keyRequired: parseBooleanTag(tags.locked) === true || Boolean(tags["toilets:doorcode"]),
    purchaseRequired,
    genderNeutral: parseBooleanTag(tags.unisex),
    lastVerified: importedAt.slice(0, 10),
    confidence,
    notes: candidateNotes(category.label, hasToiletTag, purchaseRequired),
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

function hostCategory(tags: Record<string, string>): { label: string; baseConfidence: number; purchaseLikely: boolean } {
  const amenity = tags.amenity;
  if (["restaurant", "fast_food", "cafe", "bar", "pub"].includes(amenity)) {
    return { label: "Food or drink business; restroom not verified", baseConfidence: 0.3, purchaseLikely: true };
  }
  if (amenity === "fuel") return { label: "Gas station; restroom not verified", baseConfidence: 0.34, purchaseLikely: true };
  if (["library", "community_centre", "townhall", "bus_station", "ferry_terminal"].includes(amenity)) {
    return { label: "Public institution or transit site; restroom not verified", baseConfidence: 0.42, purchaseLikely: false };
  }
  if (["cinema", "theatre", "arts_centre", "marketplace"].includes(amenity)) {
    return { label: "Public-facing venue; restroom not verified", baseConfidence: 0.36, purchaseLikely: true };
  }
  if (["college", "university", "hospital", "clinic", "place_of_worship"].includes(amenity)) {
    return { label: "Institution open to some visitors; restroom not verified", baseConfidence: 0.34, purchaseLikely: false };
  }
  if (tags.shop) return { label: "Retail business; restroom not verified", baseConfidence: 0.28, purchaseLikely: true };
  if (tags.tourism) return { label: "Visitor destination; restroom not verified", baseConfidence: 0.35, purchaseLikely: true };
  if (tags.leisure) return { label: "Recreation site; restroom not verified", baseConfidence: 0.36, purchaseLikely: false };
  if (tags.public_transport === "station") return { label: "Transit station; restroom not verified", baseConfidence: 0.32, purchaseLikely: false };
  return { label: "Public-facing place; restroom not verified", baseConfidence: 0.25, purchaseLikely: false };
}

function inferCandidateAccess(tags: Record<string, string>): AccessType {
  if (tags["toilets:access"]) return normalizeAccess(tags["toilets:access"]);
  if (tags.access) return normalizeAccess(tags.access);
  const category = hostCategory(tags);
  if (category.purchaseLikely) return "customers";
  if (category.baseConfidence >= 0.4) return "public";
  return "unknown";
}

function candidateNotes(categoryLabel: string, hasToiletTag: boolean, purchaseRequired: boolean): string {
  const confidenceNote = hasToiletTag
    ? "OpenStreetMap has a toilet-related tag for this host, but details still need field verification."
    : "Possible restroom host inferred from place type; restroom availability is not verified.";
  const purchaseNote = purchaseRequired ? "May require a purchase, code, key, or staff permission." : "Access rules may vary by hours, staffing, or facility policy.";
  return `${categoryLabel}. ${confidenceNote} ${purchaseNote}`;
}

function formatOsmAddress(tags: Record<string, string>): string | null {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"],
    tags["addr:postcode"]
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function splitBbox(
  [minLng, minLat, maxLng, maxLat]: [number, number, number, number],
  columns: number,
  rows: number
): Array<[number, number, number, number]> {
  const tiles: Array<[number, number, number, number]> = [];
  const lngStep = (maxLng - minLng) / columns;
  const latStep = (maxLat - minLat) / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      tiles.push([
        minLng + column * lngStep,
        minLat + row * latStep,
        column === columns - 1 ? maxLng : minLng + (column + 1) * lngStep,
        row === rows - 1 ? maxLat : minLat + (row + 1) * latStep
      ]);
    }
  }
  return tiles;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
