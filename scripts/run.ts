/**
 * Run the pipeline locally (or against any DATABASE_URL) from the terminal.
 *   npm run pipeline                 # ingest + extract + brief, no email
 *   npm run pipeline -- --email      # also send the email
 *   npm run pipeline -- --only=ingest,extract
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

async function main() {
  const { runPipeline } = await import("@/lib/pipeline");
  const { closeDb } = await import("@/lib/db");
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
  const steps = only
    ? { ingest: only.includes("ingest"), extract: only.includes("extract"), brief: only.includes("brief") }
    : undefined;
  const log = await runPipeline({
    trigger: "cli",
    budgetMs: 30 * 60_000,
    sendEmail: args.includes("--email"),
    steps,
  });
  await closeDb();
  if (log.error) process.exitCode = 1;
}

main();
