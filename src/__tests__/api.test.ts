import { describe, expect, it } from "vitest";
import { fetchRestrooms } from "../client/api";

describe("fetchRestrooms", () => {
  it("omits false filters from the query string", async () => {
    const originalFetch = global.fetch;
    const calls: string[] = [];
    global.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    try {
      await fetchRestrooms({
        lat: 34.0522,
        lng: -118.2437,
        radiusMeters: 35_000,
        openNow: false,
        accessible: false,
        free: false
      });
    } finally {
      global.fetch = originalFetch;
    }

    expect(calls[0]).toContain("lat=34.0522");
    expect(calls[0]).not.toContain("openNow=false");
    expect(calls[0]).not.toContain("accessible=false");
    expect(calls[0]).not.toContain("free=false");
  });
});
