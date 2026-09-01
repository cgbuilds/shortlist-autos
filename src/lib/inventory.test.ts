import { describe, expect, it } from "vitest";
import { loadInventory } from "./inventory";
import { originFromCoords, TAMPA } from "./location";
import { BROWSE_MATRIX } from "./types";

describe("originFromCoords", () => {
  it("uses Tampa when there is no location", () => {
    expect(originFromCoords(null).label).toBe("Tampa, FL");
  });

  it("falls back to Tampa when the phone is far from the sample metros", () => {
    expect(originFromCoords({ lat: 40.7128, lng: -74.006 }).label).toBe("Tampa, FL");
  });

  it("keeps a nearby Tampa-metro point", () => {
    const origin = originFromCoords({ lat: 27.95, lng: -82.46 });
    expect(origin.label).toBe("Tampa, FL");
  });
});

describe("loadInventory", () => {
  it("returns the sample Tampa set when no live key is set", async () => {
    const result = await loadInventory({ matrix: BROWSE_MATRIX, mode: "browse", here: TAMPA });
    expect(result.source).toBe("sample");
    expect(result.listings.length).toBeGreaterThan(5);
    expect(result.origin.label).toBe("Tampa, FL");
  });
});
