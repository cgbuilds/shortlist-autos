"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { decodeShare, writeStoredSession } from "@/lib/session";

export function OpenShare() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const payload = await decodeShare(window.location.hash);
      if (cancelled) return;
      if (!payload) {
        setError("That share link doesn’t look valid.");
        return;
      }
      writeStoredSession({ listings: payload.listings, matrix: payload.matrix, hasOwnList: true });
      try {
        await fetch("/api/demo", { method: "POST" });
      } catch {
        /* demo cookie is best-effort */
      }
      if (!cancelled) window.location.replace("/app?shared=1");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Shortlist Autos</p>
      {error ? (
        <>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl">Couldn’t open that shortlist</h1>
          <p className="mt-3 text-[var(--muted)]">{error}</p>
          <Link href="/" className="mt-6 text-[var(--accent)]">
            Back to Shortlist Autos
          </Link>
        </>
      ) : (
        <>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl">Opening a shared shortlist…</h1>
          <p className="mt-3 text-[var(--muted)]">Scoring those cars against the must-haves they set.</p>
        </>
      )}
    </div>
  );
}
