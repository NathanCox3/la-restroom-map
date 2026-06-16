import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { sampleRestrooms } from "../../etl/sampleData";
import { buildStats, applyRestroomQuery } from "../query";
import type { RestroomRepository } from "../repository";
import type { RestroomQuery, RestroomRecord, RestroomWithStatus, SourceRef } from "../../shared/types";
import { bboxFromCenter } from "../../shared/geo";

type SqliteDatabase = Database.Database;

interface RestroomRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  access_type: RestroomRecord["accessType"];
  operator: string | null;
  address: string | null;
  context: string | null;
  hours_text: string | null;
  opening_hours_osm: string | null;
  wheelchair: RestroomRecord["wheelchair"];
  fee: 0 | 1;
  key_required: 0 | 1;
  purchase_required: 0 | 1;
  gender_neutral: 0 | 1 | null;
  last_verified: string | null;
  confidence: number;
  notes: string | null;
  source_refs: string;
}

export async function createSqliteRepository(filePath: string): Promise<RestroomRepository> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  ensureSchema(db);
  seedIfEmpty(db);
  return sqliteRepositoryFromDb(db);
}

export function sqliteRepositoryFromDb(db: SqliteDatabase): RestroomRepository {
  ensureSchema(db);
  return {
    async list(query: RestroomQuery) {
      const records = loadForQuery(db, query);
      return applyRestroomQuery(records, query);
    },
    async getById(id: string) {
      const row = db.prepare("SELECT * FROM restrooms WHERE id = ?").get(id) as RestroomRow | undefined;
      if (!row) return null;
      return applyRestroomQuery([rowToRecord(row)], { limit: 1 })[0] ?? null;
    },
    async replaceAll(records: RestroomRecord[]) {
      const transaction = db.transaction((incoming: RestroomRecord[]) => {
        db.prepare("DELETE FROM restrooms").run();
        const insert = db.prepare(`
          INSERT INTO restrooms (
            id, name, latitude, longitude, access_type, operator, address, context,
            hours_text, opening_hours_osm, wheelchair, fee, key_required, purchase_required,
            gender_neutral, last_verified, confidence, notes, source_refs, updated_at
          ) VALUES (
            @id, @name, @latitude, @longitude, @access_type, @operator, @address, @context,
            @hours_text, @opening_hours_osm, @wheelchair, @fee, @key_required, @purchase_required,
            @gender_neutral, @last_verified, @confidence, @notes, @source_refs, CURRENT_TIMESTAMP
          )
        `);
        for (const record of incoming) {
          insert.run(recordToRow(record));
        }
      });
      transaction(records);
    },
    async stats() {
      return buildStats(loadAll(db));
    },
    async importReview() {
      return applyRestroomQuery(loadAll(db), { limit: 1000 }).filter(
        (record) => record.confidence < 0.65 || !record.hoursText || record.accessType === "unknown"
      );
    },
    async close() {
      db.close();
    }
  };
}

function ensureSchema(db: SqliteDatabase) {
  const schemaPath = path.resolve(process.cwd(), "db/schema.sqlite.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
}

function seedIfEmpty(db: SqliteDatabase) {
  const count = db.prepare("SELECT COUNT(*) as count FROM restrooms").get() as { count: number };
  if (count.count > 0) return;
  const repo = sqliteRepositoryFromDb(db);
  void repo.replaceAll(sampleRestrooms);
}

function loadAll(db: SqliteDatabase): RestroomRecord[] {
  const rows = db.prepare("SELECT * FROM restrooms").all() as RestroomRow[];
  return rows.map(rowToRecord);
}

function loadForQuery(db: SqliteDatabase, query: RestroomQuery): RestroomRecord[] {
  const bbox =
    Number.isFinite(query.lat) && Number.isFinite(query.lng) && query.radiusMeters
      ? bboxFromCenter(query.lat as number, query.lng as number, query.radiusMeters)
      : query.bbox;

  if (!bbox) return loadAll(db);
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const rows = db
    .prepare(
      `
        SELECT *
        FROM restrooms
        WHERE longitude BETWEEN ? AND ?
          AND latitude BETWEEN ? AND ?
      `
    )
    .all(minLng, maxLng, minLat, maxLat) as RestroomRow[];
  return rows.map(rowToRecord);
}

function rowToRecord(row: RestroomRow): RestroomRecord {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    accessType: row.access_type,
    operator: row.operator,
    address: row.address,
    context: row.context,
    hoursText: row.hours_text,
    openingHoursOsm: row.opening_hours_osm,
    wheelchair: row.wheelchair,
    fee: Boolean(row.fee),
    keyRequired: Boolean(row.key_required),
    purchaseRequired: Boolean(row.purchase_required),
    genderNeutral: row.gender_neutral === null ? null : Boolean(row.gender_neutral),
    lastVerified: row.last_verified,
    confidence: row.confidence,
    notes: row.notes,
    sourceRefs: JSON.parse(row.source_refs) as SourceRef[]
  };
}

function recordToRow(record: RestroomRecord) {
  return {
    id: record.id,
    name: record.name,
    latitude: record.latitude,
    longitude: record.longitude,
    access_type: record.accessType,
    operator: record.operator,
    address: record.address,
    context: record.context,
    hours_text: record.hoursText,
    opening_hours_osm: record.openingHoursOsm,
    wheelchair: record.wheelchair,
    fee: record.fee ? 1 : 0,
    key_required: record.keyRequired ? 1 : 0,
    purchase_required: record.purchaseRequired ? 1 : 0,
    gender_neutral: record.genderNeutral === null ? null : record.genderNeutral ? 1 : 0,
    last_verified: record.lastVerified,
    confidence: record.confidence,
    notes: record.notes,
    source_refs: JSON.stringify(record.sourceRefs)
  };
}
