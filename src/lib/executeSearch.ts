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

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function holdStage<T>(
  emit: (event: SearchStatusEvent) => void,
  stage: SearchStatusEvent["stage"],
  work: () => Promise<T>,
  holdMs: number,
): Promise<T> {
  emit(statusPayload(stage));
  const started = Date.now();
  const value = await work();
  const rest = holdMs - (Date.now() - started);
  if (rest > 0) await pause(rest);
  return value;
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

  const hold = mode === "grade" ? 750 : 0;
  const inventory = await holdStage(
    emit,
    "pull",
    async () =>
      owned.length
        ? { listings: owned, source: "session" as const, origin: undefined, scanned: owned.length, notice: undefined }
        : loadInventory({ matrix: filter, scoreMatrix: matrix, mode, here }),
    hold,
  );

  const ranked = searchVehicles(inventory.listings, matrix, filter);
  let results = ranked.results;
  if (mode === "grade" && ranked.results.length) {
    const pool = await holdStage(emit, "pool", async () => applyShopperLens(ranked.results).slice(0, SHORTLIST_POOL), hold);
    const extras = await holdStage(emit, "extras", async () => attachListingExtras(pool.map((row) => row.listing)), hold);
    const byId = new Map(extras.map((listing) => [listing.id, listing]));
    const withExtras = pool.map((row) => ({ listing: byId.get(row.listing.id) ?? row.listing, grade: row.grade }));
    results = await holdStage(emit, "ai", async () => rankShortlist(matrix, withExtras), hold);
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