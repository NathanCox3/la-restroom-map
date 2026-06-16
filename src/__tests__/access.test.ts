import { describe, expect, it } from "vitest";
import { normalizeAccess, normalizeWheelchair, parseBooleanTag } from "../shared/access";

describe("access helpers", () => {
  it("normalizes public and restricted access", () => {
    expect(normalizeAccess("yes")).toBe("public");
    expect(normalizeAccess("customers")).toBe("customers");
    expect(normalizeAccess("private")).toBe("restricted");
  });

  it("normalizes wheelchair tags", () => {
    expect(normalizeWheelchair("yes")).toBe("yes");
    expect(normalizeWheelchair("limited")).toBe("limited");
    expect(normalizeWheelchair("maybe")).toBe("unknown");
  });

  it("parses boolean-like tags", () => {
    expect(parseBooleanTag("yes")).toBe(true);
    expect(parseBooleanTag("no")).toBe(false);
    expect(parseBooleanTag("unknown")).toBeNull();
  });
});
