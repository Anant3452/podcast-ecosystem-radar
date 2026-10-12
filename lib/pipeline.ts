import { analyze, inWindow, type EpisodeRecord } from "@/lib/analyze";
import { generateBrief, renderEmailHtml, renderMarkdown } from "@/lib/brief";
import { allShows, enabledShows, settings } from "@/lib/config";
import { db } from "@/lib/db";
import { sendBriefEmail } from "@/lib/email";
import { dropSelfBrands, ExtractionSchema, extractPending, type ExtractStats } from "@/lib/extract";
import { geminiStats } from "@/lib/gemini";
import { ingestAll, type ShowIngestResult } from "@/lib/ingest";
import { canonicalizeTopics } from "@/lib/topics";

const IST_OFFSET_MS = 5.5 * 3600_000;

/** Monday (IST calendar date) of the week containing `now`, as YYYY-MM-DD. */
export function weekOf(now: Date): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const dow = (ist.getUTCDay() + 6) % 7; // 0 = Monday
  ist.setUTCDate(ist.getUTCDate() - dow);
  return ist.toISOString().slice(0, 10);
}

/**
 * Recipients come from config/settings.json. BRIEF_RECIPIENTS (comma-separated)
 * overrides them per deployment, e.g. while Resend is in sandbox mode and can
 * only deliver to the account owner's address.
 */
export function recipients(): string[] {
  const env = process.env.BRIEF_RECIPIENTS?.split(",").map((s) => s.trim()).filter(Boolean);
  return env?.length ? env : settings.recipients;
}

export function siteUrl(): string | undefined {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : undefined;
}

export async function loadEpisodes(now: Date): Promise<EpisodeRecord[]> {
  const sql = await db();
  const maxDays = Math.max(settings.guest_window_days, settings.topic_window_days, settings.brand_window_days);
  const ids = enabledShows.map((s) => s.id);
  const rows = await sql<
    { id: string; show_id: string; show_name: string; title: string; link: string | null; published_at: Date; extraction: unknown }[]
  >`
    SELECT e.id::text, e.show_id, s.name AS show_name, e.title, e.link, e.published_at, e.extraction
    FROM episodes e JOIN shows s ON s.id = e.show_id
    WHERE e.extraction IS NOT NULL
      AND e.show_id = ANY(${ids})
      AND e.published_at > ${new Date(now.getTime() - maxDays * 86_400_000)}`;
  return rows.flatMap((r) => {
    const x = ExtractionSchema.safeParse(r.extraction);
    if (!x.success) return [];
    // Re-apply the self-brand filter so edits to config/shows.json take effect without re-extraction.
    const show = allShows.find((s) => s.id === r.show_id);
    const extraction = dropSelfBrands(x.data, [r.show_name, ...(show?.self_brands ?? [])]);
    return [{ id: r.id, show_id: r.show_id, show_name: r.show_name, title: r.title, url: r.link, published_at: new Date(r.published_at), extraction }];
  });
}

export type RunLog = {
  trigger: string;
  week_of?: string;
  ingest?: { shows_ok: number; shows_failed: number; episodes_added: number; results: ShowIngestResult[] };
  extract?: ExtractStats;
  analysis?: { guests: number; topics: number; brands: number; episodes: number };
  brief?: { generated_by: string; items: number };
  email?: { sent: boolean; id?: string; error?: string; to?: string[] };
  gemini_calls?: number;
  gemini_retries?: number;
  duration_ms?: number;
  error?: string;
};

/**
 * End-to-end weekly run: ingest -> extract -> canonicalize topics -> analyze
 * -> brief -> (email). Fits inside one serverless invocation by giving
 * extraction a time budget; anything left over is picked up by the next run.
 */
export async function runPipeline(opts: {
  trigger: string;
  budgetMs: number;
  sendEmail: boolean;
  steps?: { ingest?: boolean; extract?: boolean; brief?: boolean };
  now?: Date;
}): Promise<RunLog> {
  const started = Date.now();
  const deadline = started + opts.budgetMs;
  const steps = { ingest: true, extract: true, brief: true, ...opts.steps };
  const sql = await db();
  const callsBefore = geminiStats.calls;
  const retriesBefore = geminiStats.retries;
  const log: RunLog = { trigger: opts.trigger };
  const [{ id: runId }] = await sql<{ id: string }[]>`
    INSERT INTO runs (trigger) VALUES (${opts.trigger}) RETURNING id::text`;

  try {
    if (steps.ingest) {
      const results = await ingestAll(opts.now);
      log.ingest = {
        shows_ok: results.filter((r) => r.ok).length,
        shows_failed: results.filter((r) => !r.ok).length,
        episodes_added: results.reduce((n, r) => n + r.added, 0),
        results,
      };
    }
    if (steps.extract) {
      // Reserve ~45s for topic canonicalization, the brief call and email.
      log.extract = await extractPending({ deadline: steps.brief ? deadline - 45_000 : deadline });
    }
    if (steps.brief) {
      const now = opts.now ?? new Date();
      const week = weekOf(now);
      log.week_of = week;
      const episodes = await loadEpisodes(now);
      const weekLabels = episodes
        .filter((e) => inWindow(e, now, settings.topic_window_days))
        .flatMap((e) => e.extraction.topics);
      const topicCanon = await canonicalizeTopics(weekLabels);
      const analysis = analyze(episodes, {
        now,
        guestWindowDays: settings.guest_window_days,
        topicWindowDays: settings.topic_window_days,
        brandWindowDays: settings.brand_window_days,
        topicCanon,
      });
      log.analysis = {
        guests: analysis.guest_overlap.length,
        topics: analysis.topic_clusters.length,
        brands: analysis.brand_signals.length,
        episodes: analysis.stats.episodes_considered,
      };
      const content = await generateBrief(analysis, week);
      const url = siteUrl();
      const markdown = renderMarkdown(content, url);
      const html = renderEmailHtml(content, url);
      log.brief = {
        generated_by: content.generated_by,
        items: Object.values(content.sections).reduce((n, s) => n + s.length, 0),
      };
      await sql`
        INSERT INTO briefs (week_of, headline, markdown, html, content, analysis)
        VALUES (${week}, ${content.headline}, ${markdown}, ${html}, ${sql.json(content as never)}, ${sql.json(analysis as never)})
        ON CONFLICT (week_of) DO UPDATE SET
          created_at = now(), headline = EXCLUDED.headline, markdown = EXCLUDED.markdown,
          html = EXCLUDED.html, content = EXCLUDED.content, analysis = EXCLUDED.analysis`;

      if (opts.sendEmail) {
        try {
          const { id } = await sendBriefEmail({
            to: recipients(),
            subject: `Podcast Ecosystem Radar · week of ${week}`,
            html,
            text: markdown,
          });
          await sql`UPDATE briefs SET emailed_at = now(), email_error = NULL WHERE week_of = ${week}`;
          log.email = { sent: true, id, to: recipients() };
        } catch (err) {
          const message = (err as Error).message;
          await sql`UPDATE briefs SET email_error = ${message} WHERE week_of = ${week}`;
          log.email = { sent: false, error: message };
          console.error(`[email] ${message}`);
        }
      }
    }
  } catch (err) {
    log.error = (err as Error).message;
    console.error(`[pipeline] ${log.error}`);
  } finally {
    log.gemini_calls = geminiStats.calls - callsBefore;
    log.gemini_retries = geminiStats.retries - retriesBefore;
    log.duration_ms = Date.now() - started;
    const ok = !log.error && (log.ingest?.shows_ok ?? 1) > 0;
    await sql`
      UPDATE runs SET finished_at = now(), ok = ${ok}, log = ${sql.json(log as never)} WHERE id = ${runId}`;
    console.log(`[pipeline] ${JSON.stringify({ ...log, ingest: log.ingest && { ...log.ingest, results: undefined } })}`);
  }
  return log;
}
