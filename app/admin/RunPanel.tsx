"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

type Result = Record<string, unknown> & { ok?: boolean; error?: string };

export function RunPanel() {
  const router = useRouter();
  const secretId = useId();
  const emailId = useId();
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
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
      <div aria-hidden className="hero-glow pointer-events-none absolute inset-0 opacity-70" />
      <form
        className="relative flex flex-col gap-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!running && secret) run();
        }}
      >
        <div className="flex-1">
          <label htmlFor={secretId} className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Admin secret
          </label>
          <input
            id={secretId}
            type="password"
            autoComplete="current-password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter ADMIN_SECRET"
            className="mt-2 w-full rounded-xl border border-border bg-bg/60 px-4 py-3 font-mono text-sm text-text placeholder:text-faint transition-[border-color,box-shadow] duration-200 ease-fluid hover:border-border-strong focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-soft)] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={running || !secret}
          className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl bg-text px-6 text-sm font-semibold text-bg transition-[transform,opacity,background-color] duration-200 ease-fluid hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100"
        >
          {running && <Spinner />}
          {running ? "Running…" : "Run ingestion now"}
        </button>
      </form>

      <div className="relative mt-5 flex items-center gap-2.5">
        <input
          id={emailId}
          type="checkbox"
          checked={email}
          onChange={(e) => setEmail(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-[var(--accent)]"
        />
        <label htmlFor={emailId} className="cursor-pointer text-sm text-text-2">
          Also email the brief to the configured recipients
        </label>
      </div>

      <div aria-live="polite" className="relative">
        {running && (
          <p className="mt-6 text-sm text-muted">
            Fetching feeds and calling Gemini. A full run takes 30 seconds to a few minutes.
            {started ? <Elapsed since={started} /> : null}
          </p>
        )}
        {result && (
          <div className="mt-6 animate-rise">
            <p className={`inline-flex items-center gap-2 text-sm font-medium ${result.ok ? "text-topics" : "text-danger"}`}>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${result.ok ? "bg-topics" : "bg-danger"}`} />
              {result.ok ? "Run complete" : result.error ?? "Run failed"}
            </p>
            <pre className="mt-3 max-h-80 overflow-auto rounded-xl border border-border bg-bg/70 p-4 font-mono text-xs leading-relaxed text-text-2">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="ml-1 font-mono tabular-nums">({Math.round((now - since) / 1000)}s)</span>;
}
