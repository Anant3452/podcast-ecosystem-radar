import { Card, EmptyState, PageHeader } from "@/components/ui";
import { recentRuns } from "@/lib/queries";
import { RunPanel } from "./RunPanel";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d
    ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : "running…";

type Log = {
  ingest?: { shows_ok: number; shows_failed: number; episodes_added: number };
  extract?: { succeeded: number; failed: number; remaining: number };
  analysis?: { guests: number; topics: number; brands: number };
  email?: { sent: boolean; error?: string };
  gemini_calls?: number;
  duration_ms?: number;
  error?: string;
};

export default async function Admin() {
  const runs = await recentRuns();
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Run the pipeline.">
        Fetch every feed, extract new episodes with Gemini Flash and rebuild this week&apos;s brief on demand.
      </PageHeader>

      <div className="mt-12">
        <RunPanel />
      </div>

      <section aria-labelledby="runs-title" className="mt-20">
        <h2 id="runs-title" className="font-display text-2xl font-semibold tracking-[-0.02em]">
          Recent runs
        </h2>
        <p className="mt-2 text-sm text-muted">Cron, admin and CLI runs, newest first. Times in IST.</p>

        {runs.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No runs yet" />
          </div>
        ) : (
          <Card className="mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
                  <tr className="border-b border-border">
                    {["Started", "Trigger", "Feeds", "New eps", "Extracted", "Gemini calls", "Result"].map((h) => (
                      <th key={h} scope="col" className="px-5 py-3.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const log = r.log as Log;
                    return (
                      <tr key={r.id} className="border-b border-border transition-colors duration-200 ease-fluid last:border-0 hover:bg-surface">
                        <td className="whitespace-nowrap px-5 py-3.5 text-text-2">{fmt(r.started_at)}</td>
                        <td className="px-5 py-3.5">
                          <span className="rounded-md bg-surface-strong px-2 py-0.5 font-mono text-[11px] text-text-2">{r.trigger}</span>
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-text-2">
                          {log.ingest ? `${log.ingest.shows_ok} ok${log.ingest.shows_failed ? ` · ${log.ingest.shows_failed} failed` : ""}` : "–"}
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-text-2">{log.ingest?.episodes_added ?? "–"}</td>
                        <td className="px-5 py-3.5 tabular-nums text-text-2">
                          {log.extract ? `${log.extract.succeeded}${log.extract.failed ? ` · ${log.extract.failed} failed` : ""}` : "–"}
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-text-2">{log.gemini_calls ?? "–"}</td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <Result ok={r.ok} log={log} finished={r.finished_at} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

function Result({ ok, log, finished }: { ok: boolean | null; log: Log; finished: Date | null }) {
  if (ok === null) return <span className="text-muted">{fmt(finished)}</span>;
  if (!ok)
    return (
      <span className="inline-flex items-center gap-1.5 text-danger" title={log.error}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger" />
        Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-topics">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-topics" />
      OK{log.duration_ms ? ` · ${Math.round(log.duration_ms / 1000)}s` : ""}
      {log.email ? (log.email.sent ? " · emailed" : " · email failed") : ""}
    </span>
  );
}
