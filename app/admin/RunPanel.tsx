"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Result = Record<string, unknown> & { ok?: boolean; error?: string };

export function RunPanel() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [email, setEmail] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [started, setStarted] = useState<number | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    setStarted(Date.now());
    try {
      const res = await fetch("/api/admin/run", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as Result;
      setResult(res.status === 401 ? { ok: false, error: "Wrong admin secret." } : body);
      router.refresh();
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-8 rounded-3xl border border-line bg-card p-6 sm:p-8">
      <form
        className="flex flex-col gap-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!running && secret) run();
        }}
      >
        <label className="flex-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Admin secret</span>
          <input
            type="password"
            autoComplete="current-password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 font-mono text-sm outline-none focus:border-radar"
            placeholder="ADMIN_SECRET"
          />
        </label>
        <button
          type="submit"
          disabled={running || !secret}
          className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-40"
        >
          {running ? "Running…" : "Run ingestion now"}
        </button>
      </form>
      <label className="mt-4 flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="accent-radar" />
        Also email the brief to the configured recipients
      </label>
      {running && (
        <p className="mt-5 text-sm text-muted">
          Fetching feeds and calling Gemini… a full run takes 30 seconds to a few minutes.
          {started ? <Elapsed since={started} /> : null}
        </p>
      )}
      {result && (
        <pre
          className={`mt-5 max-h-80 overflow-auto rounded-xl p-4 font-mono text-xs leading-relaxed ${
            result.ok ? "bg-topics-soft" : "bg-guests-soft"
          }`}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="ml-1 font-mono">({Math.round((now - since) / 1000)}s)</span>;
}
