import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { config } from "./config";
import { createRepository } from "./repository";

const booleanQueryParam = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return undefined;
}, z.boolean().optional());

const querySchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusMeters: z.coerce.number().min(100).max(120_000).optional(),
  bbox: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const parts = value.split(",").map(Number);
      return parts.length === 4 && parts.every(Number.isFinite) ? (parts as [number, number, number, number]) : undefined;
    }),
  openNow: booleanQueryParam,
  accessible: booleanQueryParam,
  free: booleanQueryParam,
  limit: z.coerce.number().min(1).max(1000).optional()
});

async function start() {
  const repo = await createRepository();
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, storage: config.databaseUrl ? "postgis" : "sqlite" });
  });

  app.get("/api/restrooms", async (request, response, next) => {
    try {
      const parsed = querySchema.parse(request.query);
      response.json(await repo.list(parsed));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/restrooms/:id", async (request, response, next) => {
    try {
      const record = await repo.getById(request.params.id);
      if (!record) {
        response.status(404).json({ error: "Restroom not found" });
        return;
      }
      response.json(record);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/stats", async (_request, response, next) => {
    try {
      response.json(await repo.stats());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/import-review", async (_request, response, next) => {
    try {
      response.json(await repo.importReview());
    } catch (error) {
      next(error);
    }
  });

  const distPath = path.resolve(process.cwd(), "dist");
  if (fs.existsSync(path.join(distPath, "index.html"))) {
    app.use(express.static(distPath));
    app.get("*", (request, response, next) => {
      if (request.path.startsWith("/api/")) {
        next();
        return;
      }
      response.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    response.status(400).json({ error: message });
  });

  const server = app.listen(config.apiPort, config.apiHost, () => {
    console.log(`Server listening on http://${config.apiHost}:${config.apiPort}`);
  });

  const shutdown = async () => {
    server.close();
    await repo.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
