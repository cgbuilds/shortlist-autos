import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/types";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/app")) return NextResponse.next();
  const demo = request.cookies.get(DEMO_COOKIE)?.value;
  if (demo === "1") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*"],
};
