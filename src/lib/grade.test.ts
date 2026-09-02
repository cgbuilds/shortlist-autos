import { describe, expect, it } from "vitest";
import { SAMPLE_VEHICLES } from "../data/vehicles";
import { chatReply, parseMustHaves } from "./chat";
import { searchVehicles } from "./grade";
import { vehiclePhoto } from "./format";
import { BROWSE_MATRIX, DEFAULT_MATRIX } from "./types";

describe("vehiclePhoto", () => {
  it("uses /cars/{id}.jpg when no photo field is set", () => {
    expect(vehiclePhoto(SAMPLE_VEHICLES[0])).toBe(`/cars/${SAMPLE_VEHICLES[0].id}.jpg`);
  });
});

describe("parseMustHaves", () => {
  it("extracts Tampa SUV budget AWD CarPlay like the live chat API", () => {
    const matrix = parseMustHaves("reliable SUV under 30k with CarPlay and AWD near Tampa", DEFAULT_MATRIX);
    expect(matrix.searchArea).toBe("Tampa, FL");
    expect(matrix.body).toBe("suv");
    expect(matrix.maxPrice).toBe(30000);
    expect(matrix.awd).toBe(true);
    expect(matrix.carplay).toBe(true);
    expect(matrix.maxMiles).toBe(80000);
    expect(matrix.minYear).toBe(2018);
  });

  it("treats 3-row and soft plug-in as a preference, not a required PHEV", () => {
    const matrix = parseMustHaves(
      "Looking for a 3 row suv, plugin capable ideally not strictly, 2023 or newer, price of $45K, awd",
      BROWSE_MATRIX,
    );
    expect(matrix.body).toBe("suv");
    expect(matrix.minSeats).toBe(7);
    expect(matrix.minYear).toBe(2023);
    expect(matrix.maxPrice).toBe(45000);
    expect(matrix.awd).toBe(true);
    expect(matrix.fuel).toBeNull();
    expect(matrix.preferFuel).toBe("plugin-hybrid");
  });
});

describe("searchVehicles", () => {
  it("keeps the sample Tampa RAV4 and drops FWD / over-budget SUVs for a tight matrix", () => {
    const matrix = chatReply("reliable SUV under 30k with CarPlay and AWD near Tampa", DEFAULT_MATRIX).matrix;
    const { results, listings, totalMatched } = searchVehicles(SAMPLE_VEHICLES, matrix);
    const ids = results.map((row) => row.listing.id);
    expect(listings).toHaveLength(16);
    expect(ids).toContain("rav4-21-tampa");
    expect(ids).toContain("cx5-20-lutz");
    expect(ids).not.toContain("crv-19-brandon");
    expect(ids).not.toContain("telluride-22-riverview");
    expect(ids).not.toContain("equinox-17-valrico");
    expect(totalMatched).toBe(results.length);
    expect(results.length).toBeGreaterThan(1);
    const scores = results.map((row) => row.grade.total);
    expect(Math.max(...scores)).toBeLessThanOrEqual(96);
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  it("does not drop live cars for CarPlay when options are unknown", () => {
    const listing = SAMPLE_VEHICLES[0];
    const live = { ...listing, carplay: false, featuresUnknown: true };
    const matrix = { ...DEFAULT_MATRIX, carplay: true, body: listing.body, maxPrice: listing.price + 1000 };
    expect(searchVehicles([live], matrix).results).toHaveLength(1);
  });

  it("browse impression matrix keeps recent low-mile sample cars only", () => {
    const { results } = searchVehicles(SAMPLE_VEHICLES, BROWSE_MATRIX);
    const ids = results.map((row) => row.listing.id);
    expect(ids).toContain("civic-24-tampa");
    expect(ids).toContain("tucson-hyb-23-tampa");
    expect(ids).not.toContain("equinox-17-valrico");
    expect(ids).not.toContain("outback-18-brandon");
    expect(results[0].listing.id).toBe("civic-24-tampa");
  });

  it("spreads scores so matching cars are not all 100", () => {
    const cheap = { ...SAMPLE_VEHICLES[0], id: "cheap", price: 18000, miles: 12000, year: 2024, mpg: 40, fuel: "hybrid" as const, make: "Toyota", seats: 5 };
    const spendy = { ...SAMPLE_VEHICLES[0], id: "spendy", price: 34000, miles: 68000, year: 2019, mpg: 22, fuel: "gas" as const, make: "Jeep", seats: 5 };
    const { results } = searchVehicles([cheap, spendy], {
      ...DEFAULT_MATRIX,
      maxPrice: 35000,
      maxMiles: 80000,
      minYear: 2018,
      awd: false,
      body: cheap.body,
    });
    expect(results).toHaveLength(2);
    expect(results[0].listing.id).toBe("cheap");
    expect(results[0].grade.total).toBeGreaterThan(results[1].grade.total);
    expect(results[0].grade.total).toBeLessThanOrEqual(96);
    expect(results.every((row) => row.grade.total === 100)).toBe(false);
  });
});
