import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { formatMustHaves } from "@/lib/chat";
import { applyShopperLens, looksLikeMatrix, sanitizeVehicles, searchVehicles } from "@/lib/grade";
import { widenForSearch } from "@/lib/intake";
import { attachListingExtras, loadInventory } from "@/lib/inventory";
import { rankShortlist } from "@/lib/openrouter";
import { BROWSE_MATRIX, DEMO_COOKIE, SHORTLIST_POOL } from "@/lib/types";
import type { SearchMode } from "@/lib/types";

function isMode(value: unknown): value is SearchMode {
  return value === "browse" || value === "grade";
}

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get(DEMO_COOKIE)?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { matrix?: unknown; listings?: unknown; mode?: unknown; lat?: unknown; lng?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const matrix = looksLikeMatrix(body.matrix) ? body.matrix : BROWSE_MATRIX;
  const mode: SearchMode = isMode(body.mode) ? body.mode : "browse";
  const owned = sanitizeVehicles(body.listings);
  const here =
    typeof body.lat === "number" && Number.isFinite(body.lat) && typeof body.lng === "number" && Number.isFinite(body.lng)
      ? { lat: body.lat, lng: body.lng }
      : null;
  const filter = mode === "grade" ? widenForSearch(matrix) : matrix;
  const inventory = owned.length
    ? { listings: owned, source: "session" as const, origin: undefined, scanned: owned.length, notice: undefined }
    : await loadInventory({ matrix: filter, scoreMatrix: matrix, mode, here });
  const ranked = searchVehicles(inventory.listings, matrix, filter);
  let results = ranked.results;
  if (mode === "grade" && ranked.results.length) {
    const pool = applyShopperLens(ranked.results).slice(0, SHORTLIST_POOL);
    const extras = await attachListingExtras(pool.map((row) => row.listing));
    const byId = new Map(extras.map((listing) => [listing.id, listing]));
    const withExtras = pool.map((row) => ({ listing: byId.get(row.listing.id) ?? row.listing, grade: row.grade }));
    results = await rankShortlist(matrix, withExtras);
  }
  let notice = inventory.notice;
  if (mode === "grade" && ranked.results.length === 0) {
    const area = inventory.origin?.label || matrix.searchArea;
    const empty = `Searched ${inventory.listings.length} ${inventory.source} cars near ${area}. None met ${formatMustHaves(matrix)}.`;
    notice = notice ? { ...notice, message: `${notice.message} ${empty}` } : { level: "warning", message: empty };
  }
  return NextResponse.json({
    ...ranked,
    results,
    totalMatched: results.length,
    source: inventory.source,
    mode,
    origin: inventory.origin,
    scanned: inventory.scanned ?? inventory.listings.length,
    notice,
  });
}

