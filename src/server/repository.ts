import { config } from "./config";
import { createPostgresRepository } from "./repositories/postgresRepository";
import { createSqliteRepository } from "./repositories/sqliteRepository";
import type { AppStats, RestroomQuery, RestroomRecord, RestroomWithStatus } from "../shared/types";

export interface RestroomRepository {
  list(query: RestroomQuery): Promise<RestroomWithStatus[]>;
  getById(id: string): Promise<RestroomWithStatus | null>;
  replaceAll(records: RestroomRecord[]): Promise<void>;
  stats(): Promise<AppStats>;
  importReview(): Promise<RestroomWithStatus[]>;
  close(): Promise<void>;
}

export async function createRepository(): Promise<RestroomRepository> {
  if (config.databaseUrl?.startsWith("postgres://") || config.databaseUrl?.startsWith("postgresql://")) {
    return createPostgresRepository(config.databaseUrl);
  }
  return createSqliteRepository(config.sqlitePath);
}
