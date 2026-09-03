"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Gallery } from "@/components/Gallery";
import { ViewToggle } from "@/components/ViewToggle";
import { formatMustHaves, INTAKE_SUGGESTIONS, introMessage } from "@/lib/chat";
import { hasMustHaves, isImpressionMatrix } from "@/lib/grade";
import { formatVehicleLine, gradeCaption, outboundLinks, readPhoneLocation, resultsHeadline, vehiclePhoto, vehicleTitle } from "@/lib/format";
import { originFromCoords, TAMPA } from "@/lib/location";
import { encodeShare, readLayoutMode, readStoredSession, shareUrlFromToken, writeLayoutMode, writeStoredSession } from "@/lib/session";
import type { LayoutMode, MustHaveMatrix, RankedRow, SearchMode, Vehicle } from "@/lib/types";
import { emptyIntakeMatrix } from "@/lib/types";

const Map = dynamic(() => import("@/components/ResultsMap").then((m) => m.ResultsMap), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">Loading map…</div>,
});

function ChatSheet({
  matrix,
  invite,
  searching,
  onClose,
  onDraft,
  onConfirm,
}: {
  matrix: MustHaveMatrix;
  invite: boolean;
  searching: boolean;
  onClose?: () => void;
  onDraft: (matrix: MustHaveMatrix) => void;
  onConfirm: (matrix: MustHaveMatrix) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", content: introMessage(matrix.searchArea) }]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 1 && current[0]?.role === "assistant") {
        return [{ role: "assistant", content: introMessage(matrix.searchArea) }];
      }
      return current;
    });
  }, [matrix.searchArea]);

  async function send(raw: string, confirm = false) {
    const value = raw.trim();
    if (!value || busy || searching) return;
    setText("");
    setBusy(true);
    if (!confirm) setMessages((m) => [...m, { role: "user", content: value }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: value,
          draft: matrix,
          confirm,
          history: messages.slice(-8).map((msg) => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.content,
          })),
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        matrix?: MustHaveMatrix;
        rescore?: boolean;
        awaitingConfirm?: boolean;
      };
      const reply = data.reply ?? "Send that again.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (data.matrix && data.rescore) onConfirm(data.matrix);
      else if (data.matrix) onDraft(data.matrix);
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
        {messages.length <= 2 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {INTAKE_SUGGESTIONS.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={busy || searching}
                className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1 text-xs text-[var(--ink)] disabled:opacity-50"
                onClick={() => void send(item.text)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <form
        className="shrink-0 border-t border-[var(--line)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <textarea
          value={text}
          autoComplete="off"
          enterKeyHint="send"
          rows={2}
          placeholder="SUV, $45k, AWD…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          className={`w-full rounded-xl border bg-[var(--paper)] px-3 py-2 text-base ${invite ? "chat-composer-pulse border-[var(--accent)]" : "border-[var(--line)]"}`}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {onClose ? (
            <button type="button" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--line)] px-4 text-base sm:hidden" onClick={onClose}>
              Done
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--ink)] px-4 text-base text-[var(--paper)] disabled:opacity-50"
            disabled={busy || searching}
            onClick={() => void send("search", true)}
          >
            {searching ? "Searching…" : "Search"}
          </button>
          <button className="inline-flex min-h-11 flex-[0.7] items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-base text-white disabled:opacity-50" type="submit" disabled={busy || searching}>
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
    <div ref={root} className="fixed z-[2000] flex items-end overflow-hidden sm:items-end sm:justify-end sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_18%,transparent)]"
        aria-label="Close chat"
        onClick={() => {
          if (Date.now() - openedAt.current < 400) return;
          onClose();
        }}
      />
      <div
        role="dialog"
        aria-label="Tell Chat what you need"
        aria-modal="true"
        className={`relative z-10 flex w-full min-h-0 flex-col overflow-hidden rounded-t-2xl border border-[var(--line)] bg-[var(--paper-2)] shadow-xl sm:mb-12 sm:mr-2 sm:h-[min(28rem,calc(100svh-5rem))] sm:max-h-[calc(100svh-5rem)] sm:w-[24rem] sm:rounded-2xl sm:pt-0 ${keyboard ? "h-full max-h-full pt-0" : "h-[min(52%,26rem)] max-h-[min(52%,28rem)] pt-1"}`}
      >
        <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--paper-2)] px-3 py-2">
          <p className="text-base font-medium">What are you looking for?</p>
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

function ListingCard({ listing, grade, graded = true }: RankedRow & { graded?: boolean }) {
  const links = outboundLinks(listing);
  const caption = gradeCaption(grade);
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-2)]">
      <div className="aspect-[16/10] overflow-hidden bg-[var(--paper)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={vehiclePhoto(listing)} alt={vehicleTitle(listing)} className="h-full w-full object-cover" />
      </div>
      <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg">{vehicleTitle(listing)}</p>
          <p className="text-sm text-[var(--muted)]">
            {listing.city}, {listing.state} {listing.zip}
            {listing.dealer ? ` · ${listing.dealer}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--ink)] px-2.5 py-1 text-xs text-[var(--paper)]">
          {graded ? `${caption.score} ${caption.word}` : "Nearby"}
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
      </div>
    </article>
  );
}

export function Workspace({ initialMatrix }: { initialMatrix?: MustHaveMatrix }) {
  const [matrix, setMatrix] = useState<MustHaveMatrix>(initialMatrix ?? emptyIntakeMatrix());
  const [rows, setRows] = useState<RankedRow[]>([]);
  const [matched, setMatched] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [keyboard, setKeyboard] = useState(false);
  const [invite, setInvite] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [source, setSource] = useState<"live" | "sample" | "session">("sample");
  const [notice, setNotice] = useState<{ level: "error" | "warning"; message: string } | null>(null);
  const [sharedBanner, setSharedBanner] = useState(false);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [hasOwnList, setHasOwnList] = useState(false);
  const [layout, setLayout] = useState<LayoutMode>("gallery");

  function changeLayout(next: LayoutMode) {
    setLayout(next);
    writeLayoutMode(next);
  }

  const openChat = useCallback(() => {
    setInvite(false);
    setChatOpen(true);
  }, []);
  const closeChat = useCallback(() => {
    setChatOpen(false);
    setKeyboard(false);
    setInvite((on) => on);
  }, []);

  async function runSearch(
    next: MustHaveMatrix,
    mode: SearchMode,
    options: { listings?: Vehicle[]; loc?: { lat: number; lng: number } | null; ownList?: boolean } = {},
  ) {
    setSearching(true);
    try {
      const ownList = options.ownList ?? hasOwnList;
      const loc = options.loc === undefined ? here : options.loc;
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matrix: next,
          mode,
          listings: ownList ? options.listings : undefined,
          lat: loc?.lat,
          lng: loc?.lng,
        }),
      });
      const data = (await res.json()) as {
        results?: RankedRow[];
        listings?: Vehicle[];
        totalMatched?: number;
        source?: "live" | "sample" | "session";
        origin?: { label?: string };
        notice?: { level?: "error" | "warning"; message?: string };
        error?: string;
      };
      if (!res.ok) {
        setNotice({ level: "error", message: typeof data.error === "string" ? data.error : `Search failed (HTTP ${res.status}).` });
        setRows([]);
        return;
      }
      const results = data.results ?? [];
      setRows(results);
      setMatched(data.totalMatched ?? results.length);
      setSelected(results[0]?.listing.id ?? null);
      if (data.source) setSource(data.source);
      setNotice(data.notice?.message ? { level: data.notice.level === "error" ? "error" : "warning", message: data.notice.message } : null);
      const withArea = data.origin?.label ? { ...next, searchArea: data.origin.label } : next;
      setMatrix(withArea);
      writeStoredSession({
        matrix: withArea,
        listings: data.listings ?? results.map((row) => row.listing),
        hasOwnList: ownList,
        confirmed: mode === "grade",
      });
    } catch {
      setNotice({ level: "error", message: "Couldn’t reach search. Check your connection and try Search again." });
      setRows([]);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("shared") === "1") {
      setSharedBanner(true);
      window.history.replaceState({}, "", "/app");
    }
    const stored = readStoredSession();
    setLayout(stored.confirmed ? readLayoutMode() : "gallery");
    if (stored.hasOwnList) setHasOwnList(true);
    void (async () => {
      const loc = await readPhoneLocation();
      if (loc) setHere(loc);
      const area = originFromCoords(loc).label;
      if (stored.confirmed && stored.matrix && hasMustHaves(stored.matrix) && !isImpressionMatrix(stored.matrix)) {
        setMatrix(stored.matrix);
        setConfirmed(true);
        setInvite(false);
        setChatOpen(false);
        await runSearch(stored.matrix, "grade", {
          listings: stored.listings,
          loc,
          ownList: stored.hasOwnList,
        });
        return;
      }
      const start = emptyIntakeMatrix(area);
      setMatrix(start);
      setChatOpen(true);
    })();
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

  useEffect(() => {
    if (confirmed || chatOpen) return;
    setInvite(true);
  }, [confirmed, chatOpen]);

  const mapHere = here ?? { lat: TAMPA.lat, lng: TAMPA.lng };
  const graded = confirmed;
  const headline = searching
    ? "Searching…"
    : graded
      ? resultsHeadline(rows.length, matched)
      : `Near ${matrix.searchArea}`;

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
          Chat first. We’ll search near {matrix.searchArea} after you say what you need.
        </p>
      )}
      {notice ? (
        <div className={`flex shrink-0 items-start justify-between gap-3 border-b px-3 py-2 text-sm ${notice.level === "error" ? "border-red-300 bg-red-50 text-red-950" : "border-[var(--line)] bg-[var(--paper-2)] text-[var(--ink)]"}`}>
          <p>{notice.message}</p>
          <button type="button" className="shrink-0 text-xs text-[var(--muted)]" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">{headline}</p>
        <ViewToggle mode={layout} onChange={changeLayout} />
        <CopyLink matrix={matrix} listings={rows.map((row) => row.listing)} />
      </div>
      <div className="relative min-h-0 flex-1 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:p-3">
        {layout === "gallery" ? (
          <div className="h-full min-h-0 overflow-y-auto rounded-3xl border-2 border-[var(--line)] bg-[color-mix(in_oklab,var(--ink)_7%,var(--paper))]">
            <Gallery
              rows={rows}
              selectedId={selected}
              onSelect={setSelected}
              graded={graded}
              emptyMessage={
                notice?.message ||
                (graded
                  ? "Nothing matched those must-haves. Adjust them in Chat and search again."
                  : "Your shortlist will show up here after Search.")
              }
            />
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-2 rounded-3xl border-2 border-[var(--line)] bg-[color-mix(in_oklab,var(--ink)_7%,var(--paper))] p-2 md:flex-row md:gap-3 md:p-3">
            <section className="relative min-h-0 min-w-0 flex-1">
              <div className="absolute inset-0 overflow-hidden rounded-2xl border-2 border-[var(--ink)]/25 bg-[var(--paper-2)] shadow-sm">
                <Map
                  rows={rows}
                  selectedId={selected}
                  onSelect={setSelected}
                  layoutTick={`${chatOpen ? "chat" : "map"}:${rows.length}:${layout}`}
                  here={mapHere}
                  lockToHere={rows.length === 0 || (!!here && !hasOwnList)}
                />
              </div>
            </section>
            <section className="flex h-[min(42svh,22rem)] min-h-[11rem] w-full shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-[var(--ink)]/25 bg-[var(--paper-2)] shadow-sm md:h-full md:min-h-0 md:w-[22rem] md:flex-none xl:w-[26rem]">
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {rows.length ? (
                <div className="space-y-3">
                  {rows.map((row) => (
                    <div key={row.listing.id} onClick={() => setSelected(row.listing.id)} className={row.listing.id === selected ? "rounded-2xl ring-2 ring-[var(--accent)]" : ""}>
                      <ListingCard listing={row.listing} grade={row.grade} graded={graded} />
                    </div>
                  ))}
                </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">Your shortlist will show up here after Search.</p>
                )}
              </div>
            </section>
          </div>
        )}
        {searching ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[color-mix(in_oklab,var(--paper)_55%,transparent)] text-sm font-medium">
            Searching and grading…
          </div>
        ) : null}
        {chatOpen ? null : <ChatFab className="absolute bottom-5 right-5 z-20" nudge={invite && !confirmed} onClick={openChat} />}
      </div>
      <ChatModal open={chatOpen} onClose={closeChat} onKeyboard={setKeyboard}>
        <ChatSheet
          matrix={matrix}
          invite={invite && !confirmed}
          searching={searching}
          onClose={closeChat}
          onDraft={(next) => {
            setMatrix(next);
            writeStoredSession({ matrix: next, confirmed: false });
          }}
          onConfirm={(next) => {
            setMatrix(next);
            setConfirmed(true);
            setInvite(false);
            void runSearch(next, "grade", { loc: here }).then(() => {
              if (!keyboard) window.setTimeout(() => closeChat(), 400);
            });
          }}
        />
      </ChatModal>
    </div>
  );
}
