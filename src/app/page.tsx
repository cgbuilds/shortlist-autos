import { AuthPanel } from "@/components/AuthPanel";

export default function HomePage() {
  return (
    <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-12 px-4 py-16 lg:grid-cols-2">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Shortlist Autos</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-tight">Score cars against must-haves you set in chat.</h1>
        <p className="mt-4 max-w-md text-[var(--muted)]">
          Chat opens first, small, over the map. We already know the area. The list stays empty until you press Search. Sister app: homes at shortlist.casa.
        </p>
      </div>
      <div className="rounded-3xl border border-[var(--line)] bg-[var(--paper-2)] p-6 shadow-sm">
        <AuthPanel />
      </div>
    </div>
  );
}
