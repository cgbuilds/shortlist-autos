import { Workspace } from "@/components/Workspace";

export default function AppPage() {
  return (
    <div className="fixed inset-x-0 top-0 flex h-[100svh] max-h-[100dvh] w-full max-w-full min-h-0 flex-col overflow-hidden overscroll-none bg-[var(--paper)]">
      <header className="z-20 shrink-0 border-b-2 border-[var(--line)] bg-[var(--paper-2)] pt-[max(0.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <a className="font-[family-name:var(--font-display)] text-lg tracking-tight" href="/app">
            Shortlist Autos
          </a>
          <nav className="flex items-center gap-4 text-sm">
            <a href="https://shortlist.casa" className="hidden text-[var(--muted)] hover:text-[var(--ink)] sm:inline">
              Homes
            </a>
            <span className="hidden text-[var(--muted)] sm:inline">family@demo.local</span>
            <form action="/api/logout" method="post">
              <button type="submit" className="text-[var(--muted)] hover:text-[var(--ink)]">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Workspace />
      </main>
    </div>
  );
}
