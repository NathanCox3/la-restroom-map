import {
  Accessibility,
  Clock,
  Database,
  DollarSign,
  Filter,
  Layers,
  List,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  ShieldQuestion,
  X
} from "lucide-react";
import maplibregl, { GeoJSONSource, Map as MapLibreMap, Marker, MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { accessLabel, wheelchairLabel } from "../shared/access";
import { DEFAULT_CENTER, PLACE_PRESETS, formatDistance, haversineMeters } from "../shared/geo";
import type { AppStats, RestroomWithStatus } from "../shared/types";
import { fetchRestrooms, fetchReviewQueue, fetchStats } from "./api";
import { osmRasterStyle } from "./mapStyle";

type ActivePanel = "nearby" | "review";
type TrackingState = "idle" | "requesting" | "active" | "denied" | "unavailable";

const defaultRadiusMeters = 35_000;
const trackingRadiusMeters = 12_000;
const restroomSourceId = "restroom-points-source";
const restroomLayerId = "restroom-points";

declare global {
  interface Window {
    __restroomMap?: MapLibreMap;
  }
}

export function App() {
  const [searchOrigin, setSearchOrigin] = useState({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng });
  const [restrooms, setRestrooms] = useState<RestroomWithStatus[]>([]);
  const [selected, setSelected] = useState<RestroomWithStatus | null>(null);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [reviewQueue, setReviewQueue] = useState<RestroomWithStatus[]>([]);
  const [filters, setFilters] = useState({ openNow: false, accessible: false, free: false });
  const [activePanel, setActivePanel] = useState<ActivePanel>("nearby");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [hasMovedMap, setHasMovedMap] = useState(false);
  const [trackingState, setTrackingState] = useState<TrackingState>("idle");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const restroomsByIdRef = useRef<Map<string, RestroomWithStatus>>(new Map());
  const watchIdRef = useRef<number | null>(null);
  const hasCenteredOnUserRef = useRef(false);
  const lastTrackedSearchRef = useRef<{ lat: number; lng: number } | null>(null);
  const suppressNextMoveEndRef = useRef(false);
  const moveSettledTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void fetchStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    const timeout = window.setTimeout(() => {
      void fetchRestrooms({
        lat: searchOrigin.lat,
        lng: searchOrigin.lng,
        radiusMeters: trackingState === "active" ? trackingRadiusMeters : defaultRadiusMeters,
        limit: 300,
        ...filters
      })
        .then((records) => {
          if (!controller.signal.aborted) setRestrooms(records);
        })
        .catch((loadError: Error) => {
          if (!controller.signal.aborted) setError(loadError.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchOrigin.lat, searchOrigin.lng, filters, trackingState]);

  useEffect(() => {
    if (activePanel !== "review" || reviewQueue.length > 0) return;
    void fetchReviewQueue().then(setReviewQueue).catch(() => setReviewQueue([]));
  }, [activePanel, reviewQueue.length]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: osmRasterStyle,
      center: [searchOrigin.lng, searchOrigin.lat],
      zoom: 10
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "bottom-right");
    map.scrollZoom.enable();
    map.dragPan.enable();
    map.touchZoomRotate.enable({ around: "center" });
    map.on("moveend", () => {
      if (suppressNextMoveEndRef.current) {
        suppressNextMoveEndRef.current = false;
        return;
      }
      if (moveSettledTimerRef.current !== null) {
        window.clearTimeout(moveSettledTimerRef.current);
      }
      moveSettledTimerRef.current = window.setTimeout(() => {
        setHasMovedMap(true);
        moveSettledTimerRef.current = null;
      }, 300);
    });
    map.on("load", () => {
      ensureRestroomLayer(map);
      updateRestroomLayer(map, restroomsByIdRef.current);
      map.on("click", restroomLayerId, (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (!id) return;
        const restroom = restroomsByIdRef.current.get(String(id));
        if (!restroom) return;
        setSelected(restroom);
        suppressNextMoveEndRef.current = true;
        map.flyTo({
          center: [restroom.longitude, restroom.latitude],
          zoom: Math.max(map.getZoom(), 14),
          duration: 500
        });
      });
      map.on("mouseenter", restroomLayerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", restroomLayerId, () => {
        map.getCanvas().style.cursor = "";
      });
    });
    mapRef.current = map;
    if (import.meta.env.DEV) {
      window.__restroomMap = map;
    }
    return () => {
      if (moveSettledTimerRef.current !== null) {
        window.clearTimeout(moveSettledTimerRef.current);
      }
      map.remove();
      mapRef.current = null;
      if (import.meta.env.DEV && window.__restroomMap === map) {
        window.__restroomMap = undefined;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    restroomsByIdRef.current = new Map(restrooms.map((restroom) => [restroom.id, restroom]));
    updateRestroomLayer(map, restroomsByIdRef.current);
  }, [restrooms]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (!userMarkerRef.current) {
      const element = document.createElement("div");
      element.className = "user-location-marker";
      element.setAttribute("aria-label", "Your location");
      userMarkerRef.current = new maplibregl.Marker({ element }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
      return;
    }
    userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
  }, [userLocation]);

  const visibleRecords = useMemo(() => restrooms.slice(0, 80), [restrooms]);

  function goToPlace(place: (typeof PLACE_PRESETS)[number]) {
    suppressNextMoveEndRef.current = true;
    setSearchOrigin({ lat: place.lat, lng: place.lng });
    setHasMovedMap(false);
    mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: place.zoom, duration: 500 });
  }

  function useCurrentLocation() {
    startLocationTracking();
  }

  function startLocationTracking() {
    if (!navigator.geolocation) {
      setTrackingState("unavailable");
      setLocationMessage("Location is not available in this browser.");
      return;
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    setTrackingState("requesting");
    setLocationMessage("Browser permission is needed to track your location while this app is open.");
    const options: PositionOptions = { enableHighAccuracy: true, timeout: 10_000 };
    navigator.geolocation.getCurrentPosition(applyUserPosition, handleLocationError, options);
    watchIdRef.current = navigator.geolocation.watchPosition(applyUserPosition, handleLocationError, options);
  }

  function stopLocationTracking() {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    hasCenteredOnUserRef.current = false;
    lastTrackedSearchRef.current = null;
    setTrackingState("idle");
    setUserLocation(null);
    setLocationMessage("Location tracking is off.");
  }

  function toggleFilter(key: keyof typeof filters) {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  }

  function searchThisArea() {
    const map = mapRef.current;
    if (!map) return;
    const mapCenter = map.getCenter();
    suppressNextMoveEndRef.current = true;
    setSearchOrigin({ lat: mapCenter.lat, lng: mapCenter.lng });
    setHasMovedMap(false);
  }

  function applyUserPosition(position: GeolocationPosition) {
    const next = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null
    };
    const previous = lastTrackedSearchRef.current;
    const shouldRefreshNearby =
      !previous ||
      haversineMeters(
        { latitude: previous.lat, longitude: previous.lng },
        { latitude: next.lat, longitude: next.lng }
      ) > 50;
    setUserLocation(next);
    if (shouldRefreshNearby) {
      lastTrackedSearchRef.current = { lat: next.lat, lng: next.lng };
      setSearchOrigin({ lat: next.lat, lng: next.lng });
      setHasMovedMap(false);
    }
    setTrackingState("active");
    setLocationMessage(locationAccuracyText(next.accuracy));
    if (!hasCenteredOnUserRef.current) {
      suppressNextMoveEndRef.current = true;
      hasCenteredOnUserRef.current = true;
      mapRef.current?.flyTo({ center: [next.lng, next.lat], zoom: 14, duration: 600 });
    }
  }

  function handleLocationError(geoError: GeolocationPositionError) {
    const denied = geoError.code === geoError.PERMISSION_DENIED;
    setTrackingState(denied ? "denied" : "unavailable");
    setLocationMessage(
      denied
        ? "Location permission was denied. Enable location access in the browser to sort by your position."
        : "Unable to read your location right now."
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">LA County coastal/core</div>
          <h1>Public Bathroom Map</h1>
        </div>
        <div className="topbar-stats" aria-label="Dataset summary">
          <span>
            <Database size={16} />
            {stats ? `${stats.total} records` : "Loading"}
          </span>
          <span>
            <Clock size={16} />
            {stats ? `${stats.openKnown} with hours` : "Hours"}
          </span>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar" aria-label="Restroom search controls">
          <div className="search-band">
            <LocationPrompt
              trackingState={trackingState}
              userLocation={userLocation}
              onStart={useCurrentLocation}
              onStop={stopLocationTracking}
            />
            <div className="preset-grid" aria-label="Area presets">
              {PLACE_PRESETS.map((place) => (
                <button key={place.label} type="button" onClick={() => goToPlace(place)}>
                  <Search size={15} />
                  {place.label}
                </button>
              ))}
            </div>
            {locationMessage ? <p className="status-message">{locationMessage}</p> : null}
          </div>

          <div className="filter-row" aria-label="Filters">
            <button className={filters.openNow ? "active" : ""} type="button" onClick={() => toggleFilter("openNow")}>
              <Clock size={16} />
              Open now
            </button>
            <button
              className={filters.accessible ? "active" : ""}
              type="button"
              onClick={() => toggleFilter("accessible")}
            >
              <Accessibility size={16} />
              Accessible
            </button>
            <button className={filters.free ? "active" : ""} type="button" onClick={() => toggleFilter("free")}>
              <DollarSign size={16} />
              Free
            </button>
          </div>

          <div className="panel-tabs" role="tablist" aria-label="Data panels">
            <button
              className={activePanel === "nearby" ? "active" : ""}
              type="button"
              onClick={() => setActivePanel("nearby")}
            >
              <List size={16} />
              Nearby
            </button>
            <button
              className={activePanel === "review" ? "active" : ""}
              type="button"
              onClick={() => setActivePanel("review")}
            >
              <ShieldQuestion size={16} />
              Review
            </button>
          </div>

          {activePanel === "nearby" ? (
            <RestroomList
              records={visibleRecords}
              isLoading={isLoading}
              error={error}
              selectedId={selected?.id ?? null}
              onSelect={(record) => setSelected(record)}
            />
          ) : (
            <ReviewQueue records={reviewQueue} />
          )}
        </aside>

        <section className="map-pane" aria-label="Interactive restroom map">
          <div ref={mapContainerRef} className="map" />
          {hasMovedMap ? (
            <button className="search-area-button" type="button" onClick={searchThisArea}>
              <Search size={16} />
              Search this area
            </button>
          ) : null}
          <div className="map-legend" aria-label="Map legend">
            <span>
              <i className="legend-dot open" /> Open
            </span>
            <span>
              <i className="legend-dot unknown" /> Unknown
            </span>
            <span>
              <i className="legend-dot closed" /> Closed
            </span>
          </div>
          {selected ? <DetailSheet record={selected} onClose={() => setSelected(null)} /> : null}
        </section>
      </section>
    </main>
  );
}

function LocationPrompt({
  trackingState,
  userLocation,
  onStart,
  onStop
}: {
  trackingState: TrackingState;
  userLocation: { lat: number; lng: number; accuracy: number | null } | null;
  onStart: () => void;
  onStop: () => void;
}) {
  const isActive = trackingState === "active";
  return (
    <section className={`location-card ${isActive ? "tracking" : ""}`} aria-label="Location tracking">
      <div>
        <strong>{isActive ? "Tracking your location" : "Show nearest bathrooms"}</strong>
        <span>
          {isActive
            ? locationAccuracyText(userLocation?.accuracy ?? null)
            : "Use your location while the app is open to sort the list by proximity."}
        </span>
      </div>
      {isActive ? (
        <button type="button" onClick={onStop} aria-label="Stop location tracking">
          <X size={17} />
          Stop
        </button>
      ) : (
        <button className="primary-button" type="button" onClick={onStart}>
          <LocateFixed size={18} />
          Use my location while using
        </button>
      )}
    </section>
  );
}

function RestroomList({
  records,
  isLoading,
  error,
  selectedId,
  onSelect
}: {
  records: RestroomWithStatus[];
  isLoading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (record: RestroomWithStatus) => void;
}) {
  if (error) return <div className="empty-state">{error}</div>;
  if (isLoading) return <div className="empty-state">Loading nearby restrooms...</div>;
  if (!records.length) return <div className="empty-state">No matching restrooms in this search area.</div>;

  return (
    <div className="record-list" aria-live="polite">
      {records.map((record) => (
        <button
          key={record.id}
          type="button"
          className={`record-item ${selectedId === record.id ? "selected" : ""}`}
          onClick={() => onSelect(record)}
        >
          <span className={`status-pill ${statusClass(record)}`}>{statusText(record)}</span>
          <strong>{record.name}</strong>
          <span>{formatDistance(record.distanceMeters)}</span>
          <small>{isCandidateHost(record) ? "Possible restroom host" : record.operator ?? accessLabel(record.accessType)}</small>
        </button>
      ))}
    </div>
  );
}

function ReviewQueue({ records }: { records: RestroomWithStatus[] }) {
  if (!records.length) return <div className="empty-state">No review records loaded yet.</div>;
  return (
    <div className="record-list">
      {records.slice(0, 80).map((record) => (
        <article key={record.id} className="review-item">
          <div>
            <strong>{record.name}</strong>
            <span>{record.sourceRefs.map((source) => source.source).join(", ")}</span>
          </div>
          <p>
            <Filter size={14} />
            Confidence {Math.round(record.confidence * 100)}%, {accessLabel(record.accessType)}, hours{" "}
            {record.hoursText ?? "unknown"}
          </p>
        </article>
      ))}
    </div>
  );
}

function DetailSheet({ record, onClose }: { record: RestroomWithStatus; onClose: () => void }) {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${record.latitude},${record.longitude}`;
  const appleMapsUrl = `https://maps.apple.com/?daddr=${record.latitude},${record.longitude}`;
  return (
    <article className="detail-sheet" aria-label={`${record.name} details`}>
      <div className="detail-header">
        <span className={`status-pill ${statusClass(record)}`}>{statusText(record)}</span>
        <button type="button" onClick={onClose} aria-label="Close details">
          Close
        </button>
      </div>
      <h2>{record.name}</h2>
      <p className="detail-context">{record.address ?? record.context ?? record.operator ?? "Location details unavailable"}</p>
      {isCandidateHost(record) ? (
        <p className="candidate-warning">
          Possible restroom host. Availability is unverified and may require a purchase, key, code, or staff permission.
        </p>
      ) : null}
      <dl className="detail-grid">
        <div>
          <dt>Distance</dt>
          <dd>{formatDistance(record.distanceMeters)}</dd>
        </div>
        <div>
          <dt>Hours</dt>
          <dd>{record.hoursText ?? record.openingHoursOsm ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>{accessLabel(record.accessType)}</dd>
        </div>
        <div>
          <dt>Accessibility</dt>
          <dd>{wheelchairLabel(record.wheelchair)}</dd>
        </div>
        <div>
          <dt>Cost/key</dt>
          <dd>{costText(record)}</dd>
        </div>
        <div>
          <dt>Last checked</dt>
          <dd>{record.lastVerified ?? "Unknown"}</dd>
        </div>
      </dl>
      {record.notes ? <p className="notes">{record.notes}</p> : null}
      <div className="source-line">
        <Layers size={15} />
        {record.sourceRefs.map((source) => source.source).join(", ")} · {Math.round(record.confidence * 100)}% confidence
      </div>
      <div className="navigation-row">
        <a className="primary-button" href={googleMapsUrl} target="_blank" rel="noreferrer">
          <Navigation size={17} />
          Google Maps
        </a>
        <a href={appleMapsUrl} target="_blank" rel="noreferrer">
          <MapPin size={17} />
          Apple Maps
        </a>
      </div>
    </article>
  );
}

function statusText(record: RestroomWithStatus): string {
  if (isCandidateHost(record)) return "Possible";
  if (record.openStatus === "open") return "Open";
  if (record.openStatus === "closed") return "Closed";
  return "Unknown";
}

function statusClass(record: RestroomWithStatus): string {
  return isCandidateHost(record) ? "candidate" : record.openStatus;
}

function costText(record: RestroomWithStatus): string {
  const flags = [
    record.fee ? "fee" : null,
    record.keyRequired ? "key/code" : null,
    record.purchaseRequired ? "purchase" : null
  ].filter(Boolean);
  return flags.length ? flags.join(", ") : "No fee/key known";
}

function locationAccuracyText(accuracy: number | null): string {
  if (accuracy === null) return "Tracking location. Nearby restrooms are sorted from your current position.";
  const rounded = accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${Math.round(accuracy)} m`;
  return `Tracking location. Accuracy about ${rounded}.`;
}

function isCandidateHost(record: RestroomWithStatus): boolean {
  return record.sourceRefs.some((source) => source.source === "OpenStreetMap Candidate Host");
}

function ensureRestroomLayer(map: MapLibreMap) {
  if (!map.getSource(restroomSourceId)) {
    map.addSource(restroomSourceId, {
      type: "geojson",
      data: emptyRestroomFeatureCollection()
    });
  }
  if (!map.getLayer(restroomLayerId)) {
    map.addLayer({
      id: restroomLayerId,
      type: "circle",
      source: restroomSourceId,
      paint: {
        "circle-radius": [
          "case",
          ["==", ["get", "status"], "candidate"],
          5,
          6
        ],
        "circle-color": [
          "match",
          ["get", "status"],
          "open",
          "#228b58",
          "closed",
          "#b94a3c",
          "candidate",
          "#4338ca",
          "#b97816"
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-opacity": 0.96
      }
    });
  }
}

function updateRestroomLayer(map: MapLibreMap, restroomsById: Map<string, RestroomWithStatus>) {
  if (!map.loaded() || !map.getSource(restroomSourceId)) return;
  const source = map.getSource(restroomSourceId) as GeoJSONSource;
  source.setData({
    type: "FeatureCollection",
    features: [...restroomsById.values()].map((restroom) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [restroom.longitude, restroom.latitude]
      },
      properties: {
        id: restroom.id,
        status: isCandidateHost(restroom) ? "candidate" : restroom.openStatus
      }
    }))
  });
}

function emptyRestroomFeatureCollection() {
  return {
    type: "FeatureCollection" as const,
    features: []
  };
}
