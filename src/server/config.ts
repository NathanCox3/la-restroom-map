import path from "node:path";

export const config = {
  apiPort: Number(process.env.API_PORT ?? 8787),
  apiHost: process.env.API_HOST ?? "127.0.0.1",
  sqlitePath: path.resolve(process.cwd(), process.env.SQLITE_PATH ?? "./data/restrooms.sqlite"),
  databaseUrl: process.env.DATABASE_URL
};
