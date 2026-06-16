import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { dedupeRestrooms } from "./dedupe";
import { toGeoJson } from "./geojson";
import { sampleRestrooms } from "./sampleData";
import { sourceAdapters } from "./sources/registry";
import { createRepository } from "../server/repository";
import type { RestroomRecord } from "../shared/types";

async function main() {
  const args = new Set(process.argv.slice(2));
  const useSample = args.has("--sample");
  const useDeepSources = args.has("--deep");
  const warnings: string[] = [];
  let records: RestroomRecord[] = [];

  if (useSample) {
    records = sampleRestrooms;
  } else {
    for (const adapter of sourceAdapters.filter((adapter) => adapter.enabledByDefault || (useDeepSources && adapter.name === "OpenStreetMap Candidate Host"))) {
      try {
        const result = await adapter.fetchRecords();
        records.push(...result.records);
        warnings.push(...result.warnings);
        console.log(`${result.sourceName}: ${result.records.length} records`);
      } catch (error) {
        warnings.push(`${adapter.name} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (records.length === 0) {
      warnings.push("No live records imported; falling back to small sample data.");
      records = sampleRestrooms;
    }
  }

  const deduped = dedupeRestrooms(records);
  const repo = await createRepository();
  await repo.replaceAll(deduped);
  await repo.close();

  await fs.mkdir(path.resolve(process.cwd(), "data"), { recursive: true });
  await fs.writeFile(
    path.resolve(process.cwd(), "data/restrooms.latest.geojson"),
    `${JSON.stringify(toGeoJson(deduped), null, 2)}\n`,
    "utf8"
  );

  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }
  console.log(`Imported ${deduped.length} deduped restroom records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
