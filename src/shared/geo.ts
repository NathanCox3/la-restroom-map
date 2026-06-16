export const LA_CORE_BBOX: [number, number, number, number] = [
  -118.9448,
  33.65,
  -117.6464,
  34.45
];

export const DEFAULT_CENTER = {
  label: "Los Angeles",
  lat: 34.0522,
  lng: -118.2437
};

export const PLACE_PRESETS = [
  { label: "Los Angeles", lat: 34.0522, lng: -118.2437, zoom: 11 },
  { label: "Long Beach", lat: 33.7701, lng: -118.1937, zoom: 12 },
  { label: "South Bay", lat: 33.8847, lng: -118.4109, zoom: 11 },
  { label: "San Pedro", lat: 33.7361, lng: -118.2922, zoom: 12 }
];

export function isInLaCore(latitude: number, longitude: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = LA_CORE_BBOX;
  return longitude >= minLng && longitude <= maxLng && latitude >= minLat && latitude <= maxLat;
}

export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const radiusMeters = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * radiusMeters * Math.asin(Math.sqrt(h));
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

export function formatDistance(meters: number | null): string {
  if (meters === null || Number.isNaN(meters)) return "Distance unknown";
  if (meters < 304.8) return `${Math.round(meters * 3.28084)} ft`;
  return `${metersToMiles(meters).toFixed(meters < 16_000 ? 1 : 0)} mi`;
}

export function bboxFromCenter(lat: number, lng: number, radiusMeters: number): [number, number, number, number] {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lng - lngDelta, lat - latDelta, lng + lngDelta, lat + latDelta];
}
