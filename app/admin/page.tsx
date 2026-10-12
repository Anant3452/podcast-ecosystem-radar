import { recentRuns } from "@/lib/queries";
import { RunPanel } from "./RunPanel";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "running…";

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
      <h1 className="font-display text-4xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Run the pipeline on demand: fetch every feed, extract new episodes with Gemini Flash, and rebuild this
        week&apos;s brief. Requires the admin secret.
      </p>
      <RunPanel />

      <h2 className="mt-12 font-display text-2xl font-semibold">Recent runs</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Started (IST)</th>
              <th className="px-4 py-3 font-medium">Trigger</th>
              <th className="px-4 py-3 font-medium">Feeds</th>
              <th className="px-4 py-3 font-medium">New eps</th>
              <th className="px-4 py-3 font-medium">Extracted</th>
              <th className="px-4 py-3 font-medium">Gemini calls</th>
              <th className="px-4 py-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {runs.map((r) => {
              const log = r.log as Log;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{fmt(r.started_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.trigger}</td>
                  <td className="px-4 py-3">
                    {log.ingest ? `${log.ingest.shows_ok} ok${log.ingest.shows_failed ? ` / ${log.ingest.shows_failed} failed` : ""}` : "–"}
                  </td>
                  <td className="px-4 py-3">{log.ingest?.episodes_added ?? "–"}</td>
                  <td className="px-4 py-3">
                    {log.extract ? `${log.extract.succeeded}${log.extract.failed ? ` (${log.extract.failed} failed)` : ""}` : "–"}
                  </td>
                  <td className="px-4 py-3">{log.gemini_calls ?? "–"}</td>
                  <td className="px-4 py-3">
                    {r.ok === null ? (
                      <span className="text-muted">{fmt(r.finished_at)}</span>
                    ) : r.ok ? (
                      <span className="text-topics">
                        ok{log.duration_ms ? ` · ${Math.round(log.duration_ms / 1000)}s` : ""}
                        {log.email ? (log.email.sent ? " · emailed" : " · email failed") : ""}
                      </span>
                    ) : (
                      <span className="text-guests" title={log.error}>
                        failed
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {runs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  No runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
