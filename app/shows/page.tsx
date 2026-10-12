import { Card, PageHeader } from "@/components/ui";
import { showStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null | undefined, withTime = true) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
        timeZone: "Asia/Kolkata",
      })
    : "never";

export default async function Shows() {
  const shows = await showStats();
  const enabled = shows.filter((s) => s.enabled);
  const disabled = shows.filter((s) => !s.enabled);
  const totalEpisodes = enabled.reduce((n, s) => n + (s.stats?.episodes ?? 0), 0);

  return (
    <div>
      <PageHeader eyebrow={`${enabled.length} shows · ${totalEpisodes} episodes tracked`} title="Monitored shows.">
        Loaded from{" "}
        <code className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-text">
          config/shows.json
        </code>
        . Add, remove or pause a show by editing that file, with no code changes.
      </PageHeader>

      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {enabled.map((s, i) => {
          const status = s.stats?.last_status;
          return (
            <li key={s.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 9) * 40}ms` }}>
              <Card interactive className="flex h-full flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.01em]">{s.name}</h2>
                  <span
                    className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      status === "error" ? "bg-danger-soft text-danger" : status ? "bg-topics-soft text-topics" : "bg-surface-strong text-muted"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${status === "error" ? "bg-danger" : status ? "bg-topics" : "bg-faint"}`}
                    />
                    {status === "error" ? "Feed error" : status ? "Healthy" : "Not fetched"}
                  </span>
                </div>

                <dl className="mt-6 grid grid-cols-3 gap-4">
                  <Stat label="Episodes" value={s.stats?.episodes ?? 0} />
                  <Stat label="Extracted" value={s.stats?.extracted ?? 0} />
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.12em] text-muted">Latest</dt>
                    <dd className="mt-2 text-sm text-text-2">{fmt(s.stats?.last_episode_at, false)}</dd>
                  </div>
                </dl>

                <p className="mt-6 text-xs leading-relaxed text-muted">
                  Processed {fmt(s.stats?.last_processed_at)} · checked {fmt(s.stats?.last_fetched_at)}
                </p>
                {s.stats?.last_error && <p className="mt-2 text-xs text-danger">{s.stats.last_error}</p>}

                <a
                  href={s.rss_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto block truncate pt-4 font-mono text-[11px] text-faint transition-colors duration-200 ease-fluid hover:text-text-2"
                >
                  {s.rss_url}
                  <span className="sr-only"> (RSS feed, opens in a new tab)</span>
                </a>
              </Card>
            </li>
          );
        })}
      </ul>

      {disabled.length > 0 && (
        <p className="mt-10 text-sm text-muted">
          Paused in config: <span className="text-text-2">{disabled.map((s) => s.name).join(", ")}</span>
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</dd>
    </div>
  );
}
