"use client";

import { useEffect, useState } from "react";
import type { RankedRow, Vehicle } from "@/lib/types";
import { formatVehicleLine, gradeCaption, outboundLinks, vehiclePhoto, vehicleTitle } from "@/lib/format";

function PhotoLightbox({ listing, onClose }: { listing: Vehicle; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={vehicleTitle(listing)}>
      <button type="button" className="absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_72%,transparent)]" aria-label="Close photo" onClick={onClose} />
      <div className="relative z-10 flex max-h-[100svh] w-full max-w-5xl flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-20 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[var(--ink)] text-lg text-[var(--paper)]"
        >
          ×
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={vehiclePhoto(listing)} alt={vehicleTitle(listing)} className="max-h-[min(92svh,900px)] w-full rounded-2xl object-contain bg-[var(--paper)]" />
      </div>
    </div>
  );
}

export function Gallery({
  rows,
  selectedId,
  onSelect,
  graded = true,
}: {
  rows: RankedRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  graded?: boolean;
}) {
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const lightbox = rows.find((row) => row.listing.id === lightboxId)?.listing ?? null;

  if (!rows.length) {
    return (
      <p className="p-6 text-sm text-[var(--muted)]">
        {graded ? "Nothing matched those must-haves. Adjust them in Chat and confirm to search again." : "No cars near this location yet. Set must-haves in Chat."}
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
        {rows.map((row) => {
          const selected = row.listing.id === selectedId;
          const caption = gradeCaption(row.grade);
          const links = outboundLinks(row.listing);
          return (
            <article
              key={row.listing.id}
              onClick={() => onSelect(row.listing.id)}
              className={`flex flex-col overflow-hidden rounded-2xl border bg-[var(--paper-2)] shadow-sm md:flex-row md:items-start ${selected ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--line)]"}`}
            >
              <button
                type="button"
                className="relative block w-full shrink-0 overflow-hidden bg-[var(--paper)] md:w-56 lg:w-64"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxId(row.listing.id);
                }}
                aria-label={`View full photo of ${vehicleTitle(row.listing)}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={vehiclePhoto(row.listing)}
                  alt=""
                  className="h-28 w-full object-cover object-center md:aspect-[4/3] md:h-auto"
                />
                {graded ? (
                  <span className="absolute right-2 top-2 rounded-full bg-[var(--ink)] px-2.5 py-1 text-xs text-[var(--paper)]">
                    {caption.score} {caption.word}
                  </span>
                ) : (
                  <span className="absolute right-2 top-2 rounded-full bg-[var(--ink)] px-2.5 py-1 text-xs text-[var(--paper)]">Nearby</span>
                )}
              </button>
              <div className="min-w-0 flex-1 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-lg leading-tight">{vehicleTitle(row.listing)}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {row.listing.city}, {row.listing.state} {row.listing.zip}
                      {row.listing.dealer ? ` · ${row.listing.dealer}` : ""}
                    </p>
                  </div>
                </div>
                {row.grade.why ? <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">{row.grade.why}</p> : null}
                <p className="mt-3 text-sm">{formatVehicleLine(row.listing)}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {links.map((link) => (
                    <a
                      key={link.name}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-full border border-[var(--line)] px-3 py-1"
                    >
                      {link.name}
                    </a>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {lightbox ? <PhotoLightbox listing={lightbox} onClose={() => setLightboxId(null)} /> : null}
    </>
  );
}
