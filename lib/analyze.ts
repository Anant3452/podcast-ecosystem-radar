import type { BrandRelationship, Extraction } from "@/lib/extract";
import { clusterByName, normalizeBrandName, normalizePersonName } from "@/lib/normalize";

/**
 * Deterministic analysis over extracted episodes. No LLM calls here: the
 * same inputs always produce the same guest/topic/brand signals.
 */

export type EpisodeRecord = {
  id: string;
  show_id: string;
  show_name: string;
  title: string;
  url: string | null;
  published_at: Date;
  extraction: Extraction;
};

export type EpisodeRef = {
  episode_id: string;
  show_id: string;
  show_name: string;
  title: string;
  url: string | null;
  published_at: string; // ISO date
};

export type ShowRef = { show_id: string; show_name: string };

export type GuestOverlap = {
  name: string;
  role_or_company: string | null;
  show_count: number;
  shows: ShowRef[];
  episodes: EpisodeRef[];
};

export type TopicCluster = {
  topic: string;
  show_count: number;
  shows: ShowRef[];
  episodes: EpisodeRef[];
};

export type BrandSignal = {
  brand: string;
  show_count: number;
  paid_show_count: number;
  relationships: BrandRelationship[];
  shows: ShowRef[];
  episodes: (EpisodeRef & { relationship: BrandRelationship })[];
};

export type Analysis = {
  generated_at: string;
  windows: {
    guest: { days: number; from: string; to: string };
    topic: { days: number; from: string; to: string };
    brand: { days: number; from: string; to: string };
  };
  stats: { episodes_considered: number; shows_with_episodes: number; episodes_in_topic_window: number };
  guest_overlap: GuestOverlap[];
  topic_clusters: TopicCluster[];
  brand_signals: BrandSignal[];
};

export type AnalyzeOptions = {
  now: Date;
  guestWindowDays: number;
  topicWindowDays: number;
  brandWindowDays?: number;
  /** lowercase raw topic label -> canonical label */
  topicCanon?: Map<string, string>;
};

const DAY = 86_400_000;
const PAID: BrandRelationship[] = ["sponsor", "ad_read"];

function ref(e: EpisodeRecord): EpisodeRef {
  return {
    episode_id: e.id,
    show_id: e.show_id,
    show_name: e.show_name,
    title: e.title,
    url: e.url,
    published_at: e.published_at.toISOString(),
  };
}

function distinctShows(eps: { show_id: string; show_name: string }[]): ShowRef[] {
  const m = new Map<string, ShowRef>();
  for (const e of eps) m.set(e.show_id, { show_id: e.show_id, show_name: e.show_name });
  return [...m.values()].sort((a, b) => a.show_name.localeCompare(b.show_name));
}

function byNewest<T extends { published_at: string }>(a: T, b: T): number {
  return b.published_at.localeCompare(a.published_at);
}

function uniqueEpisodes<T extends EpisodeRef>(refs: T[]): T[] {
  return [...new Map(refs.map((r) => [r.episode_id, r])).values()].sort(byNewest);
}

const latest = (refs: EpisodeRef[]) => refs.reduce((m, r) => (r.published_at > m ? r.published_at : m), "");

export function inWindow(e: EpisodeRecord, now: Date, days: number): boolean {
  const t = e.published_at.getTime();
  return t <= now.getTime() && t > now.getTime() - days * DAY;
}

export function guestOverlap(episodes: EpisodeRecord[], now: Date, days: number): GuestOverlap[] {
  const appearances = episodes
    .filter((e) => inWindow(e, now, days))
    .flatMap((e) => e.extraction.guests.map((g) => ({ g, e })));
  return clusterByName(appearances, (a) => a.g.name, normalizePersonName)
    .map((c) => {
      const shows = distinctShows(c.members.map((m) => m.e));
      const roles = c.members.map((m) => m.g.role_or_company).filter((r): r is string => !!r);
      return {
        name: c.display,
        role_or_company: roles.sort((a, b) => b.length - a.length)[0] ?? null,
        show_count: shows.length,
        shows,
        episodes: uniqueEpisodes(c.members.map((m) => ref(m.e))),
      };
    })
    .filter((g) => g.show_count >= 2)
    .sort((a, b) => b.show_count - a.show_count || latest(b.episodes).localeCompare(latest(a.episodes)) || a.name.localeCompare(b.name));
}

export function canonicalTopic(label: string, canon?: Map<string, string>): string {
  const key = label.trim().toLowerCase();
  return canon?.get(key) ?? label.trim();
}

export function topicClusters(
  episodes: EpisodeRecord[],
  now: Date,
  days: number,
  canon?: Map<string, string>,
): TopicCluster[] {
  const groups = new Map<string, { label: string; eps: EpisodeRecord[] }>();
  for (const e of episodes.filter((x) => inWindow(x, now, days))) {
    const seen = new Set<string>();
    for (const t of e.extraction.topics) {
      const label = canonicalTopic(t, canon);
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const g = groups.get(key) ?? { label, eps: [] };
      g.eps.push(e);
      groups.set(key, g);
    }
  }
  return [...groups.values()]
    .map(({ label, eps }) => {
      const shows = distinctShows(eps);
      return { topic: label, show_count: shows.length, shows, episodes: uniqueEpisodes(eps.map(ref)) };
    })
    .filter((t) => t.show_count >= 2)
    .sort((a, b) => b.show_count - a.show_count || b.episodes.length - a.episodes.length || a.topic.localeCompare(b.topic));
}

export function brandSignals(episodes: EpisodeRecord[], now: Date, days: number): BrandSignal[] {
  const mentions = episodes
    .filter((e) => inWindow(e, now, days))
    .flatMap((e) => e.extraction.brands.map((b) => ({ b, e })));
  return clusterByName(mentions, (m) => m.b.name, normalizeBrandName)
    .map((c) => {
      const shows = distinctShows(c.members.map((m) => m.e));
      const paid = c.members.filter((m) => PAID.includes(m.b.relationship));
      const relationships = [...new Set(c.members.map((m) => m.b.relationship))].sort(
        (a, b) => PAID.indexOf(b) - PAID.indexOf(a),
      );
      return {
        brand: c.display,
        show_count: shows.length,
        paid_show_count: distinctShows(paid.map((m) => m.e)).length,
        relationships,
        shows,
        episodes: uniqueEpisodes(c.members.map((m) => ({ ...ref(m.e), relationship: m.b.relationship }))),
      };
    })
    .filter((b) => b.paid_show_count >= 1)
    .sort(
      (a, b) =>
        b.show_count - a.show_count ||
        b.paid_show_count - a.paid_show_count ||
        b.episodes.length - a.episodes.length ||
        a.brand.localeCompare(b.brand),
    );
}

export function analyze(episodes: EpisodeRecord[], opts: AnalyzeOptions): Analysis {
  const { now, guestWindowDays, topicWindowDays } = opts;
  const brandWindowDays = opts.brandWindowDays ?? guestWindowDays;
  const window = (days: number) => ({
    days,
    from: new Date(now.getTime() - days * DAY).toISOString(),
    to: now.toISOString(),
  });
  const maxDays = Math.max(guestWindowDays, topicWindowDays, brandWindowDays);
  const considered = episodes.filter((e) => inWindow(e, now, maxDays));
  return {
    generated_at: now.toISOString(),
    windows: { guest: window(guestWindowDays), topic: window(topicWindowDays), brand: window(brandWindowDays) },
    stats: {
      episodes_considered: considered.length,
      shows_with_episodes: new Set(considered.map((e) => e.show_id)).size,
      episodes_in_topic_window: episodes.filter((e) => inWindow(e, now, topicWindowDays)).length,
    },
    guest_overlap: guestOverlap(episodes, now, guestWindowDays),
    topic_clusters: topicClusters(episodes, now, topicWindowDays, opts.topicCanon),
    brand_signals: brandSignals(episodes, now, brandWindowDays),
  };
}
