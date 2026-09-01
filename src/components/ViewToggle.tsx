"use client";

import type { LayoutMode } from "@/lib/types";

export function ViewToggle({ mode, onChange }: { mode: LayoutMode; onChange: (mode: LayoutMode) => void }) {
  const btn = (id: LayoutMode, label: string) => (
    <button
      type="button"
      onClick={() => onChange(id)}
      aria-pressed={mode === id}
      className={`rounded-full px-3 py-1.5 text-sm ${mode === id ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
    >
      {label}
    </button>
  );

  return (
    <div role="group" aria-label="Layout" className="inline-flex shrink-0 rounded-full border border-[var(--line)] bg-[var(--paper)] p-0.5">
      {btn("gallery", "Gallery")}
      {btn("split", "Split view")}
    </div>
  );
}
