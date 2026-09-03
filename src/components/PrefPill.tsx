"use client";

import { useRef, useState } from "react";

export function PrefPill({
  offLabel,
  options,
  index,
  on,
  disabled,
  onToggle,
  onIndex,
}: {
  offLabel: string;
  options: Array<{ label: string }>;
  index: number;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onIndex: (index: number) => void;
}) {
  const [scrubbing, setScrubbing] = useState(false);
  const hold = useRef(0);
  const startY = useRef(0);
  const startIndex = useRef(0);
  const moved = useRef(false);

  function clampIndex(value: number) {
    return Math.max(0, Math.min(options.length - 1, value));
  }

  function clearHold() {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = 0;
  }

  function beginScrub() {
    setScrubbing(true);
    if (!on) onIndex(startIndex.current);
  }

  const from = Math.max(0, index - 2);
  const windowed = options.slice(from, from + 5);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? `${offLabel} ${options[index]?.label ?? ""}`.trim() : `${offLabel}. Tap for default. Hold and slide for other options.`}
        disabled={disabled}
        className={`touch-none rounded-full border px-2.5 py-1 text-xs leading-tight disabled:opacity-50 ${on ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]"}`}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          startY.current = e.clientY;
          startIndex.current = index;
          moved.current = false;
          clearHold();
          hold.current = window.setTimeout(() => beginScrub(), 320);
        }}
        onPointerMove={(e) => {
          if (!scrubbing) {
            if (Math.abs(e.clientY - startY.current) > 10 && hold.current) beginScrub();
            return;
          }
          const steps = Math.round((startY.current - e.clientY) / 16);
          if (steps !== 0) moved.current = true;
          onIndex(clampIndex(startIndex.current + steps));
        }}
        onPointerUp={() => {
          const wasScrubbing = scrubbing;
          clearHold();
          setScrubbing(false);
          if (!wasScrubbing && !moved.current) onToggle();
        }}
        onPointerCancel={() => {
          clearHold();
          setScrubbing(false);
        }}
      >
        {on ? options[index]?.label ?? offLabel : offLabel}
      </button>
      {scrubbing ? (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 w-max -translate-x-1/2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-2 py-1 text-[11px] shadow-md">
          {windowed.map((item, i) => {
            const real = from + i;
            return (
              <span key={`${item.label}-${real}`} className={`block text-center ${real === index ? "font-medium text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                {item.label}
              </span>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}
