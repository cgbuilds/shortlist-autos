import { chatReply, formatMustHaves, nextFollowUp, nextScoringPrompt, parseJsonObject, sanitizeMatrix, type ChatReply } from "@/lib/chat";
import { hasMustHaves } from "@/lib/grade";
import type { MustHaveMatrix, RankedRow } from "@/lib/types";

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
          "preferFuel",
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
          preferFuel: {
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
- fuel is gas, hybrid, plugin-hybrid, ev, or null. Hard filter only if they required it.
- preferFuel is the same enum or null. Use it when they say ideally / prefer / not strictly / not a must. Leave fuel null in that case.
- "3 row" / third row means minSeats 7.
- awaitingConfirm is true when you updated or restated must-haves and they have not confirmed yet.
- rescore is true only if they clearly asked you to search/grade now AND they have a maxPrice (or they said search anyway / skip).
- If maxPrice is missing, ask "What's your max price?" in one short line. Do not invent a budget.
- If they named a car type but no body is set, ask SUV / sedan / truck in one short line.
- If price and body are set but miles and year are both missing, mention that max miles or a year floor helps scoring, then tell them they can press Search.
- reply: 1-2 short sentences. No lists of every possible filter. Ask one follow-up at a time.
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
  schema?: unknown;
}): Promise<{ ok: boolean; status: number; payload?: CompletionPayload }> {
  const body: Record<string, unknown> = {
    model: args.model,
    temperature: 0.2,
    max_tokens: 700,
    messages: args.messages,
    provider: { require_parameters: true },
  };
  if (args.structured) {
    body.response_format = { type: "json_schema", json_schema: args.schema ?? MATRIX_SCHEMA };
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
    const followUp = nextFollowUp(matrix);
    const scoring = followUp ? null : nextScoringPrompt(matrix);
    const skipFollowUp = /\b(anyway|skip|no budget|whatever|just search|search anyway)\b/i.test(text);
    let rescore = parsed.rescore === true && hasMustHaves(matrix) && (!followUp || skipFollowUp);
    let reply =
      typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim().slice(0, 800)
        : followUp
          ? `Got ${formatMustHaves(matrix)}. ${followUp}`
          : scoring
            ? `Got ${formatMustHaves(matrix)}. ${scoring}`
            : `Got ${formatMustHaves(matrix)}. Press Search when you’re ready.`;
    if (!rescore && followUp && !reply.includes("?")) {
      reply = `${reply.replace(/\.*$/, "")}. ${followUp}`;
    }
    if (!rescore && scoring && !/\bmiles\b|\byear\b/i.test(reply)) {
      reply = `${reply.replace(/\.*$/, "")}. ${scoring}`;
    }
    if (parsed.rescore === true && followUp && !skipFollowUp) {
      rescore = false;
      reply = followUp;
    }
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

const LENS_SCHEMA = {
  name: "shopper_lens",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["notes"],
    properties: {
      notes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "extra", "bump"],
          properties: {
            id: { type: "string" },
            extra: { type: "string" },
            bump: { type: "number" },
          },
        },
      },
    },
  },
} as const;

/** Rank extras the shopper did not state: careful use, 1-owner-ish miles, cleanliness, reliability. */
export async function enrichShortlist(matrix: MustHaveMatrix, rows: RankedRow[]): Promise<RankedRow[]> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key || !rows.length) return rows;
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
  const compact = rows.slice(0, 12).map((row) => ({
    id: row.listing.id,
    year: row.listing.year,
    make: row.listing.make,
    model: row.listing.model,
    price: row.listing.price,
    miles: row.listing.miles,
    fuel: row.listing.fuel,
    mpg: row.listing.mpg,
    drivetrain: row.listing.drivetrain,
    seats: row.listing.seats,
    photo: Boolean(row.listing.photo),
  }));
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: `You advocate for a used-car shopper. They only stated: ${formatMustHaves(matrix)}.
They did NOT mention owners, accidents, cleanliness, or how gently the car was used.
Infer extra value from year vs miles (low miles/year ≈ one-owner / careful use), photos, make reliability, and whether a car looks like a cleaner example in this set.
Return ONLY JSON {"notes":[{"id":"...","extra":"one short sentence","bump":0}]}
bump is -6 to 8. Do not invent accidents or CarFax. If unsure, bump 0.`,
    },
    { role: "user", content: JSON.stringify(compact) },
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let result = await complete({ key, model, messages, structured: true, signal: controller.signal, schema: LENS_SCHEMA });
    if (!result.ok) {
      result = await complete({ key, model, messages, structured: false, signal: controller.signal });
    }
    const content = result.payload?.choices?.[0]?.message?.content || "";
    const parsed = parseJsonObject(content);
    const notes = Array.isArray(parsed?.notes) ? parsed.notes : [];
    const byId = new Map<string, { extra: string; bump: number }>();
    for (const note of notes) {
      if (!note || typeof note !== "object") continue;
      const rec = note as { id?: unknown; extra?: unknown; bump?: unknown };
      if (typeof rec.id !== "string") continue;
      byId.set(rec.id, {
        extra: typeof rec.extra === "string" ? rec.extra.trim().slice(0, 240) : "",
        bump: typeof rec.bump === "number" && Number.isFinite(rec.bump) ? Math.max(-6, Math.min(8, rec.bump)) : 0,
      });
    }
    if (!byId.size) return rows;
    return rows
      .map((row) => {
        const note = byId.get(row.listing.id);
        if (!note) return row;
        const total = Math.round(Math.min(96, Math.max(62, row.grade.total + note.bump)));
        return {
          listing: row.listing,
          grade: {
            ...row.grade,
            total,
            why: note.extra ? `${row.grade.why} ${note.extra}` : row.grade.why,
          },
        };
      })
      .sort(
        (a, b) =>
          b.grade.total - a.grade.total ||
          a.listing.miles - b.listing.miles ||
          b.listing.year - a.listing.year,
      );
  } catch {
    return rows;
  } finally {
    clearTimeout(timer);
  }
}
