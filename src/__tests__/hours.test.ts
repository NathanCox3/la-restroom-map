import { describe, expect, it } from "vitest";
import { computeOpenStatus } from "../shared/hours";

describe("computeOpenStatus", () => {
  it("returns unknown when hours are missing", () => {
    expect(computeOpenStatus(null)).toBe("unknown");
  });

  it("handles 24/7", () => {
    expect(computeOpenStatus("24/7")).toBe("open");
  });

  it("handles same-day OSM ranges in Pacific time", () => {
    const tuesdayNoonPacific = new Date("2026-06-16T19:00:00.000Z");
    expect(computeOpenStatus("Mo-Fr 08:00-17:00", tuesdayNoonPacific)).toBe("open");
    expect(computeOpenStatus("Mo-Fr 20:00-22:00", tuesdayNoonPacific)).toBe("closed");
  });

  it("handles overnight ranges", () => {
    const fridayLatePacific = new Date("2026-06-20T06:30:00.000Z");
    expect(computeOpenStatus("Fr-Sa 20:00-03:00", fridayLatePacific)).toBe("open");
  });
});
