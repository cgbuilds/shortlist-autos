import type { BodyStyle, Fuel, MustHaveMatrix } from "@/lib/types";
import { DEFAULT_MATRIX } from "@/lib/types";

const BODIES: BodyStyle[] = ["suv", "crossover", "sedan", "minivan", "truck", "hatchback", "coupe", "wagon"];
const FUELS: Fuel[] = ["gas", "hybrid", "plugin-hybrid", "ev"];

const BODY_RES: Array<{ re: RegExp; body: BodyStyle }> = [
  { re: /\bmini\s*van|odyssey|sienna|pacifica\b/i, body: "minivan" },
  { re: /\b(suv|crossover|rav4|cr-?v|cx-?5|telluride|pilot|highlander|tucson|model y)\b/i, body: "suv" },
  { re: /\b(truck|f-?150|tacoma|silverado|ranger)\b/i, body: "truck" },
  { re: /\b(sedan|camry|civic|accord)\b/i, body: "sedan" },
  { re: /\bhatch/i, body: "hatchback" },
  { re: /\bwagon|outback\b/i, body: "wagon" },
  { re: /\bcoupe|mustang|miata\b/i, body: "coupe" },
];

function parseMoney(text: string): number | null {
  const m =
    text.match(/\bunder\s*\$?\s*([\d.,]+)\s*k\b/i) ||
    text.match(/\b(?:max|budget|below|under)\s*\$?\s*([\d.,]+)\s*k\b/i) ||
    text.match(/\$\s*([\d.,]+)\s*k\b/i) ||
    text.match(/\$\s*([\d,]{4,})/) ||
    text.match(/\b([\d]{2,3})\s*k\b/i);
  if (!m) return null;
  const raw = m[1].replace(/,/g, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n < 1000 ? Math.round(n * 1000) : Math.round(n);
}

function parseMiles(text: string): number | null {
  const m =
    text.match(/\bunder\s*([\d.,]+)\s*k\s*miles\b/i) ||
    text.match(/\b([\d.,]+)\s*k\s*miles\b/i) ||
    text.match(/\b([\d,]{4,})\s*miles\b/i);
  if (!m) return null;
  const raw = m[1].replace(/,/g, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n < 1000 ? Math.round(n * 1000) : Math.round(n);
}

function parseYear(text: string): number | null {
  const plus = text.match(/\b(20\d{2})\s*\+/);
  if (plus) return Number(plus[1]);
  const newer = text.match(/\b(?:newer than|since|from)\s*(20\d{2})\b/i);
  if (newer) return Number(newer[1]);
  const min = text.match(/\b(20\d{2})\s*(?:or newer|and up)\b/i);
  if (min) return Number(min[1]);
  return null;
}

function parseFuel(text: string): Fuel | null {
  if (/\b(ev|electric|tesla)\b/i.test(text)) return "ev";
  if (/\bplug-?in|phev\b/i.test(text)) return "plugin-hybrid";
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\bgas(?:oline)?\b/i.test(text)) return "gas";
  return null;
}

function parseArea(text: string): string | null {
  if (/\btampa\b/i.test(text)) return "Tampa, FL";
  if (/\bst\.?\s*pete|\bsaint petersburg\b/i.test(text)) return "St. Petersburg, FL";
  if (/\bbrandon\b/i.test(text)) return "Brandon, FL";
  const city = text.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (city) return city[1];
  return null;
}

export function formatMustHaves(matrix: MustHaveMatrix): string {
  const parts: string[] = [];
  if (matrix.searchArea) parts.push(matrix.searchArea);
  if (matrix.body) parts.push(matrix.body);
  if (matrix.maxPrice) parts.push(`≤ $${matrix.maxPrice.toLocaleString()}`);
  if (matrix.maxMiles) parts.push(`≤ ${matrix.maxMiles.toLocaleString()} mi`);
  if (matrix.minYear) parts.push(`${matrix.minYear}+`);
  if (matrix.awd) parts.push("AWD/4WD");
  if (matrix.minSeats > 5) parts.push(`${matrix.minSeats}+ seats`);
  if (matrix.carplay) parts.push("CarPlay");
  if (matrix.backupCamera) parts.push("backup camera");
  if (matrix.tow) parts.push("tow");
  if (matrix.fuel) parts.push(matrix.fuel);
  return parts.join(" · ") || "No must-haves yet";
}

export function parseMustHaves(text: string, draft: MustHaveMatrix = DEFAULT_MATRIX): MustHaveMatrix {
  const next: MustHaveMatrix = { ...draft };
  const body = BODY_RES.find((item) => item.re.test(text));
  if (body) next.body = body.body;
  const price = parseMoney(text);
  if (price) next.maxPrice = price;
  const miles = parseMiles(text);
  if (miles) next.maxMiles = miles;
  const year = parseYear(text);
  if (year) next.minYear = year;
  const fuel = parseFuel(text);
  if (fuel) next.fuel = fuel;
  const area = parseArea(text);
  if (area) next.searchArea = area;
  if (/\bawd|4wd|all[- ]wheel|four[- ]wheel\b/i.test(text)) next.awd = true;
  if (/\bno awd|fwd only\b/i.test(text)) next.awd = false;
  if (/\bcarplay|car play|apple car\b/i.test(text)) next.carplay = true;
  if (/\bbackup cam|rear cam\b/i.test(text)) next.backupCamera = true;
  if (/\btow(ing| package)?\b/i.test(text)) next.tow = true;
  const seats = text.match(/\b(\d)\+?\s*seats?\b/i);
  if (seats) next.minSeats = Number(seats[1]);
  if (/\bthird row|3rd row\b/i.test(text)) next.minSeats = Math.max(next.minSeats, 7);
  return next;
}

function asBody(value: unknown): BodyStyle | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/\s+/g, "");
  if (v === "crossover" || v === "suvcrossover") return "suv";
  return BODIES.find((body) => body === v) ?? null;
}

function asFuel(value: unknown): Fuel | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (v === "electric" || v === "bev") return "ev";
  if (v === "phev" || v === "plug-in" || v === "plugin") return "plugin-hybrid";
  return FUELS.find((fuel) => fuel === v) ?? null;
}

function asInt(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[$,]/g, "")) : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return fallback;
}

/** Keep LLM output on the MustHaveMatrix contract; unspecified fields stay on the draft. */
export function sanitizeMatrix(raw: unknown, draft: MustHaveMatrix): MustHaveMatrix {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const searchArea =
    typeof src.searchArea === "string" && src.searchArea.trim().length >= 2 && src.searchArea.trim().length <= 80
      ? src.searchArea.trim()
      : draft.searchArea;
  return {
    searchArea,
    maxPrice: src.maxPrice === undefined ? draft.maxPrice : src.maxPrice === null ? null : (asInt(src.maxPrice, 1000, 500000) ?? draft.maxPrice),
    maxMiles: src.maxMiles === undefined ? draft.maxMiles : src.maxMiles === null ? null : (asInt(src.maxMiles, 1000, 400000) ?? draft.maxMiles),
    minYear: src.minYear === undefined ? draft.minYear : src.minYear === null ? null : (asInt(src.minYear, 1990, new Date().getFullYear() + 1) ?? draft.minYear),
    body: src.body === undefined ? draft.body : src.body === null ? null : (asBody(src.body) ?? draft.body),
    awd: src.awd === undefined ? draft.awd : asBool(src.awd, draft.awd),
    minSeats: src.minSeats === undefined ? draft.minSeats : (asInt(src.minSeats, 2, 15) ?? draft.minSeats),
    carplay: src.carplay === undefined ? draft.carplay : asBool(src.carplay, draft.carplay),
    backupCamera: src.backupCamera === undefined ? draft.backupCamera : asBool(src.backupCamera, draft.backupCamera),
    tow: src.tow === undefined ? draft.tow : asBool(src.tow, draft.tow),
    fuel: src.fuel === undefined ? draft.fuel : src.fuel === null ? null : (asFuel(src.fuel) ?? draft.fuel),
  };
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export type ChatReply = {
  reply: string;
  matrix: MustHaveMatrix;
  rescore: boolean;
  awaitingConfirm: boolean;
  source?: "openrouter" | "parser";
};

const CONFIRM_RE =
  /^(yes|yep|yeah|y|ok|okay|confirm|confirmed|looks good|sounds good|go ahead|search|do it|that'?s right|perfect)\b/i;

export function isConfirmText(text: string): boolean {
  return CONFIRM_RE.test(text.trim());
}

export function chatReply(text: string, draft: MustHaveMatrix, confirm = false): ChatReply {
  if (confirm || isConfirmText(text)) {
    const summary = formatMustHaves(draft);
    return {
      matrix: draft,
      rescore: true,
      awaitingConfirm: false,
      reply: `Confirmed: ${summary}. Searching nearby listings and grading them now.`,
    };
  }
  const matrix = parseMustHaves(text, draft);
  const summary = formatMustHaves(matrix);
  return {
    matrix,
    rescore: false,
    awaitingConfirm: true,
    reply: `I heard: ${summary}. Confirm these must-haves and I’ll run a fresh search and grade the matches.`,
  };
}
