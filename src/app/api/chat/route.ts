import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { chatReply } from "@/lib/chat";
import { looksLikeMatrix } from "@/lib/grade";
import { BROWSE_MATRIX, DEMO_COOKIE } from "@/lib/types";

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get(DEMO_COOKIE)?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { text?: unknown; draft?: unknown; confirm?: unknown } = {};
  try {
    body = (await request.json()) as { text?: unknown; draft?: unknown; confirm?: unknown };
  } catch {
    body = {};
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  const draft = looksLikeMatrix(body.draft) ? body.draft : BROWSE_MATRIX;
  return NextResponse.json(chatReply(body.text.trim(), draft, body.confirm === true));
}
