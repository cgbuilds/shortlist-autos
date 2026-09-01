import type { BodyStyle, Fuel, MustHaveMatrix } from "@/lib/types";
import { DEFAULT_MATRIX } from "@/lib/types";

const BODIES: Array<{ re: RegExp; body: BodyStyle }> = [
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
  const body = BODIES.find((item) => item.re.test(text));
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

export function chatReply(text: string, draft: MustHaveMatrix): { reply: string; matrix: MustHaveMatrix; rescore: boolean } {
  const matrix = parseMustHaves(text, draft);
  const summary = formatMustHaves(matrix);
  return {
    matrix,
    rescore: true,
    reply: `Updated must-haves: ${summary}. I’ll rescore the sample Tampa list against that.`,
  };
}
