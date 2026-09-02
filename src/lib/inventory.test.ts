import { describe, expect, it } from "vitest";
import { loadInventory, mapBody, mapDrivetrain, mapFuel, mapLiveListing, applyLocation, applyRangeFilters, marketcheckPowertrain } from "./inventory";
import { originFromCoords, TAMPA } from "./location";
import { BROWSE_MATRIX, browseMinYear } from "./types";

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

describe("mapLiveListing", () => {
  it("treats Sport Utility as an SUV and 4-wheel drive as 4WD", () => {
    expect(mapBody("Sport Utility Vehicle")).toBe("suv");
    expect(mapDrivetrain("4-Wheel Drive")).toBe("4wd");
    expect(mapDrivetrain("All-Wheel Drive")).toBe("awd");
  });

  it("maps a MarketCheck-shaped listing", () => {
    const car = mapLiveListing({
      id: "mc1",
      price: 21900,
      miles: 41000,
      heading: "2021 Honda CR-V EX",
      build: { year: 2021, make: "Honda", model: "CR-V", body_type: "Sport Utility", drivetrain: "All Wheel Drive" },
      dealer: { city: "Tampa", state: "FL", zip: "33607", latitude: "27.95", longitude: "-82.46" },
    });
    expect(car?.body).toBe("suv");
    expect(car?.drivetrain).toBe("awd");
    expect(car?.featuresUnknown).toBe(true);
  });

  it("maps Electric / Unleaded to plugin-hybrid", () => {
    expect(mapFuel("Electric / Unleaded")).toBe("plugin-hybrid");
    expect(mapFuel("Electric / Premium Unleaded")).toBe("plugin-hybrid");
    expect(mapFuel("Unleaded", "PHEV")).toBe("plugin-hybrid");
    expect(mapFuel("Hybrid")).toBe("hybrid");
  });
});

describe("applyLocation", () => {
  it("does not send zip and lat/lng together", () => {
    const withGps = new URLSearchParams();
    applyLocation(withGps, TAMPA, { lat: 27.95, lng: -82.46 });
    expect(withGps.has("zip")).toBe(false);
    expect(withGps.get("latitude")).toBe("27.95");
    const withZip = new URLSearchParams();
    applyLocation(withZip, TAMPA, null);
    expect(withZip.get("zip")).toBe(TAMPA.zip);
    expect(withZip.has("latitude")).toBe(false);
  });
});

describe("loadInventory", () => {
  it("returns the sample Tampa set when no live key is set", async () => {
    const prev = process.env.MARKETCHECK_API_KEY;
    delete process.env.MARKETCHECK_API_KEY;
    try {
      const result = await loadInventory({ matrix: BROWSE_MATRIX, mode: "browse", here: TAMPA });
      expect(result.source).toBe("sample");
      expect(result.listings.length).toBeGreaterThan(5);
      expect(result.origin.label).toBe("Tampa, FL");
    } finally {
      if (prev === undefined) delete process.env.MARKETCHECK_API_KEY;
      else process.env.MARKETCHECK_API_KEY = prev;
    }
  });
});

describe("browse impression defaults", () => {
  it("uses the last three model years under $45k and 70k miles", () => {
    expect(browseMinYear(new Date("2026-09-02T00:00:00Z"))).toBe(2023);
    expect(BROWSE_MATRIX.maxPrice).toBe(45000);
    expect(BROWSE_MATRIX.maxMiles).toBe(70000);
    expect(BROWSE_MATRIX.minYear).toBe(browseMinYear());
    expect(BROWSE_MATRIX.body).toBeNull();
  });
});

describe("MarketCheck powertrain filters", () => {
  it("asks for PHEV when the must-have is plug-in hybrid", () => {
    expect(marketcheckPowertrain("plugin-hybrid")).toBe("PHEV");
    expect(marketcheckPowertrain("hybrid")).toBe("HEV,PHEV");
    expect(marketcheckPowertrain("ev")).toBe("BEV");
    const params = new URLSearchParams();
    applyRangeFilters(params, {
      ...BROWSE_MATRIX,
      body: "suv",
      fuel: "plugin-hybrid",
    });
    expect(params.get("body_type")).toBe("SUV");
    expect(params.get("powertrain_type")).toBe("PHEV");
    expect(params.get("price_range")).toBe("1-45000");
  });
});
