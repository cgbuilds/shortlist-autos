import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { looksLikeMatrix, sanitizeVehicles, searchVehicles } from "@/lib/grade";
import { loadInventory } from "@/lib/inventory";
import { BROWSE_MATRIX, DEMO_COOKIE } from "@/lib/types";
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
  const inventory = owned.length
    ? { listings: owned, source: "session" as const, origin: undefined }
    : await loadInventory({ matrix, mode, here });
  const result = searchVehicles(inventory.listings, matrix);
  return NextResponse.json({
    ...result,
    source: inventory.source,
    mode,
    origin: inventory.origin,
  });
}
