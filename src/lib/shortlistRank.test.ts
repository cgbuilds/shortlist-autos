import { describe, expect, it } from "vitest";
import { SAMPLE_VEHICLES } from "../data/vehicles";
import { applyRankedPicks, listingToRankRecord, parseRankedPicks, scoringSystemPrompt } from "./shortlistRank";
import { DEFAULT_MATRIX } from "./types";

describe("shortlist rank prompt", () => {
  it("tells the model to use seller_comments and Carfax flags and keep 7–10 cars", () => {
    const prompt = scoringSystemPrompt(DEFAULT_MATRIX);
    expect(prompt).toMatch(/seller_comments/);
    expect(prompt).toMatch(/carfax_1_owner/);
    expect(prompt).toMatch(/7–10|7-10/);
    expect(prompt).toMatch(/Tampa/);
  });

  it("puts seller comments and owner flags on the JSON row", () => {
    const row = listingToRankRecord({
      ...SAMPLE_VEHICLES[0],
      carfaxOneOwner: true,
      carfaxCleanTitle: true,
      sellerComments: "One owner, garage kept.",
      options: ["AWD"],
    });
    expect(row.carfax_1_owner).toBe(true);
    expect(row.seller_comments).toMatch(/garage/);
  });

  it("keeps 7–10 ranked ids and can pad if the model returns too few", () => {
    const pool = SAMPLE_VEHICLES.slice(0, 12).map((listing) => ({
      listing,
      grade: { total: 70, band: "ok" as const, mustHaveFailed: false, why: "local" },
    }));
    const picks = parseRankedPicks(
      {
        cars: [
          { id: pool[2].listing.id, score: 91, insight: "Low miles and one-owner note." },
          { id: pool[0].listing.id, score: 88, insight: "Fits the budget." },
          { id: "nope", score: 99, insight: "ignore" },
        ],
      },
      new Set(pool.map((row) => row.listing.id)),
    );
    expect(picks).toHaveLength(2);
    const ranked = applyRankedPicks(pool, picks);
    expect(ranked[0].listing.id).toBe(pool[2].listing.id);
    expect(ranked[0].grade.total).toBe(91);
    expect(ranked.length).toBeGreaterThanOrEqual(7);
    expect(ranked.length).toBeLessThanOrEqual(10);
  });
});
