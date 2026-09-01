import { chatReply, formatMustHaves, parseJsonObject, sanitizeMatrix, type ChatReply } from "@/lib/chat";
import { hasMustHaves } from "@/lib/grade";
import type { MustHaveMatrix } from "@/lib/types";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const DEFAULT_MODEL = "openai/gpt-4o-mini";

function systemPrompt(draft: MustHaveMatrix): string {
  return `You are Chat for Shortlist Autos, a used-car shortlist. The shopper is setting must-haves. Current draft:

${JSON.stringify(draft)}

Return ONLY JSON with this shape:
{"reply":"string","matrix":{...same keys as draft...},"awaitingConfirm":true,"rescore":false}

Rules:
- Merge into the draft. Change a field only if the shopper stated it. Do not invent budget, miles, year, AWD, seats, CarPlay, or fuel.
- searchArea is a city like "Tampa, FL". Default to the draft location.
- body is one of: suv, sedan, minivan, truck, hatchback, coupe, wagon, or null.
- maxPrice and maxMiles are integers in USD / miles, or null. "30k" means 30000.
- minYear is a 4-digit year or null. minSeats is 2-15.
- awd, carplay, backupCamera, tow are booleans.
- fuel is gas, hybrid, plugin-hybrid, ev, or null.
- awaitingConfirm is true when you updated or restated must-haves and they have not confirmed yet.
- rescore is true only if they clearly asked you to search/grade now (confirm, go, find them).
- reply: 1-3 short sentences. Read the must-haves back. Ask them to confirm before search unless they already did.
- No markdown, no extra keys.`;
}

export async function openRouterChat(
  text: string,
  draft: MustHaveMatrix,
  history: ChatTurn[] = [],
): Promise<ChatReply> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    return { ...chatReply(text, draft), source: "parser" };
  }
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt(draft) },
    ...history.slice(-8).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) })),
    { role: "user", content: text.slice(0, 2000) },
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://shortlist.autos",
        "X-Title": "Shortlist Autos",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages,
      }),
    });
    const raw = await res.text();
    const fallback = chatReply(text, draft);
    if (!res.ok) {
      return {
        ...fallback,
        source: "parser",
        reply: `${fallback.reply} (Chat model was unavailable: HTTP ${res.status}.)`,
      };
    }
    const payload = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content || "";
    const parsed = parseJsonObject(content);
    if (!parsed) {
      return { ...chatReply(text, draft), source: "parser" };
    }
    const matrix = sanitizeMatrix(parsed.matrix, draft);
    const reply =
      typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim().slice(0, 800)
        : `I heard: ${formatMustHaves(matrix)}. Confirm these must-haves and I’ll search and grade.`;
    const wantsSearch = parsed.rescore === true;
    const rescore = wantsSearch && hasMustHaves(matrix);
    return {
      matrix,
      reply,
      rescore,
      awaitingConfirm: !rescore,
      source: "openrouter",
    };
  } catch {
    const fallback = chatReply(text, draft);
    return {
      ...fallback,
      source: "parser",
      reply: `${fallback.reply} (Chat model didn’t respond, so I used the basic parser.)`,
    };
  } finally {
    clearTimeout(timer);
  }
}
