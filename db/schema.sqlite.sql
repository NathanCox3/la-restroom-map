CREATE TABLE IF NOT EXISTS restrooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'unknown',
  operator TEXT,
  address TEXT,
  context TEXT,
  hours_text TEXT,
  opening_hours_osm TEXT,
  wheelchair TEXT NOT NULL DEFAULT 'unknown',
  fee INTEGER NOT NULL DEFAULT 0,
  key_required INTEGER NOT NULL DEFAULT 0,
  purchase_required INTEGER NOT NULL DEFAULT 0,
  gender_neutral INTEGER,
  last_verified TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  notes TEXT,
  source_refs TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS restrooms_lat_lng_idx ON restrooms(latitude, longitude);
CREATE INDEX IF NOT EXISTS restrooms_access_idx ON restrooms(access_type);
CREATE INDEX IF NOT EXISTS restrooms_confidence_idx ON restrooms(confidence);
