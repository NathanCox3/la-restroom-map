# Public Bathroom Map MVP

A local-dev MVP for finding public-first restrooms across Los Angeles County's coastal/core area, with emphasis on South Bay, Los Angeles, San Pedro, and Long Beach.

The app uses MapLibre with OpenStreetMap-compatible raster tiles, an Express API, a local SQLite fallback, and a PostGIS schema for production-style geospatial storage.

## Quick Start

```bash
npm install
npm run import
npm run import:deep
npm run dev
```

Open the Vite URL printed by `npm run dev`, usually `http://127.0.0.1:5173`.

If a live data source is unavailable, seed the demo database:

```bash
npm run import:sample
```

Use `npm run import:deep` when you want the broadest local database. It imports confirmed public restroom points plus low-confidence possible restroom hosts such as restaurants, cafes, gas stations, libraries, malls, museums, transit stations, parks, and other public-facing institutions. These are labeled `Possible` in the app until field-verified.

## Data Sources

- LA City Restroom dataset: https://data.lacity.org/City-Infrastructure-Service-Requests/Restroom/s5e6-2pbm
- LA City JSON API: https://data.lacity.org/resource/s5e6-2pbm.json
- OpenStreetMap `amenity=toilets`: https://wiki.openstreetmap.org/wiki/Tag%3Aamenity%3Dtoilets
- Overpass API: https://overpass-api.de/api/interpreter
- OpenStreetMap candidate host POIs: restaurants, gas stations, public institutions, retail, recreation, tourism, and transit station tags.
- LA GeoHub: https://geohub.lacity.org/
- Long Beach GIS portal: https://maps.longbeach.gov/

OpenStreetMap data is licensed under the ODbL. LA City dataset metadata lists a public-domain-style license via Data.gov. Production use should retain source attribution and comply with tile provider usage policies.

## Architecture

- `src/etl`: source adapters, normalization, dedupe, and import CLI.
- `src/server`: REST API plus SQLite/PostGIS repository adapters.
- `src/client`: mobile-first map UI.
- `db`: SQLite and PostGIS schemas.
- `data/restrooms.latest.geojson`: generated export from the most recent import.

The SQLite path defaults to `./data/restrooms.sqlite`. Set `DATABASE_URL` to a `postgres://` connection string to use PostGIS.

## API

- `GET /api/health`
- `GET /api/restrooms?lat=33.77&lng=-118.19&radiusMeters=25000&openNow=false&accessible=false&free=false`
- `GET /api/restrooms/:id`
- `GET /api/stats`
- `GET /api/admin/import-review`

## PostGIS

The MVP can run without Docker. For a real PostGIS database, install Docker or PostgreSQL/PostGIS locally, then use `db/schema.postgis.sql`.

```bash
docker compose up -d db
$env:DATABASE_URL="postgres://restrooms:restrooms@localhost:5432/restrooms"
npm run import
npm run dev
```

## Reliability Model

The app never treats missing hours as open. Records with unknown hours show `Unknown`, not `Open`. Imported data keeps source provenance and confidence so users can judge reliability.

Deep candidate records are intentionally low confidence. They mean “this place may plausibly have a restroom,” not “a restroom is confirmed.”

## Verification

```bash
npm test
npm run build
```

The included Playwright spec expects the dev server to be running and can be used later for browser-level smoke tests.
