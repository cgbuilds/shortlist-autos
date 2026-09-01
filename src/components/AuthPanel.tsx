"use client";

export function AuthPanel() {
  async function enterDemo() {
    await fetch("/api/demo", { method: "POST" });
    const next = new URLSearchParams(window.location.search).get("next") || "/app";
    window.location.href = next.startsWith("/app") ? next : "/app";
  }

  return (
    <button type="button" onClick={() => void enterDemo()} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-white">
      Continue in demo mode
    </button>
  );
}
