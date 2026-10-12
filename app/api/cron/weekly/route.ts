import { isCronRequest } from "@/lib/auth";
import { runPipeline } from "@/lib/pipeline";

// Vercel Hobby/Pro with Fluid Compute allow up to 300s.
export const maxDuration = 300;

/** Monday 00:30 UTC (06:00 IST): ingest, extract, analyze, write the brief and email it. */
export async function GET(req: Request) {
  if (!isCronRequest(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const log = await runPipeline({ trigger: "cron:weekly", budgetMs: 270_000, sendEmail: true });
  return Response.json(
    { ok: !log.error, ...log, ingest: log.ingest && { ...log.ingest, results: undefined } },
    { status: log.error ? 500 : 200 },
  );
}
