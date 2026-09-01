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

export function mustHaveFailed(listing: Vehicle, matrix: MustHaveMatrix): boolean {
  if (matrix.body && listing.body !== matrix.body) return true;
  if (matrix.maxPrice != null && listing.price > matrix.maxPrice) return true;
  if (matrix.maxMiles != null && listing.miles > matrix.maxMiles) return true;
  if (matrix.minYear != null && listing.year < matrix.minYear) return true;
  if (matrix.awd && !isAwd(listing)) return true;
  if (matrix.minSeats > 5 && listing.seats < matrix.minSeats) return true;
  if (matrix.carplay && !listing.carplay) return true;
  if (matrix.backupCamera && !listing.backupCamera) return true;
  if (matrix.tow && !listing.tow) return true;
  if (matrix.fuel && listing.fuel !== matrix.fuel) return true;
  return false;
}

function bandFor(total: number, failed: boolean): GradeBand {
  if (failed) return "miss";
  if (total >= 92) return "superb";
  if (total >= 84) return "excellent";
  if (total >= 72) return "good";
  return "ok";
}

function whyText(listing: Vehicle, matrix: MustHaveMatrix, failed: boolean): string {
  const title = `${listing.year} ${listing.make} ${listing.model}${listing.trim ? ` ${listing.trim}` : ""}`;
  const facts = `${title} in ${listing.city} is listed at ${money(listing.price)} with ${listing.miles.toLocaleString()} miles.`;
  if (!hasMustHaves(matrix)) {
    return `Nearby listing. ${facts} Set must-haves in Chat to search and grade against what you actually need.`;
  }
  const lead = failed
    ? "This one misses something you called a must-have."
    : "Almost everything you named shows up here.";
  const works: string[] = [];
  if (matrix.maxPrice != null && listing.price <= matrix.maxPrice * 0.88) {
    works.push(`under budget at ${money(listing.price)}`);
  }
  if (matrix.maxMiles != null && listing.miles <= matrix.maxMiles * 0.7) {
    works.push("lower miles than you asked");
  }
  if (matrix.awd && listing.drivetrain === "awd") works.push("AWD");
  if (matrix.awd && listing.drivetrain === "4wd") works.push("4WD");
  if (listing.seats >= 8) works.push(`${listing.seats} seats`);
  if (matrix.carplay && listing.carplay) works.push("CarPlay");
  const workLine = works.length ? ` What works: ${works.join(", ")}.` : "";
  const trade = failed
    ? " Tradeoffs: it fails a must-have, so it stays off the ranked list."
    : " Tradeoffs: nothing scored looks like a serious problem.";
  return `${lead} ${facts}${workLine}${trade}`;
}

function scoreListing(listing: Vehicle, matrix: MustHaveMatrix, failed: boolean): number {
  if (failed) return 40;
  if (!hasMustHaves(matrix)) return 80;
  let total = 88;
  if (matrix.maxPrice != null) {
    const ratio = listing.price / matrix.maxPrice;
    if (ratio <= 0.82) total += 6;
    else if (ratio <= 0.92) total += 4;
    else if (ratio <= 1) total += 1;
  }
  if (matrix.maxMiles != null) {
    const ratio = listing.miles / matrix.maxMiles;
    if (ratio <= 0.6) total += 4;
    else if (ratio <= 0.85) total += 2;
  }
  if (matrix.minYear != null && listing.year >= matrix.minYear + 2) total += 2;
  if (matrix.awd && (listing.drivetrain === "awd" || listing.drivetrain === "4wd")) total += 2;
  if (matrix.carplay && listing.carplay) total += 1;
  return Math.max(72, Math.min(100, Math.round(total)));
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

export function searchVehicles(listings: Vehicle[], matrix: MustHaveMatrix): { results: RankedRow[]; listings: Vehicle[]; totalMatched: number } {
  const ranked = listings
    .map((listing) => ({ listing, grade: gradeListing(listing, matrix) }))
    .filter((row) => !row.grade.mustHaveFailed)
    .sort((a, b) => b.grade.total - a.grade.total || a.listing.price - b.listing.price);
  return {
    results: ranked,
    listings,
    totalMatched: ranked.length,
  };
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
