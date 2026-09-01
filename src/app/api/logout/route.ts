import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/types";

export async function POST(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.cookies.set(DEMO_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
