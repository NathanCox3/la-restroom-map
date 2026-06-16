CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS restrooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geom GEOGRAPHY(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::GEOGRAPHY) STORED,
  access_type TEXT NOT NULL DEFAULT 'unknown',
  operator TEXT,
  address TEXT,
  context TEXT,
  hours_text TEXT,
  opening_hours_osm TEXT,
  wheelchair TEXT NOT NULL DEFAULT 'unknown',
  fee BOOLEAN NOT NULL DEFAULT FALSE,
  key_required BOOLEAN NOT NULL DEFAULT FALSE,
  purchase_required BOOLEAN NOT NULL DEFAULT FALSE,
  gender_neutral BOOLEAN,
  last_verified DATE,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  notes TEXT,
  source_refs JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS restrooms_geom_idx ON restrooms USING GIST (geom);
CREATE INDEX IF NOT EXISTS restrooms_access_idx ON restrooms(access_type);
CREATE INDEX IF NOT EXISTS restrooms_source_refs_idx ON restrooms USING GIN (source_refs);
