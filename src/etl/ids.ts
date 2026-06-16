import { createHash } from "node:crypto";

export function stableId(source: string, sourceId: string): string {
  return `${slug(source)}-${createHash("sha1").update(sourceId).digest("hex").slice(0, 12)}`;
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
