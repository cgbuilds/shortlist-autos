import { describe, expect, it } from "vitest";
import { loadInventory, mapBody, mapDrivetrain, mapLiveListing } from "./inventory";
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
});

describe("loadInventory", () => {
  it("returns the sample Tampa set when no live key is set", async () => {
    const result = await loadInventory({ matrix: BROWSE_MATRIX, mode: "browse", here: TAMPA });
    expect(result.source).toBe("sample");
    expect(result.listings.length).toBeGreaterThan(5);
    expect(result.origin.label).toBe("Tampa, FL");
  });
});
