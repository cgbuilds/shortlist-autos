import { describe, expect, it } from "vitest";
import { SAMPLE_VEHICLES } from "../data/vehicles";
import { chatReply, parseMustHaves } from "./chat";
import { searchVehicles } from "./grade";
import { vehiclePhoto } from "./format";
import { DEFAULT_MATRIX } from "./types";

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
    expect(results.every((row) => row.grade.band === "superb")).toBe(true);
  });
});
