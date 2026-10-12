import { z } from "zod";
import { secretMatches } from "@/lib/auth";
import { runPipeline } from "@/lib/pipeline";

export const maxDuration = 300;

const Body = z.object({
  email: z.boolean().default(false),
  steps: z
    .object({ ingest: z.boolean(), extract: z.boolean(), brief: z.boolean() })
    .partial()
    .optional(),
});

/** Manual "Run ingestion now" trigger for demos. Protected by ADMIN_SECRET. */
export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-admin-secret"), "ADMIN_SECRET")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const log = await runPipeline({
    trigger: "admin",
    budgetMs: 270_000,
    sendEmail: parsed.data.email,
    steps: parsed.data.steps,
  });
  return Response.json({ ok: !log.error, ...log }, { status: log.error ? 500 : 200 });
}
