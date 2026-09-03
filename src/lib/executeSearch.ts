import { formatMustHaves } from "@/lib/chat";
import { applyShopperLens, looksLikeMatrix, sanitizeVehicles, searchVehicles } from "@/lib/grade";
import { widenForSearch } from "@/lib/intake";
import { attachListingExtras, loadInventory } from "@/lib/inventory";
import { rankShortlist } from "@/lib/openrouter";
import { statusPayload } from "@/lib/searchStatus";
import { BROWSE_MATRIX, SHORTLIST_POOL } from "@/lib/types";
import type { MustHaveMatrix, RankedRow, SearchMode, Vehicle } from "@/lib/types";

export type SearchNotice = { level: "error" | "warning"; message: string };

export type SearchPayload = {
  results: RankedRow[];
  listings: Vehicle[];
  totalMatched: number;
  source: "live" | "sample" | "session";
  mode: SearchMode;
  origin?: { label?: string };
  scanned: number;
  notice?: SearchNotice;
};

export type SearchStatusEvent = ReturnType<typeof statusPayload>;

function isMode(value: unknown): value is SearchMode {
  return value === "browse" || value === "grade";
}

export async function executeSearch(
  body: { matrix?: unknown; listings?: unknown; mode?: unknown; lat?: unknown; lng?: unknown },
  emit: (event: SearchStatusEvent) => void = () => undefined,
): Promise<SearchPayload> {
  const matrix: MustHaveMatrix = looksLikeMatrix(body.matrix) ? body.matrix : BROWSE_MATRIX;
  const mode: SearchMode = isMode(body.mode) ? body.mode : "browse";
  const owned = sanitizeVehicles(body.listings);
  const here =
    typeof body.lat === "number" && Number.isFinite(body.lat) && typeof body.lng === "number" && Number.isFinite(body.lng)
      ? { lat: body.lat, lng: body.lng }
      : null;
  const filter = mode === "grade" ? widenForSearch(matrix) : matrix;

  emit(statusPayload("pull"));
  const inventory = owned.length
    ? { listings: owned, source: "session" as const, origin: undefined, scanned: owned.length, notice: undefined }
    : await loadInventory({ matrix: filter, scoreMatrix: matrix, mode, here });

  const ranked = searchVehicles(inventory.listings, matrix, filter);
  let results = ranked.results;
  if (mode === "grade" && ranked.results.length) {
    emit(statusPayload("pool"));
    const pool = applyShopperLens(ranked.results).slice(0, SHORTLIST_POOL);
    emit(statusPayload("extras"));
    const extras = await attachListingExtras(pool.map((row) => row.listing));
    const byId = new Map(extras.map((listing) => [listing.id, listing]));
    const withExtras = pool.map((row) => ({ listing: byId.get(row.listing.id) ?? row.listing, grade: row.grade }));
    emit(statusPayload("ai"));
    results = await rankShortlist(matrix, withExtras);
  }

  let notice = inventory.notice;
  if (mode === "grade" && ranked.results.length === 0) {
    const area = inventory.origin?.label || matrix.searchArea;
    const empty = `Searched ${inventory.listings.length} ${inventory.source} cars near ${area}. None met ${formatMustHaves(matrix)}.`;
    notice = notice ? { ...notice, message: `${notice.message} ${empty}` } : { level: "warning", message: empty };
  }

  return {
    results,
    listings: ranked.listings,
    totalMatched: results.length,
    source: inventory.source,
    mode,
    origin: inventory.origin,
    scanned: inventory.scanned ?? inventory.listings.length,
    notice,
  };
}