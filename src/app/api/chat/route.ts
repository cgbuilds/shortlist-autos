import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { chatReply } from "@/lib/chat";
import { looksLikeMatrix } from "@/lib/grade";
import { DEFAULT_MATRIX, DEMO_COOKIE } from "@/lib/types";

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get(DEMO_COOKIE)?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { text?: unknown; draft?: unknown } = {};
  try {
    body = (await request.json()) as { text?: unknown; draft?: unknown };
  } catch {
    body = {};
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  const draft = looksLikeMatrix(body.draft) ? body.draft : DEFAULT_MATRIX;
  return NextResponse.json(chatReply(body.text.trim(), draft));
}
