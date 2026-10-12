import { showStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null | undefined) =>
  d
    ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : "never";

export default async function Shows() {
  const shows = await showStats();
  const enabled = shows.filter((s) => s.enabled);
  const disabled = shows.filter((s) => !s.enabled);
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Monitored shows</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Loaded from <code className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-sm">config/shows.json</code>. Add,
        remove or disable a show by editing that file; no code changes needed.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {enabled.map((s) => (
          <div key={s.id} className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg font-semibold leading-snug">{s.name}</h2>
              <span
                className={`mt-1 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  s.stats?.last_status === "error" ? "bg-guests-soft text-guests" : "bg-topics-soft text-topics"
                }`}
              >
                {s.stats?.last_status === "error" ? "feed error" : s.stats?.last_status ? "feed ok" : "not fetched"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Episodes</dt>
                <dd className="font-display text-2xl font-semibold">{s.stats?.episodes ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Extracted</dt>
                <dd className="font-display text-2xl font-semibold">{s.stats?.extracted ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Latest episode</dt>
                <dd className="mt-1.5 text-ink-2">{fmt(s.stats?.last_episode_at).split(",")[0]}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted">
              Last processed {fmt(s.stats?.last_processed_at)} · feed checked {fmt(s.stats?.last_fetched_at)}
            </p>
            {s.stats?.last_error && <p className="mt-2 text-xs text-guests">{s.stats.last_error}</p>}
            <a href={s.rss_url} target="_blank" rel="noreferrer" className="mt-3 block truncate font-mono text-[11px] text-muted hover:text-ink">
              {s.rss_url}
            </a>
          </div>
        ))}
      </div>
      {disabled.length > 0 && (
        <p className="mt-8 text-sm text-muted">
          Disabled in config: {disabled.map((s) => s.name).join(", ")}
        </p>
      )}
    </div>
  );
}
