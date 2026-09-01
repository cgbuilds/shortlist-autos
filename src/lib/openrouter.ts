import { chatReply, formatMustHaves, parseJsonObject, sanitizeMatrix, type ChatReply } from "@/lib/chat";
import { hasMustHaves } from "@/lib/grade";
import type { MustHaveMatrix } from "@/lib/types";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export const DEFAULT_OPENROUTER_MODEL = "openrouter/auto";

const MATRIX_SCHEMA = {
  name: "shortlist_chat",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "matrix", "awaitingConfirm", "rescore"],
    properties: {
      reply: { type: "string" },
      awaitingConfirm: { type: "boolean" },
      rescore: { type: "boolean" },
      matrix: {
        type: "object",
        additionalProperties: false,
        required: [
          "searchArea",
          "maxPrice",
          "maxMiles",
          "minYear",
          "body",
          "awd",
          "minSeats",
          "carplay",
          "backupCamera",
          "tow",
          "fuel",
        ],
        properties: {
          searchArea: { type: "string" },
          maxPrice: { type: ["number", "null"] },
          maxMiles: { type: ["number", "null"] },
          minYear: { type: ["number", "null"] },
          body: {
            anyOf: [
              { type: "string", enum: ["suv", "crossover", "sedan", "minivan", "truck", "hatchback", "coupe", "wagon"] },
              { type: "null" },
            ],
          },
          awd: { type: "boolean" },
          minSeats: { type: "number" },
          carplay: { type: "boolean" },
          backupCamera: { type: "boolean" },
          tow: { type: "boolean" },
          fuel: {
            anyOf: [{ type: "string", enum: ["gas", "hybrid", "plugin-hybrid", "ev"] }, { type: "null" }],
          },
        },
      },
    },
  },
} as const;

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

type CompletionPayload = {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
};

async function complete(args: {
  key: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  structured: boolean;
  signal: AbortSignal;
}): Promise<{ ok: boolean; status: number; payload?: CompletionPayload }> {
  const body: Record<string, unknown> = {
    model: args.model,
    temperature: 0.2,
    max_tokens: 500,
    messages: args.messages,
    provider: { require_parameters: true },
  };
  if (args.structured) {
    body.response_format = { type: "json_schema", json_schema: MATRIX_SCHEMA };
  }
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: args.signal,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${args.key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://shortlist.autos",
      "X-Title": "Shortlist Autos",
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) return { ok: false, status: res.status };
  try {
    return { ok: true, status: res.status, payload: JSON.parse(raw) as CompletionPayload };
  } catch {
    return { ok: false, status: res.status };
  }
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
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt(draft) },
    ...history.slice(-8).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) })),
    { role: "user", content: text.slice(0, 2000) },
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    let result = await complete({ key, model, messages, structured: true, signal: controller.signal });
    if (!result.ok) {
      result = await complete({ key, model, messages, structured: false, signal: controller.signal });
    }
    const fallback = chatReply(text, draft);
    if (!result.ok || !result.payload) {
      return {
        ...fallback,
        source: "parser",
        reply: `${fallback.reply} (Chat model was unavailable: HTTP ${result.status}.)`,
      };
    }
    const content = result.payload.choices?.[0]?.message?.content || "";
    const parsed = parseJsonObject(content);
    if (!parsed) {
      return { ...fallback, source: "parser" };
    }
    const matrix = sanitizeMatrix(parsed.matrix, draft);
    const reply =
      typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim().slice(0, 800)
        : `I heard: ${formatMustHaves(matrix)}. Confirm these must-haves and I’ll search and grade.`;
    const rescore = parsed.rescore === true && hasMustHaves(matrix);
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
