import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { sampleRestrooms } from "../etl/sampleData";
import { sqliteRepositoryFromDb } from "../server/repositories/sqliteRepository";

describe("sqlite repository", () => {
  it("imports and queries nearby restrooms", async () => {
    const db = new Database(":memory:");
    const repo = sqliteRepositoryFromDb(db);
    await repo.replaceAll(sampleRestrooms);
    const records = await repo.list({ lat: 33.73, lng: -118.28, radiusMeters: 10_000 });
    expect(records.length).toBeGreaterThan(0);
    expect(records[0].distanceMeters).not.toBeNull();
    await repo.close();
  });
});
