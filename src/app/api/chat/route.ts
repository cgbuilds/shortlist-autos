import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { chatReply, isConfirmText } from "@/lib/chat";
import { looksLikeMatrix } from "@/lib/grade";
import { openRouterChat, type ChatTurn } from "@/lib/openrouter";
import { DEMO_COOKIE, emptyIntakeMatrix } from "@/lib/types";

function sanitizeHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  const out: ChatTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
      out.push({ role, content: content.trim().slice(0, 2000) });
    }
    if (out.length >= 8) break;
  }
  return out;
}

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get(DEMO_COOKIE)?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { text?: unknown; draft?: unknown; confirm?: unknown; history?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  const text = body.text.trim();
  const draft = looksLikeMatrix(body.draft) ? body.draft : emptyIntakeMatrix();
  if (body.confirm === true || isConfirmText(text)) {
    return NextResponse.json({ ...chatReply(text, draft, true), source: "parser" });
  }
  const result = await openRouterChat(text, draft, sanitizeHistory(body.history));
  return NextResponse.json(result);
}
