import type { LayoutMode, MustHaveMatrix, Vehicle } from "@/lib/types";
import { LAYOUT_KEY, SESSION_KEY } from "@/lib/types";
import { looksLikeMatrix, sanitizeVehicles } from "@/lib/grade";

export type StoredSession = {
  listings: Vehicle[];
  matrix?: MustHaveMatrix;
  savedAt: number;
  hasOwnList?: boolean;
};

export function readStoredSession(): StoredSession {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { listings: [], savedAt: 0 };
    const parsed = JSON.parse(raw) as StoredSession;
    return {
      listings: sanitizeVehicles(parsed.listings),
      matrix: looksLikeMatrix(parsed.matrix) ? parsed.matrix : undefined,
      savedAt: parsed.savedAt ?? 0,
      hasOwnList: parsed.hasOwnList === true,
    };
  } catch {
    return { listings: [], savedAt: 0 };
  }
}

export function readLayoutMode(): LayoutMode {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (raw === "split" || raw === "gallery") return raw;
  } catch {
    /* ignore */
  }
  return "gallery";
}

export function writeLayoutMode(mode: LayoutMode): void {
  try {
    window.localStorage.setItem(LAYOUT_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function writeStoredSession(patch: Partial<StoredSession>): void {
  const current = readStoredSession();
  const next = JSON.stringify({
    listings: patch.listings ?? current.listings,
    matrix: patch.matrix ?? current.matrix,
    savedAt: Date.now(),
    hasOwnList: patch.hasOwnList ?? current.hasOwnList,
  });
  try {
    window.localStorage.setItem(SESSION_KEY, next);
    window.sessionStorage.setItem(SESSION_KEY, next);
  } catch {
    /* ignore quota */
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(token: string): Uint8Array {
  const pad = token.length % 4 === 0 ? "" : "=".repeat(4 - (token.length % 4));
  const bin = atob(token.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeShare(matrix: MustHaveMatrix, listings: Vehicle[]): Promise<string> {
  const payload = JSON.stringify({ v: 1, matrix, listings: listings.slice(0, 10) });
  return `s1.${toBase64Url(await deflate(new TextEncoder().encode(payload)))}`;
}

export async function decodeShare(hash: string): Promise<{ v: 1; matrix: MustHaveMatrix; listings: Vehicle[] } | null> {
  const token = hash.trim().replace(/^#/, "");
  if (!token.startsWith("s1.")) return null;
  try {
    const json = new TextDecoder().decode(await inflate(fromBase64Url(token.slice(3))));
    const parsed = JSON.parse(json) as { v: number; matrix: unknown; listings: unknown };
    if (parsed.v !== 1 || !looksLikeMatrix(parsed.matrix)) return null;
    const listings = sanitizeVehicles(parsed.listings);
    if (!listings.length) return null;
    return { v: 1, matrix: parsed.matrix, listings };
  } catch {
    return null;
  }
}

export function shareUrlFromToken(token: string, origin = ""): string {
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
  return `${base}/s#${token}`;
}
