import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TAMPA_ZIP = "33602";

export type MarketCheckProbe = {
  configured: boolean;
  ok: boolean;
  httpStatus: number | null;
  keyLength: number | null;
  keySuffix: string | null;
  numFound: number | null;
  listed: number | null;
  sample: { heading: string; price: number | null; city: string } | null;
  message: string;
};

export function loadLocalEnv(cwd = process.cwd()): void {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(cwd, name);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const cut = line.indexOf("=");
      if (cut <= 0) continue;
      const key = line.slice(0, cut).trim();
      let value = line.slice(cut + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export function keyFingerprint(key: string): { keyLength: number; keySuffix: string } {
  const trimmed = key.trim();
  return { keyLength: trimmed.length, keySuffix: trimmed.length >= 4 ? trimmed.slice(-4) : "****" };
}

export function summarizeProbeStatus(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return `MarketCheck refused the key (HTTP ${status}). Use the API Key, not the client secret.`;
  }
  if (status === 429) return "MarketCheck rate-limited this probe.";
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 180);
  return snippet ? `MarketCheck error ${status}: ${snippet}` : `MarketCheck error HTTP ${status}.`;
}

export async function probeMarketCheck(key = process.env.MARKETCHECK_API_KEY): Promise<MarketCheckProbe> {
  const trimmed = key?.trim() ?? "";
  if (!trimmed) {
    return {
      configured: false,
      ok: false,
      httpStatus: null,
      keyLength: null,
      keySuffix: null,
      numFound: null,
      listed: null,
      sample: null,
      message:
        "MARKETCHECK_API_KEY is not set. Add the API Key (not the client secret) to .env.local or the Cursor environment.",
    };
  }
  const print = keyFingerprint(trimmed);
  const params = new URLSearchParams({
    api_key: trimmed,
    car_type: "used",
    country: "us",
    rows: "5",
    start: "0",
    zip: TAMPA_ZIP,
    radius: "50",
  });
  try {
    const res = await fetch(`https://api.marketcheck.com/v2/search/car/active?${params.toString()}`, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        httpStatus: res.status,
        ...print,
        numFound: null,
        listed: null,
        sample: null,
        message: summarizeProbeStatus(res.status, text),
      };
    }
    let data: {
      listings?: Array<{ heading?: string; price?: number; dealer?: { city?: string } }>;
      num_found?: number;
    } = {};
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      return {
        configured: true,
        ok: false,
        httpStatus: res.status,
        ...print,
        numFound: null,
        listed: null,
        sample: null,
        message: "MarketCheck returned a non-JSON body.",
      };
    }
    const raw = data.listings || [];
    const first = raw[0];
    const numFound = typeof data.num_found === "number" ? data.num_found : raw.length;
    return {
      configured: true,
      ok: true,
      httpStatus: res.status,
      ...print,
      numFound,
      listed: raw.length,
      sample: first
        ? {
            heading: first.heading || "(no heading)",
            price: typeof first.price === "number" ? first.price : null,
            city: first.dealer?.city || "unknown",
          }
        : null,
      message:
        numFound > 0
          ? `MarketCheck accepted the key. ${numFound} used cars near Tampa zip ${TAMPA_ZIP}.`
          : `MarketCheck accepted the key, but found 0 used cars near Tampa zip ${TAMPA_ZIP}.`,
    };
  } catch {
    return {
      configured: true,
      ok: false,
      httpStatus: null,
      ...print,
      numFound: null,
      listed: null,
      sample: null,
      message: "Couldn’t reach MarketCheck (network error).",
    };
  }
}

export function formatProbe(probe: MarketCheckProbe): string {
  return [
    `ok=${probe.ok}`,
    `configured=${probe.configured}`,
    `httpStatus=${probe.httpStatus ?? "n/a"}`,
    `keyLength=${probe.keyLength ?? "n/a"}`,
    `keySuffix=${probe.keySuffix ?? "n/a"}`,
    `numFound=${probe.numFound ?? "n/a"}`,
    `listed=${probe.listed ?? "n/a"}`,
    probe.sample
      ? `sample=${probe.sample.heading} $${probe.sample.price ?? "?"} (${probe.sample.city})`
      : "sample=n/a",
    probe.message,
  ].join("\n");
}
