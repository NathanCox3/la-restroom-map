import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { applyRestroomQuery, buildStats } from "../query";
import type { RestroomRepository } from "../repository";
import type { RestroomQuery, RestroomRecord, RestroomWithStatus, SourceRef } from "../../shared/types";

const { Pool } = pg;

export async function createPostgresRepository(connectionString: string): Promise<RestroomRepository> {
  const pool = new Pool({ connectionString });
  const schema = await fs.readFile(path.resolve(process.cwd(), "db/schema.postgis.sql"), "utf8");
  await pool.query(schema);

  return {
    async list(query: RestroomQuery) {
      const records = await queryRecords(pool, query);
      return applyRestroomQuery(records, query);
    },
    async getById(id: string) {
      const result = await pool.query("SELECT * FROM restrooms WHERE id = $1", [id]);
      if (!result.rowCount) return null;
      return applyRestroomQuery([rowToRecord(result.rows[0])], { limit: 1 })[0] ?? null;
    },
    async replaceAll(records: RestroomRecord[]) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM restrooms");
        for (const record of records) {
          await client.query(
            `
              INSERT INTO restrooms (
                id, name, latitude, longitude, access_type, operator, address, context,
                hours_text, opening_hours_osm, wheelchair, fee, key_required, purchase_required,
                gender_neutral, last_verified, confidence, notes, source_refs, updated_at
              )
              VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19::jsonb, NOW()
              )
            `,
            [
              record.id,
              record.name,
              record.latitude,
              record.longitude,
              record.accessType,
              record.operator,
              record.address,
              record.context,
              record.hoursText,
              record.openingHoursOsm,
              record.wheelchair,
              record.fee,
              record.keyRequired,
              record.purchaseRequired,
              record.genderNeutral,
              record.lastVerified,
              record.confidence,
              record.notes,
              JSON.stringify(record.sourceRefs)
            ]
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async stats() {
      return buildStats(await loadAll(pool));
    },
    async importReview() {
      const records = await loadAll(pool);
      return applyRestroomQuery(records, { limit: 1000 }).filter(
        (record) => record.confidence < 0.65 || !record.hoursText || record.accessType === "unknown"
      );
    },
    async close() {
      await pool.end();
    }
  };
}

async function queryRecords(pool: pg.Pool, query: RestroomQuery): Promise<RestroomRecord[]> {
  if (query.lat && query.lng && query.radiusMeters) {
    const result = await pool.query(
      `
        SELECT *
        FROM restrooms
        WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        LIMIT $4
      `,
      [query.lng, query.lat, query.radiusMeters, query.limit ?? 500]
    );
    return result.rows.map(rowToRecord);
  }
  if (query.bbox) {
    const [minLng, minLat, maxLng, maxLat] = query.bbox;
    const result = await pool.query(
      `
        SELECT *
        FROM restrooms
        WHERE longitude BETWEEN $1 AND $3
          AND latitude BETWEEN $2 AND $4
        LIMIT $5
      `,
      [minLng, minLat, maxLng, maxLat, query.limit ?? 500]
    );
    return result.rows.map(rowToRecord);
  }
  return loadAll(pool);
}

async function loadAll(pool: pg.Pool): Promise<RestroomRecord[]> {
  const result = await pool.query("SELECT * FROM restrooms LIMIT 5000");
  return result.rows.map(rowToRecord);
}

function rowToRecord(row: Record<string, unknown>): RestroomRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accessType: row.access_type as RestroomRecord["accessType"],
    operator: (row.operator as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    context: (row.context as string | null) ?? null,
    hoursText: (row.hours_text as string | null) ?? null,
    openingHoursOsm: (row.opening_hours_osm as string | null) ?? null,
    wheelchair: row.wheelchair as RestroomRecord["wheelchair"],
    fee: Boolean(row.fee),
    keyRequired: Boolean(row.key_required),
    purchaseRequired: Boolean(row.purchase_required),
    genderNeutral: row.gender_neutral === null ? null : Boolean(row.gender_neutral),
    lastVerified: row.last_verified ? String(row.last_verified).slice(0, 10) : null,
    confidence: Number(row.confidence),
    notes: (row.notes as string | null) ?? null,
    sourceRefs: row.source_refs as SourceRef[]
  };
}
