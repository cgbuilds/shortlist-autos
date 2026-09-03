import { formatMustHaves } from "@/lib/chat";
import { gradeFromModelScore } from "@/lib/grade";
import type { MustHaveMatrix, RankedRow, Vehicle } from "@/lib/types";
import { SHORTLIST_KEEP_MAX, SHORTLIST_KEEP_MIN, SHORTLIST_POOL } from "@/lib/types";

export type RankedPick = { id: string; score: number; insight: string };

export function scoringSystemPrompt(matrix: MustHaveMatrix): string {
  return `You are the scoring agent for Shortlist Autos, a used-car shortlist.

SHOPPER BASE PREFERENCES (this is the narrow intent; inventory was already fetched with a wider net):
${formatMustHaves(matrix)}
${JSON.stringify(matrix)}

TASK
1. You receive JSON of up to ${SHORTLIST_POOL} live listings. Each row has facts plus MarketCheck extras when present: seller_comments, options, features, carfax_1_owner, carfax_clean_title, colors, days on market, certified.
2. Choose the best ${SHORTLIST_KEEP_MIN}–${SHORTLIST_KEEP_MAX} cars for THIS shopper. Prefer ${SHORTLIST_KEEP_MAX} when that many are good. Never return more than ${SHORTLIST_KEEP_MAX}. If fewer than ${SHORTLIST_KEEP_MIN} are reasonable, return only the reasonable ones.
3. Score each chosen car from 64 to 96:
   - Fit to the base prefs (body, budget, year, miles, AWD, seats, fuel preference)
   - Value versus the rest of this set (price vs year and miles)
   - Condition signals: one-owner flag, clean-title flag, miles-per-year, seller_comments (cleaner / garage / accident language)
   - Reliability of the make
   Missing seller_comments is normal — do not punish it. Do not invent accidents, CarFax, or owners. Only use flags and comments that are in the JSON.
4. insight: 1–2 sentences. Cite a real field (price, miles, one-owner, a phrase from seller_comments).

Return ONLY JSON:
{"cars":[{"id":"<listing id>","score":84,"insight":"..."}]}`;
}

export function listingToRankRecord(listing: Vehicle) {
  const age = Math.max(1, new Date().getFullYear() - listing.year + 1);
  return {
    id: listing.id,
    year: listing.year,
    make: listing.make,
    model: listing.model,
    trim: listing.trim,
    price: listing.price,
    miles: listing.miles,
    miles_per_year: Math.round(listing.miles / age),
    city: listing.city,
    dealer: listing.dealer,
    body: listing.body,
    drivetrain: listing.drivetrain,
    seats: listing.seats,
    mpg: listing.mpg,
    fuel: listing.fuel,
    photo: Boolean(listing.photo),
    listing_url: listing.listingUrl ?? null,
    carfax_1_owner: listing.carfaxOneOwner === true,
    carfax_clean_title: listing.carfaxCleanTitle === true,
    certified: listing.certified === true,
    exterior_color: listing.exteriorColor ?? null,
    interior_color: listing.interiorColor ?? null,
    days_on_market: listing.daysOnMarket ?? null,
    dist_miles: listing.distMiles ?? null,
    options: (listing.options ?? []).slice(0, 20),
    features: (listing.features ?? []).slice(0, 20),
    seller_comments: listing.sellerComments ?? "",
  };
}

export function parseRankedPicks(raw: unknown, allowedIds: Set<string>): RankedPick[] {
  const cars = raw && typeof raw === "object" && Array.isArray((raw as { cars?: unknown }).cars) ? (raw as { cars: unknown[] }).cars : [];
  const out: RankedPick[] = [];
  const seen = new Set<string>();
  for (const item of cars) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { id?: unknown; score?: unknown; insight?: unknown };
    if (typeof rec.id !== "string" || !allowedIds.has(rec.id) || seen.has(rec.id)) continue;
    const score = typeof rec.score === "number" && Number.isFinite(rec.score) ? rec.score : Number(rec.score);
    if (!Number.isFinite(score)) continue;
    seen.add(rec.id);
    out.push({
      id: rec.id,
      score,
      insight: typeof rec.insight === "string" ? rec.insight.trim().slice(0, 400) : "",
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, SHORTLIST_KEEP_MAX);
}

export function applyRankedPicks(pool: RankedRow[], picks: RankedPick[]): RankedRow[] {
  const byId = new Map(pool.map((row) => [row.listing.id, row]));
  const chosen: RankedRow[] = [];
  for (const pick of picks) {
    const row = byId.get(pick.id);
    if (!row) continue;
    chosen.push({
      listing: row.listing,
      grade: gradeFromModelScore(pick.score, pick.insight || row.grade.why),
    });
  }
  if (chosen.length >= SHORTLIST_KEEP_MIN || chosen.length >= pool.length) {
    return chosen.slice(0, SHORTLIST_KEEP_MAX);
  }
  const used = new Set(chosen.map((row) => row.listing.id));
  for (const row of pool) {
    if (used.has(row.listing.id)) continue;
    chosen.push(row);
    if (chosen.length >= SHORTLIST_KEEP_MIN) break;
  }
  return chosen.slice(0, SHORTLIST_KEEP_MAX);
}
