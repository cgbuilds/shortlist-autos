"use client";

import type { RankedRow } from "@/lib/types";
import { formatPrice, gradeCaption, vehiclePhoto, vehicleTitle } from "@/lib/format";

export function Gallery({
  rows,
  selectedId,
  onSelect,
}: {
  rows: RankedRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!rows.length) {
    return <p className="p-6 text-sm text-[var(--muted)]">No cars yet. Set must-haves in Chat.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const selected = row.listing.id === selectedId;
        const caption = gradeCaption(row.grade);
        return (
          <button
            key={row.listing.id}
            type="button"
            onClick={() => onSelect(row.listing.id)}
            className={`overflow-hidden rounded-2xl border bg-[var(--paper-2)] text-left shadow-sm ${selected ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--line)]"}`}
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-[var(--paper)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={vehiclePhoto(row.listing)} alt={vehicleTitle(row.listing)} className="h-full w-full object-cover" />
              <span className="absolute right-2 top-2 rounded-full bg-[var(--ink)] px-2.5 py-1 text-xs text-[var(--paper)]">
                {caption.score} {caption.word}
              </span>
            </div>
            <div className="p-3">
              <p className="font-[family-name:var(--font-display)] text-lg leading-tight">{vehicleTitle(row.listing)}</p>
              <p className="mt-1 text-sm text-[var(--ink)]">
                {formatPrice(row.listing.price)} · {row.listing.miles.toLocaleString()} mi
              </p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {row.listing.city}, {row.listing.state}
                {row.listing.dealer ? ` · ${row.listing.dealer}` : ""}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
