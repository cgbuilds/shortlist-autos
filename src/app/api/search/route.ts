import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SAMPLE_VEHICLES } from "@/data/vehicles";
import { looksLikeMatrix, sanitizeVehicles, searchVehicles } from "@/lib/grade";
import { DEFAULT_MATRIX, DEMO_COOKIE } from "@/lib/types";

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get(DEMO_COOKIE)?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { matrix?: unknown; listings?: unknown } = {};
  try {
    body = (await request.json()) as { matrix?: unknown; listings?: unknown };
  } catch {
    body = {};
  }
  const matrix = looksLikeMatrix(body.matrix) ? body.matrix : DEFAULT_MATRIX;
  const listings = sanitizeVehicles(body.listings);
  const pool = listings.length ? listings : SAMPLE_VEHICLES;
  const result = searchVehicles(pool, matrix);
  return NextResponse.json({ ...result, source: listings.length ? "session" : "sample" });
}
