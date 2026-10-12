import Parser from "rss-parser";
import { z } from "zod";
import { enabledShows, settings, type Show } from "@/lib/config";
import { db } from "@/lib/db";

type TranscriptTag = { $?: { url?: string; type?: string } };
type CustomItem = {
  "content:encoded"?: string;
  "itunes:summary"?: string;
  "podcast:transcript"?: TranscriptTag | TranscriptTag[];
};

const parser: Parser<Record<string, unknown>, CustomItem> = new Parser({
  timeout: 45_000,
  headers: { "User-Agent": "PodcastEcosystemRadar/1.0 (+https://github.com/Anant3452/podcast-ecosystem-radar)" },
  customFields: {
    item: [
      "content:encoded",
      "itunes:summary",
      ["podcast:transcript", "podcast:transcript", { keepArray: true }],
    ],
  },
});

/** Raw RSS items are untrusted: validate the handful of fields we use. */
const ItemSchema = z.object({
  guid: z.string().trim().min(1).optional().catch(undefined),
  link: z.string().trim().optional().catch(undefined),
  title: z.string().trim().optional().catch(undefined),
  isoDate: z.string().optional().catch(undefined),
  pubDate: z.string().optional().catch(undefined),
  content: z.string().optional().catch(undefined),
  contentSnippet: z.string().optional().catch(undefined),
  "content:encoded": z.string().optional().catch(undefined),
  "itunes:summary": z.string().optional().catch(undefined),
  "podcast:transcript": z.unknown().optional(),
  enclosure: z.object({ url: z.string().optional() }).partial().optional().catch(undefined),
});

export type NormalizedEpisode = {
  guid: string;
  title: string;
  published_at: Date;
  description: string;
  link: string | null;
  /** Audio file URL; always present in podcast feeds and used if `link` is dead. */
  enclosure_url: string | null;
  transcript_url: string | null;
};

const MAX_NOTES = 12_000;

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function pickTranscript(raw: unknown): string | null {
  const tags = (Array.isArray(raw) ? raw : raw ? [raw] : []) as TranscriptTag[];
  // Prefer plain-text-ish formats we can read without a parser.
  const order = ["text/plain", "text/vtt", "application/x-subrip", "application/srt", "text/html"];
  const withUrl = tags.filter((t) => t?.$?.url);
  withUrl.sort((a, b) => {
    const ia = order.indexOf(a.$?.type ?? "");
    const ib = order.indexOf(b.$?.type ?? "");
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return withUrl[0]?.$?.url ?? null;
}

export function normalizeItem(raw: unknown): NormalizedEpisode | null {
  const parsed = ItemSchema.safeParse(raw);
  if (!parsed.success) return null;
  const it = parsed.data;
  const published = Date.parse(it.isoDate ?? it.pubDate ?? "");
  if (!Number.isFinite(published) || !it.title) return null;

  const candidates = [it["content:encoded"], it.content, it["itunes:summary"], it.contentSnippet]
    .filter((s): s is string => typeof s === "string")
    .map(htmlToText);
  const description = candidates.sort((a, b) => b.length - a.length)[0] ?? "";

  const guid = it.guid ?? it.link ?? it.enclosure?.url ?? `${it.title}|${published}`;
  return {
    guid,
    title: it.title,
    published_at: new Date(published),
    description: description.slice(0, MAX_NOTES),
    link: it.link || it.enclosure?.url || null,
    enclosure_url: it.enclosure?.url || null,
    transcript_url: pickTranscript(it["podcast:transcript"]),
  };
}

/**
 * Some feeds point at episode pages that no longer exist (e.g. retired
 * podcasters.spotify.com URLs). Only 404/410 count as dead: bot blocks,
 * timeouts and network errors keep the original link.
 */
export async function isDeadLink(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { Range: "bytes=0-0", "User-Agent": "Mozilla/5.0 (PodcastEcosystemRadar link check)" },
      signal: AbortSignal.timeout(8_000),
    });
    await res.body?.cancel();
    return res.status === 404 || res.status === 410;
  } catch {
    return false;
  }
}

/**
 * Check each episode's link once (link_checked_at) and swap dead links for
 * the audio file, so every citation in the brief opens something real.
 */
async function repairLinks(showId: string, episodes: NormalizedEpisode[]): Promise<number> {
  const sql = await db();
  const enclosures = new Map(episodes.map((e) => [e.guid, e.enclosure_url]));
  const unchecked = await sql<{ id: string; guid: string; link: string | null }[]>`
    SELECT id::text, guid, link FROM episodes WHERE show_id = ${showId} AND link_checked_at IS NULL`;
  let repaired = 0;
  for (let i = 0; i < unchecked.length; i += 6) {
    await Promise.all(
      unchecked.slice(i, i + 6).map(async (row) => {
        const fallback = enclosures.get(row.guid) ?? null;
        const dead = row.link ? await isDeadLink(row.link) : true;
        const link = dead && fallback ? fallback : row.link;
        if (link !== row.link) repaired++;
        await sql`UPDATE episodes SET link = ${link}, link_checked_at = now() WHERE id = ${row.id}`;
      }),
    );
  }
  if (repaired) console.log(`[ingest] ${showId}: replaced ${repaired} dead episode link(s) with audio URLs`);
  return repaired;
}

export type ShowIngestResult = {
  show_id: string;
  ok: boolean;
  fetched: number;
  in_window: number;
  added: number;
  error?: string;
};

export async function ingestShow(show: Show, now = new Date()): Promise<ShowIngestResult> {
  const sql = await db();
  await sql`
    INSERT INTO shows (id, name, rss_url) VALUES (${show.id}, ${show.name}, ${show.rss_url})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rss_url = EXCLUDED.rss_url`;
  try {
    const feed = await parser.parseURL(show.rss_url);
    const cutoff = now.getTime() - settings.ingest_window_days * 86_400_000;
    const episodes = (feed.items ?? [])
      .map(normalizeItem)
      .filter((e): e is NormalizedEpisode => e !== null && e.published_at.getTime() >= cutoff);

    // Dedupe by guid within the feed itself before inserting.
    const unique = [...new Map(episodes.map((e) => [e.guid, e])).values()];
    let added = 0;
    for (const e of unique) {
      const rows = await sql`
        INSERT INTO episodes (show_id, guid, title, published_at, description, link, transcript_url)
        VALUES (${show.id}, ${e.guid}, ${e.title}, ${e.published_at}, ${e.description}, ${e.link}, ${e.transcript_url})
        ON CONFLICT (show_id, guid) DO NOTHING
        RETURNING id`;
      added += rows.length;
    }
    await repairLinks(show.id, unique);
    await sql`UPDATE shows SET last_fetched_at = now(), last_status = 'ok', last_error = NULL WHERE id = ${show.id}`;
    return { show_id: show.id, ok: true, fetched: feed.items?.length ?? 0, in_window: unique.length, added };
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    await sql`UPDATE shows SET last_fetched_at = now(), last_status = 'error', last_error = ${message} WHERE id = ${show.id}`;
    return { show_id: show.id, ok: false, fetched: 0, in_window: 0, added: 0, error: message };
  }
}

/** Fetch every enabled show (a few at a time) and store new episodes. Idempotent. */
export async function ingestAll(now = new Date()): Promise<ShowIngestResult[]> {
  const results: ShowIngestResult[] = [];
  const queue = [...enabledShows];
  const worker = async () => {
    for (let show = queue.shift(); show; show = queue.shift()) {
      const r = await ingestShow(show, now);
      console.log(
        `[ingest] ${r.ok ? "ok  " : "FAIL"} ${show.id}: ${r.in_window} in window, ${r.added} new${r.error ? ` (${r.error})` : ""}`,
      );
      results.push(r);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return results;
}
