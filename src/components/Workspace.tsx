"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MustHaveMatrix, RankedRow, Vehicle } from "@/lib/types";
import { DEFAULT_MATRIX } from "@/lib/types";
import { formatMustHaves } from "@/lib/chat";
import { formatVehicleLine, gradeCaption, outboundLinks, readPhoneLocation, resultsHeadline, vehicleTitle } from "@/lib/format";
import { encodeShare, readStoredSession, shareUrlFromToken, writeStoredSession } from "@/lib/session";

const Map = dynamic(() => import("@/components/ResultsMap").then((m) => m.ResultsMap), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">Loading map…</div>,
});

function ChatSheet({
  matrix,
  invite,
  onClose,
  onResult,
}: {
  matrix: MustHaveMatrix;
  invite: boolean;
  onClose?: () => void;
  onResult: (matrix: MustHaveMatrix) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", content: "You’re looking at a sample Tampa-area list (used SUVs around $35k, 80k miles, 2018+). Tell me body style, budget, miles, year, AWD, seats, CarPlay." }]);

  async function send() {
    const value = text.trim();
    if (!value || busy) return;
    setText("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: value }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, draft: matrix }),
      });
      const data = (await res.json()) as { reply?: string; matrix?: MustHaveMatrix };
      const reply = data.reply ?? "Send that again.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (data.matrix) onResult(data.matrix);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn’t reach chat just then. Send that again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-sm">
        <p className="mb-3 text-xs text-[var(--muted)]">{formatMustHaves(matrix)}</p>
        {messages.map((msg, i) => (
          <p key={i} className={`mb-3 ${msg.role === "user" ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
            {msg.content}
          </p>
        ))}
      </div>
      <form
        className="shrink-0 border-t border-[var(--line)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={text}
          autoComplete="off"
          enterKeyHint="send"
          rows={2}
          placeholder="SUV, under 25k, AWD, CarPlay, Tampa…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          className={`w-full rounded-xl border bg-[var(--paper)] px-3 py-2 text-base ${invite ? "chat-composer-pulse border-[var(--accent)]" : "border-[var(--line)]"}`}
        />
        <div className="mt-2 flex gap-2">
          {onClose ? (
            <button type="button" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--line)] px-4 text-base sm:hidden" onClick={onClose}>
              Done
            </button>
          ) : null}
          <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-base text-white disabled:opacity-50" type="submit" disabled={busy}>
            {busy ? "On it…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChatModal({
  open,
  onClose,
  onKeyboard,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onKeyboard: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setKeyboard(false);
      onKeyboard(false);
      return;
    }
    const el = root.current;
    if (!el) return;
    const layout = () => {
      window.scrollTo(0, 0);
      const vv = window.visualViewport;
      const width = Math.max(1, Math.round(vv?.width || window.innerWidth || 320));
      const height = Math.max(1, Math.round(vv?.height || window.innerHeight || 320));
      el.style.position = "fixed";
      el.style.top = `${Math.round(vv?.offsetTop ?? 0)}px`;
      el.style.left = `${Math.round(vv?.offsetLeft ?? 0)}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
      const openKb = !!(vv && (window.innerHeight - vv.height > 80 || vv.offsetTop > 20));
      setKeyboard(openKb);
      onKeyboard(openKb);
    };
    layout();
    const t1 = window.setTimeout(layout, 50);
    const t2 = window.setTimeout(layout, 300);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", layout);
    vv?.addEventListener("scroll", layout);
    window.addEventListener("scroll", layout, { passive: true });
    window.addEventListener("resize", layout);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      vv?.removeEventListener("resize", layout);
      vv?.removeEventListener("scroll", layout);
      window.removeEventListener("scroll", layout);
      window.removeEventListener("resize", layout);
    };
  }, [open, onKeyboard]);

  if (!open) return null;

  return (
    <div ref={root} className="fixed z-[2000] flex items-end overflow-hidden sm:items-center sm:justify-end sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_35%,transparent)]"
        aria-label="Close chat"
        onClick={() => {
          if (Date.now() - openedAt.current < 900) return;
          onClose();
        }}
      />
      <div
        role="dialog"
        aria-label="Tell Chat your must-haves"
        aria-modal="true"
        className={`relative z-10 flex w-full min-h-0 flex-col overflow-hidden rounded-t-2xl border border-[var(--line)] bg-[var(--paper-2)] shadow-xl sm:h-[min(36rem,calc(100svh-3rem))] sm:max-h-[calc(100svh-3rem)] sm:w-[26rem] sm:rounded-2xl sm:pt-0 ${keyboard ? "h-full max-h-full pt-0" : "h-[92%] max-h-full pt-[env(safe-area-inset-top)]"}`}
      >
        <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--paper-2)] px-3 py-2">
          <p className="text-base font-medium">Tell Chat your must-haves</p>
          <button type="button" className="inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-xl bg-[var(--ink)] px-4 text-base font-medium text-[var(--paper)]" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

function ChatFab({ onClick, className = "", nudge = false }: { onClick: () => void; className?: string; nudge?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Tell Chat your must-haves"
      title="Tell Chat your must-haves"
      className={`inline-flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-sm font-medium text-white shadow-lg ring-2 ring-white/70 hover:opacity-95 ${nudge ? "chat-bounce" : ""} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" strokeLinejoin="round" />
      </svg>
      Chat
    </button>
  );
}

function CopyLink({ matrix, listings }: { matrix: MustHaveMatrix; listings: Vehicle[] }) {
  const [state, setState] = useState<"idle" | "copied" | "err">("idle");
  if (!listings.length) return null;

  async function copy() {
    try {
      const url = shareUrlFromToken(await encodeShare(matrix, listings));
      if (window.matchMedia("(max-width: 767px)").matches && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "Shortlist Autos", text: "Here’s our scored car shortlist.", url });
          setState("copied");
          window.setTimeout(() => setState("idle"), 2000);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("err");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }

  return (
    <button type="button" onClick={() => void copy()} className="shrink-0 text-xs font-medium text-[var(--accent)]">
      {state === "copied" ? "Copied" : state === "err" ? "Couldn’t copy" : "Copy link"}
    </button>
  );
}

function ListingCard({ listing, grade }: RankedRow) {
  const links = outboundLinks(listing);
  const caption = gradeCaption(grade);
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg">{vehicleTitle(listing)}</p>
          <p className="text-sm text-[var(--muted)]">
            {listing.city}, {listing.state} {listing.zip}
            {listing.dealer ? ` · ${listing.dealer}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--ink)] px-2.5 py-1 text-xs text-[var(--paper)]">
          {caption.score} {caption.word}
        </span>
      </div>
      {grade.why ? <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">{grade.why}</p> : null}
      <p className="mt-3 text-sm">{formatVehicleLine(listing)}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {links.map((link) => (
          <a key={link.name} href={link.href} target="_blank" rel="noreferrer" className="rounded-full border border-[var(--line)] px-3 py-1">
            {link.name}
          </a>
        ))}
      </div>
    </article>
  );
}

export function Workspace({ initialMatrix }: { initialMatrix?: MustHaveMatrix }) {
  const [matrix, setMatrix] = useState<MustHaveMatrix>(initialMatrix ?? DEFAULT_MATRIX);
  const [rows, setRows] = useState<RankedRow[]>([]);
  const [matched, setMatched] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [invite, setInvite] = useState(true);
  const [sharedBanner, setSharedBanner] = useState(false);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [hasOwnList, setHasOwnList] = useState(false);

  const openChat = useCallback(() => {
    setInvite(false);
    setChatOpen(true);
  }, []);
  const closeChat = useCallback(() => {
    setChatOpen(false);
    setKeyboard(false);
  }, []);

  async function rescore(next: MustHaveMatrix, listings?: Vehicle[]) {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matrix: next, listings }),
    });
    const data = (await res.json()) as { results?: RankedRow[]; listings?: Vehicle[]; totalMatched?: number };
    const results = data.results ?? [];
    setRows(results);
    setMatched(data.totalMatched ?? results.length);
    setSelected(results[0]?.listing.id ?? null);
    writeStoredSession({
      matrix: next,
      listings: data.listings ?? results.map((row) => row.listing),
      hasOwnList,
    });
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("shared") === "1") {
      setSharedBanner(true);
      window.history.replaceState({}, "", "/app");
    }
    const stored = readStoredSession();
    const start = stored.matrix ?? matrix;
    if (stored.matrix) setMatrix(stored.matrix);
    if (stored.hasOwnList) setHasOwnList(true);
    void rescore(start, stored.listings.length ? stored.listings : undefined);
    void readPhoneLocation().then((loc) => loc && setHere(loc));
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {sharedBanner ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--paper-2)] px-3 py-2 text-sm">
          <p>Someone shared this shortlist with you.</p>
          <button type="button" className="text-xs text-[var(--muted)]" onClick={() => setSharedBanner(false)}>
            Dismiss
          </button>
        </div>
      ) : (
        <p className="hidden shrink-0 border-b border-[var(--line)] px-3 py-2 text-sm md:block">
          Sample Tampa-area cars. Set must-haves in{" "}
          <button type="button" className="font-medium underline" onClick={openChat}>
            Chat
          </button>
          .
        </p>
      )}
      <div className="min-h-0 flex-1 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:p-3">
        <div className="flex h-full min-h-0 flex-col gap-2 rounded-3xl border-2 border-[var(--line)] bg-[color-mix(in_oklab,var(--ink)_7%,var(--paper))] p-2 md:flex-row md:gap-3 md:p-3">
          <section className="relative min-h-0 min-w-0 flex-1">
            <div className="absolute inset-0 overflow-hidden rounded-2xl border-2 border-[var(--ink)]/25 bg-[var(--paper-2)] shadow-sm">
              <Map
                rows={rows}
                selectedId={selected}
                onSelect={setSelected}
                layoutTick={`${chatOpen ? "chat" : "map"}:${rows.length}`}
                here={here}
                lockToHere={!!here && !hasOwnList}
              />
            </div>
            {chatOpen ? null : <ChatFab className="absolute bottom-3 right-3 z-20" nudge={invite} onClick={openChat} />}
          </section>
          <section className="flex h-[min(42svh,22rem)] min-h-[11rem] w-full shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-[var(--ink)]/25 bg-[var(--paper-2)] shadow-sm md:h-full md:min-h-0 md:w-[22rem] md:flex-none xl:w-[26rem]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
              <p className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">{resultsHeadline(rows.length, matched)}</p>
              <CopyLink matrix={matrix} listings={rows.map((row) => row.listing)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="space-y-3">
                {rows.map((row) => (
                  <div key={row.listing.id} onClick={() => setSelected(row.listing.id)} className={row.listing.id === selected ? "rounded-2xl ring-2 ring-[var(--accent)]" : ""}>
                    <ListingCard listing={row.listing} grade={row.grade} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
      <ChatModal open={chatOpen} onClose={closeChat} onKeyboard={setKeyboard}>
        <ChatSheet
          matrix={matrix}
          invite={invite}
          onClose={closeChat}
          onResult={(next) => {
            setMatrix(next);
            writeStoredSession({ matrix: next });
            void rescore(next);
            if (!keyboard) window.setTimeout(() => closeChat(), 650);
          }}
        />
      </ChatModal>
    </div>
  );
}
