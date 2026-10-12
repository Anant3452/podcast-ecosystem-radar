import type { BriefContent } from "@/lib/brief";
import { allShows } from "@/lib/config";
import { db } from "@/lib/db";

export type BriefRow = {
  week_of: string;
  created_at: Date;
  headline: string;
  content: BriefContent;
  markdown: string;
  emailed_at: Date | null;
  email_error: string | null;
};

const asDate = (d: Date | string) => (typeof d === "string" ? d : d.toISOString().slice(0, 10));

export async function latestBrief(): Promise<BriefRow | null> {
  const sql = await db();
  const rows = await sql<BriefRow[]>`
    SELECT week_of, created_at, headline, content, markdown, emailed_at, email_error
    FROM briefs ORDER BY week_of DESC LIMIT 1`;
  return rows[0] ? { ...rows[0], week_of: asDate(rows[0].week_of) } : null;
}

export async function briefByWeek(week: string): Promise<BriefRow | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return null;
  const sql = await db();
  const rows = await sql<BriefRow[]>`
    SELECT week_of, created_at, headline, content, markdown, emailed_at, email_error
    FROM briefs WHERE week_of = ${week}`;
  return rows[0] ? { ...rows[0], week_of: asDate(rows[0].week_of) } : null;
}

export async function listBriefs() {
  const sql = await db();
  const rows = await sql<
    { week_of: Date | string; created_at: Date; headline: string; emailed_at: Date | null; guests: number; topics: number; sponsors: number }[]
  >`
    SELECT week_of, created_at, headline, emailed_at,
      jsonb_array_length(content->'sections'->'guests')::int AS guests,
      jsonb_array_length(content->'sections'->'topics')::int AS topics,
      jsonb_array_length(content->'sections'->'sponsors')::int AS sponsors
    FROM briefs ORDER BY week_of DESC`;
  return rows.map((r) => ({ ...r, week_of: asDate(r.week_of) }));
}

export async function showStats() {
  const sql = await db();
  const rows = await sql<
    {
      id: string;
      last_fetched_at: Date | null;
      last_status: string | null;
      last_error: string | null;
      episodes: number;
      extracted: number;
      last_episode_at: Date | null;
      last_processed_at: Date | null;
    }[]
  >`
    SELECT s.id, s.last_fetched_at, s.last_status, s.last_error,
      count(e.id)::int AS episodes,
      count(e.extracted_at)::int AS extracted,
      max(e.published_at) AS last_episode_at,
      max(e.extracted_at) AS last_processed_at
    FROM shows s LEFT JOIN episodes e ON e.show_id = s.id
    GROUP BY s.id`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  return allShows.map((show) => ({ ...show, stats: byId.get(show.id) ?? null }));
}

export async function recentRuns(limit = 8) {
  const sql = await db();
  return sql<{ id: string; trigger: string; started_at: Date; finished_at: Date | null; ok: boolean | null; log: Record<string, unknown> }[]>`
    SELECT id::text, trigger, started_at, finished_at, ok, log FROM runs ORDER BY started_at DESC LIMIT ${limit}`;
}
