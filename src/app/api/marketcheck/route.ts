import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { probeMarketCheck } from "@/lib/marketcheck-probe";
import { DEMO_COOKIE } from "@/lib/types";

export async function GET() {
  const jar = await cookies();
  if (jar.get(DEMO_COOKIE)?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const probe = await probeMarketCheck();
  return NextResponse.json(probe, { status: probe.ok ? 200 : probe.configured ? 502 : 503 });
}
