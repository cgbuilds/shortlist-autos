import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/types";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_COOKIE, "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
