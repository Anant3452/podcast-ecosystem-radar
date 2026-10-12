import { isCronRequest } from "@/lib/auth";
import { runPipeline } from "@/lib/pipeline";

export const maxDuration = 300;

/**
 * Daily ingest + extraction (no brief, no email). Spreading extraction over
 * the week keeps Monday's run short and well within the function time limit.
 */
export async function GET(req: Request) {
  if (!isCronRequest(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const log = await runPipeline({
    trigger: "cron:daily-ingest",
    budgetMs: 270_000,
    sendEmail: false,
    steps: { ingest: true, extract: true, brief: false },
  });
  return Response.json(
    { ok: !log.error, ...log, ingest: log.ingest && { ...log.ingest, results: undefined } },
    { status: log.error ? 500 : 200 },
  );
}
