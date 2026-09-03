import { describe, expect, it } from "vitest";
import { SAMPLE_VEHICLES } from "../data/vehicles";
import { localShopperLens, searchVehicles } from "./grade";
import { matrixFromIntake, setPrefIndex, togglePref, widenForSearch } from "./intake";
import { DEFAULT_MATRIX } from "./types";

describe("intake prefs", () => {
  it("taps defaults: SUV, $45k, AWD, 3-row", () => {
    let state = {};
    state = togglePref(state, "body");
    state = togglePref(state, "price");
    state = togglePref(state, "drive");
    state = togglePref(state, "seats");
    const matrix = matrixFromIntake(state, "Tampa, FL");
    expect(matrix.body).toBe("suv");
    expect(matrix.maxPrice).toBe(45000);
    expect(matrix.awd).toBe(true);
    expect(matrix.minSeats).toBe(7);
  });

  it("hold-scrub on type picks sedan instead of SUV", () => {
    const state = setPrefIndex({}, "body", 1);
    expect(matrixFromIntake(state, "Tampa, FL").body).toBe("sedan");
  });

  it("year default is 2023+", () => {
    const state = togglePref({}, "year");
    expect(matrixFromIntake(state, "Tampa, FL").minYear).toBe(2023);
  });

  it("clears a pref when tapped again", () => {
    const on = togglePref({}, "drive");
    const off = togglePref(on, "drive");
    expect(matrixFromIntake(off, "Tampa, FL").awd).toBe(false);
  });
});

describe("widenForSearch", () => {
  it("keeps body and loosens price, year, AWD so the net is wider than the score base", () => {
    const tight = matrixFromIntake(togglePref(togglePref({}, "body"), "price"), "Tampa, FL");
    tight.awd = true;
    tight.minYear = 2023;
    tight.maxMiles = 70000;
    const wide = widenForSearch(tight);
    expect(wide.body).toBe("suv");
    expect(wide.maxPrice).toBeGreaterThan(tight.maxPrice ?? 0);
    expect(wide.minYear).toBe(2021);
    expect(wide.awd).toBe(false);
    expect(wide.maxMiles).toBeGreaterThan(70000);
  });
});

describe("shopper lens", () => {
  it("boosts a low-miles Toyota as a careful-use extra", () => {
    const gentle = { ...SAMPLE_VEHICLES[0], year: 2024, miles: 8000, make: "Toyota", photo: "/x.jpg" };
    const lens = localShopperLens(gentle);
    expect(lens.bump).toBeGreaterThan(0);
    expect(lens.extra).toMatch(/one-owner|carefully used|age well/i);
  });

  it("includes a slightly over-budget SUV when the filter is widened", () => {
    const base = { ...DEFAULT_MATRIX, maxPrice: 30000, awd: true, minYear: 2018 };
    const listing = {
      ...SAMPLE_VEHICLES[0],
      id: "wide-suv",
      body: "suv" as const,
      price: 33000,
      drivetrain: "fwd" as const,
      drivetrainUnknown: false,
    };
    expect(searchVehicles([listing], base).results).toHaveLength(0);
    expect(searchVehicles([listing], base, widenForSearch(base)).results.length).toBe(1);
  });
});
