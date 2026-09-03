import type { Grade, GradeBand, MustHaveMatrix, RankedRow, Vehicle } from "@/lib/types";

function isAwd(listing: Vehicle): boolean {
  return listing.drivetrain === "awd" || listing.drivetrain === "4wd";
}

function money(n: number): string {
  return `$${n.toLocaleString()}`;
}

export function hasMustHaves(matrix: MustHaveMatrix): boolean {
  return Boolean(
    matrix.body ||
      matrix.maxPrice != null ||
      matrix.maxMiles != null ||
      matrix.minYear != null ||
      matrix.awd ||
      matrix.minSeats > 5 ||
      matrix.carplay ||
      matrix.backupCamera ||
      matrix.tow ||
      matrix.fuel,
  );
}

/** Default first-look filters only — not a user-confirmed shortlist. */
export function isImpressionMatrix(matrix: MustHaveMatrix): boolean {
  return (
    !matrix.body &&
    !matrix.awd &&
    !matrix.carplay &&
    !matrix.backupCamera &&
    !matrix.tow &&
    !matrix.fuel &&
    !matrix.preferFuel &&
    matrix.minSeats <= 5 &&
    matrix.maxPrice != null &&
    matrix.maxMiles != null &&
    matrix.minYear != null
  );
}

function bodyMatches(listing: Vehicle, matrix: MustHaveMatrix): boolean {
  if (!matrix.body) return true;
  if (listing.body === matrix.body) return true;
  if (matrix.body === "suv" && listing.body === "crossover") return true;
  if (matrix.body === "crossover" && listing.body === "suv") return true;
  return false;
}

function fuelMatches(listing: Vehicle, matrix: MustHaveMatrix): boolean {
  if (!matrix.fuel) return true;
  if (listing.fuel === matrix.fuel) return true;
  if (matrix.fuel === "plugin-hybrid" && listing.fuel === "hybrid") return true;
  if (matrix.fuel === "hybrid" && listing.fuel === "plugin-hybrid") return true;
  return false;
}

const THREE_ROW_RE =
  /\b(telluride|palisade|highlander|grand highlander|pilot|pathfinder|cx-?90|cx-?9|atlas|explorer|traverse|sequoia|armada|durango|wagoneer|expedition|suburban|tahoe|yukon|carnival|odyssey|sienna|pacifica|ascent|pilot|grand cherokee l)\b/i;

export function likelyThreeRow(listing: Vehicle): boolean {
  if (listing.seats >= 7) return true;
  return THREE_ROW_RE.test(`${listing.model} ${listing.trim}`);
}

function seatsMatch(listing: Vehicle, matrix: MustHaveMatrix): boolean {
  if (matrix.minSeats <= 5) return true;
  if (listing.seats >= matrix.minSeats) return true;
  return matrix.minSeats >= 7 && likelyThreeRow(listing);
}

export function mustHaveFailed(listing: Vehicle, matrix: MustHaveMatrix): boolean {
  if (!bodyMatches(listing, matrix)) return true;
  if (matrix.maxPrice != null && listing.price > matrix.maxPrice) return true;
  if (matrix.maxMiles != null && listing.miles > matrix.maxMiles) return true;
  if (matrix.minYear != null && listing.year < matrix.minYear) return true;
  if (matrix.awd && !listing.drivetrainUnknown && !isAwd(listing)) return true;
  if (!seatsMatch(listing, matrix)) return true;
  if (!listing.featuresUnknown) {
    if (matrix.carplay && !listing.carplay) return true;
    if (matrix.backupCamera && !listing.backupCamera) return true;
    if (matrix.tow && !listing.tow) return true;
  }
  if (!fuelMatches(listing, matrix)) return true;
  return false;
}

function bandFor(total: number, failed: boolean): GradeBand {
  if (failed) return "miss";
  if (total >= 92) return "superb";
  if (total >= 84) return "excellent";
  if (total >= 72) return "good";
  return "ok";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function reliabilityPoints(make: string): number {
  const m = make.toLowerCase();
  if (/\b(toyota|honda|lexus|mazda)\b/.test(m)) return 8;
  if (/\b(subaru|hyundai|kia|genesis)\b/.test(m)) return 6;
  if (/\b(volvo|bmw|audi|acura)\b/.test(m)) return 5;
  if (/\b(ford|chevrolet|chevy|buick|volkswagen|vw)\b/.test(m)) return 4;
  if (/\b(jeep|dodge|chrysler|ram|nissan|mitsubishi)\b/.test(m)) return 2;
  return 4;
}

function whyText(listing: Vehicle, matrix: MustHaveMatrix, failed: boolean): string {
  const title = `${listing.year} ${listing.make} ${listing.model}${listing.trim ? ` ${listing.trim}` : ""}`;
  const facts = `${title} in ${listing.city} is listed at ${money(listing.price)} with ${listing.miles.toLocaleString()} miles.`;
  if (!hasMustHaves(matrix) || isImpressionMatrix(matrix)) {
    return `A newer, lower-mile listing nearby. ${facts} Set must-haves in Chat to search and grade against what you actually need.`;
  }
  const lead = failed
    ? "This one misses something you called a must-have."
    : "This one clears the must-haves; the score is how it stacks up on value, miles, MPG, and extras.";
  const works: string[] = [];
  if (matrix.maxPrice != null && listing.price <= matrix.maxPrice * 0.88) {
    works.push(`under budget at ${money(listing.price)}`);
  }
  if (matrix.maxMiles != null && listing.miles <= matrix.maxMiles * 0.7) {
    works.push("lower miles than you asked");
  }
  if (listing.mpg && listing.mpg >= 28) works.push(`${listing.mpg} mpg`);
  if (matrix.preferFuel === "plugin-hybrid" && listing.fuel === "plugin-hybrid") works.push("plug-in");
  if (matrix.preferFuel === "plugin-hybrid" && listing.fuel === "hybrid") works.push("hybrid (not plug-in)");
  if (matrix.awd && listing.drivetrain === "awd") works.push("AWD");
  if (matrix.awd && listing.drivetrain === "4wd") works.push("4WD");
  if (matrix.minSeats >= 7 && likelyThreeRow(listing)) works.push(`${listing.seats >= 7 ? listing.seats : "3-row"} seats`);
  if (listing.seats >= 8) works.push(`${listing.seats} seats`);
  if (matrix.carplay && listing.carplay) works.push("CarPlay");
  const workLine = works.length ? ` What works: ${works.join(", ")}.` : "";
  const trade: string[] = [];
  if (matrix.preferFuel === "plugin-hybrid" && listing.fuel === "gas") trade.push("gas only, not plug-in");
  if (matrix.awd && !isAwd(listing)) trade.push("not AWD/4WD");
  if (matrix.minSeats >= 7 && listing.seats < 7 && !likelyThreeRow(listing)) trade.push("not clearly 3-row");
  if (listing.mpg != null && listing.mpg < 24) trade.push(`${listing.mpg} mpg is ordinary`);
  if (reliabilityPoints(listing.make) <= 2) trade.push("reliability is a weaker bet than Toyota/Honda");
  const tradeLine = failed
    ? " Tradeoffs: it fails a must-have, so it stays off the ranked list."
    : trade.length
      ? ` Tradeoffs: ${trade.join("; ")}.`
      : " Tradeoffs: nothing scored looks like a serious problem.";
  return `${lead} ${facts}${workLine}${tradeLine}`;
}

/** Unscaled 0–100 mix of value, recency, MPG, fuel preference, seats, reliability. */
export function rawFitScore(listing: Vehicle, matrix: MustHaveMatrix): number {
  let total = 48;
  if (matrix.maxPrice) {
    total += 12 * clamp(1 - listing.price / matrix.maxPrice, 0, 1);
  }
  const mileCap = matrix.maxMiles ?? 80000;
  total += 10 * clamp(1 - listing.miles / Math.max(mileCap, 1), 0, 1);
  const minY = matrix.minYear ?? new Date().getFullYear() - 8;
  const span = Math.max(1, new Date().getFullYear() + 1 - minY);
  total += 8 * clamp((listing.year - minY) / span, 0, 1);
  if (listing.mpg != null) total += 8 * clamp((listing.mpg - 18) / 22, 0, 1);
  else if (listing.fuel === "plugin-hybrid" || listing.fuel === "ev") total += 5;
  else if (listing.fuel === "hybrid") total += 4;
  const wantPlugin = matrix.preferFuel === "plugin-hybrid" || matrix.fuel === "plugin-hybrid";
  const wantHybrid = matrix.preferFuel === "hybrid" || matrix.fuel === "hybrid";
  if (wantPlugin) {
    if (listing.fuel === "plugin-hybrid") total += 8;
    else if (listing.fuel === "hybrid") total += 5;
    else if (listing.fuel === "ev") total += 4;
  } else if (wantHybrid) {
    if (listing.fuel === "hybrid" || listing.fuel === "plugin-hybrid") total += 6;
  }
  if (matrix.minSeats >= 7) {
    if (listing.seats >= 8) total += 8;
    else if (likelyThreeRow(listing)) total += 6;
  } else if (likelyThreeRow(listing)) {
    total += 2;
  }
  total += reliabilityPoints(listing.make);
  if (listing.photo) total += 2;
  if (matrix.awd && isAwd(listing)) total += 6;
  if (matrix.carplay && listing.carplay) total += 2;
  const age = Math.max(1, new Date().getFullYear() - listing.year + 1);
  const milesPerYear = listing.miles / age;
  total += 8 * clamp(1 - (milesPerYear - 6000) / 14000, 0, 1);
  if (matrix.maxPrice) {
    const value = clamp(1 - listing.price / matrix.maxPrice, 0, 1) * clamp(1 - listing.miles / Math.max(mileCap, 1), 0, 1);
    total += 6 * value;
  }
  return clamp(total, 0, 100);
}

function scoreListing(listing: Vehicle, matrix: MustHaveMatrix, failed: boolean): number {
  if (failed) return 40;
  return Math.round(rawFitScore(listing, matrix));
}

function stretchScores(rows: RankedRow[]): RankedRow[] {
  if (rows.length <= 1) {
    return rows.map((row) => {
      const total = clamp(Math.round(row.grade.total * 0.85 + 8), 62, 90);
      return { listing: row.listing, grade: { ...row.grade, total, band: bandFor(total, false) } };
    });
  }
  const raws = rows.map((row) => row.grade.total);
  const min = Math.min(...raws);
  const max = Math.max(...raws);
  return rows.map((row) => {
    const stretched = max === min ? 78 : 64 + 32 * ((row.grade.total - min) / (max - min));
    const total = Math.round(clamp(stretched, 64, 96));
    return {
      listing: row.listing,
      grade: { ...row.grade, total, band: bandFor(total, false), why: row.grade.why },
    };
  });
}

export function gradeListing(listing: Vehicle, matrix: MustHaveMatrix): Grade {
  const failed = mustHaveFailed(listing, matrix);
  const total = scoreListing(listing, matrix, failed);
  return {
    total,
    band: bandFor(total, failed),
    mustHaveFailed: failed,
    why: whyText(listing, matrix, failed),
  };
}

export function searchVehicles(
  listings: Vehicle[],
  matrix: MustHaveMatrix,
  filterMatrix: MustHaveMatrix = matrix,
): { results: RankedRow[]; listings: Vehicle[]; totalMatched: number } {
  const matched = listings
    .filter((listing) => !mustHaveFailed(listing, filterMatrix))
    .map((listing) => {
      const total = Math.round(rawFitScore(listing, matrix));
      return {
        listing,
        grade: {
          total,
          band: bandFor(total, false),
          mustHaveFailed: false,
          why: whyText(listing, matrix, false),
        },
      };
    });
  const ranked = stretchScores(matched).sort(
    (a, b) =>
      b.grade.total - a.grade.total ||
      a.listing.miles - b.listing.miles ||
      b.listing.year - a.listing.year ||
      a.listing.price - b.listing.price,
  );
  return {
    results: ranked,
    listings,
    totalMatched: ranked.length,
  };
}

export function localShopperLens(listing: Vehicle): { extra: string; bump: number } {
  const age = Math.max(1, new Date().getFullYear() - listing.year + 1);
  const milesPerYear = listing.miles / age;
  const bits: string[] = [];
  let bump = 0;
  if (milesPerYear <= 8500) {
    bump += 5;
    bits.push("low miles for its year — often a one-owner or carefully used car");
  } else if (milesPerYear >= 16000) {
    bump -= 3;
    bits.push("higher miles-per-year than a typical commuter");
  }
  if (reliabilityPoints(listing.make) >= 8) {
    bump += 2;
    bits.push("a make that tends to age well");
  }
  if (!listing.photo) bits.push("no listing photo to judge cleanliness");
  if (!bits.length) bits.push("no extra condition signal beyond the numbers");
  return { extra: `Also worth knowing: ${bits.join("; ")}.`, bump };
}

export function applyShopperLens(rows: RankedRow[]): RankedRow[] {
  return rows
    .map((row) => {
      const lens = localShopperLens(row.listing);
      const total = Math.round(clamp(row.grade.total + lens.bump, 62, 96));
      return {
        listing: row.listing,
        grade: {
          ...row.grade,
          total,
          band: bandFor(total, false),
          why: `${row.grade.why} ${lens.extra}`,
        },
      };
    })
    .sort(
      (a, b) =>
        b.grade.total - a.grade.total ||
        a.listing.miles - b.listing.miles ||
        b.listing.year - a.listing.year ||
        a.listing.price - b.listing.price,
    );
}

export function looksLikeMatrix(value: unknown): value is MustHaveMatrix {
  return Boolean(value && typeof value === "object" && typeof (value as MustHaveMatrix).searchArea === "string");
}

export function sanitizeVehicles(value: unknown): Vehicle[] {
  if (!Array.isArray(value)) return [];
  const out: Vehicle[] = [];
  for (const item of value) {
    if (item && typeof item === "object" && "id" in item && "make" in item && "model" in item) {
      out.push(item as Vehicle);
      if (out.length >= 40) break;
    }
  }
  return out;
}
