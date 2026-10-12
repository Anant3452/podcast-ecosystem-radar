import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { allShows, settings } from "@/lib/config";
import { db } from "@/lib/db";
import { generateJson } from "@/lib/gemini";
import { htmlToText } from "@/lib/ingest";
import { normalizeBrandName } from "@/lib/normalize";

export const BRAND_RELATIONSHIPS = ["sponsor", "ad_read", "mentioned", "product_placement"] as const;
export type BrandRelationship = (typeof BRAND_RELATIONSHIPS)[number];

export const ExtractionSchema = z.object({
  guests: z
    .array(
      z.object({
        name: z.string().trim().min(2),
        role_or_company: z.string().trim().nullish().transform((v) => v || null),
      }),
    )
    .catch([])
    .default([]),
  topics: z.array(z.string().trim().min(2)).max(5).catch([]).default([]),
  brands: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        relationship: z.enum(BRAND_RELATIONSHIPS).catch("mentioned"),
      }),
    )
    .catch([])
    .default([]),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    guests: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role_or_company: { type: Type.STRING, nullable: true },
        },
        required: ["name"],
      },
    },
    topics: { type: Type.ARRAY, items: { type: Type.STRING }, maxItems: "5" },
    brands: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          relationship: { type: Type.STRING, enum: [...BRAND_RELATIONSHIPS] },
        },
        required: ["name", "relationship"],
      },
    },
  },
  required: ["guests", "topics", "brands"],
  propertyOrdering: ["guests", "topics", "brands"],
};

const SYSTEM = `You extract structured facts from podcast episode metadata for an Indian startup-ecosystem newsletter.
Rules:
- Use ONLY the text provided. Never infer, guess, or use outside knowledge to add a guest or brand.
- If something is not clearly stated, return an empty array for it. Empty arrays are always better than guesses.
- guests: people interviewed or featured on this episode. EXCLUDE the show's regular host(s) and co-hosts, people only quoted or discussed in passing, and the production team. Use the full name as written. role_or_company is their title/company if stated, else null.
- topics: 2 to 5 short, normalized, lowercase-friendly topic labels (2-5 words each) describing what the episode is about, e.g. "B2B SaaS pricing", "fundraising in 2026", "quick commerce", "D2C brand building". Prefer general, reusable labels over episode-specific phrasing. Return fewer only if the text is too thin.
- brands: companies, products or apps named in the text, with relationship:
  - "sponsor": the text says the episode/show is sponsored, presented or powered by the brand.
  - "ad_read": promotional copy for the brand: discount codes, "check out", "download", "sign up", "use link", affiliate links.
  - "product_placement": a brand woven into the episode as a featured partner or prominently showcased product, without explicit sponsorship wording.
  - "mentioned": named in passing (e.g., a guest's company, a company discussed).
  EXCLUDE podcast hosting/ad-network boilerplate (e.g. Megaphone, Acast, \"ad choices\" notices) and podcast/social platforms used only as "follow us on" links (Spotify, Apple Podcasts, YouTube, Instagram, X/Twitter, LinkedIn, Facebook, WhatsApp channels) and the show's own name, its producer/network and the host's own company or fund (self-promotion is not sponsorship). Do not list the same brand twice; keep the strongest relationship (sponsor > ad_read > product_placement > mentioned).
Respond with JSON matching the schema.`;

const MAX_TRANSCRIPT = 40_000;

async function fetchTranscript(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const raw = await res.text();
    const text = /<\w+[^>]*>/.test(raw)
      ? htmlToText(raw)
      : raw
          .replace(/^WEBVTT.*$/m, "")
          .replace(/^\d+\s*$/gm, "")
          .replace(/^[\d:.,]+\s*-->\s*[\d:.,]+.*$/gm, "")
          .replace(/\n{2,}/g, "\n");
    return text.trim().slice(0, MAX_TRANSCRIPT) || null;
  } catch {
    return null;
  }
}

export type PendingEpisode = {
  id: string;
  show_id: string;
  title: string;
  description: string;
  transcript_url: string | null;
};

const NOTES_PER_EPISODE = 5_000;
const TRANSCRIPT_PER_EPISODE = 12_000;

const batchResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    episodes: {
      type: Type.ARRAY,
      items: {
        ...responseSchema,
        properties: { episode_id: { type: Type.STRING }, ...responseSchema.properties },
        required: ["episode_id", ...(responseSchema.required ?? [])],
        propertyOrdering: ["episode_id", ...(responseSchema.propertyOrdering ?? [])],
      },
    },
  },
  required: ["episodes"],
};

const BatchValidator = z.object({
  episodes: z.array(z.object({ episode_id: z.string() }).and(ExtractionSchema)),
});

/**
 * Extract several episodes in ONE Gemini call (keeps us well inside free-tier
 * request quotas). Each episode is clearly delimited and answered by its id,
 * and the rules forbid carrying facts from one episode to another.
 * Returns a map of episode id -> extraction; ids the model skipped are absent.
 */
export async function extractBatch(eps: PendingEpisode[]): Promise<Map<string, Extraction>> {
  const blocks = await Promise.all(
    eps.map(async (ep) => {
      const show = allShows.find((s) => s.id === ep.show_id);
      const transcript = ep.transcript_url ? await fetchTranscript(ep.transcript_url) : null;
      return [
        `=== EPISODE (episode_id: "ep-${ep.id}") ===`,
        `SHOW: ${show?.name ?? ep.show_id}`,
        `EPISODE TITLE: ${ep.title}`,
        `SHOW NOTES:\n${ep.description.slice(0, NOTES_PER_EPISODE) || "(none)"}`,
        transcript ? `TRANSCRIPT (truncated):\n${transcript.slice(0, TRANSCRIPT_PER_EPISODE)}` : "",
        `=== END EPISODE ep-${ep.id} ===`,
      ]
        .filter(Boolean)
        .join("\n");
    }),
  );
  const prompt = `Extract facts for each of the ${eps.length} episodes below. Return exactly one entry per episode, with episode_id copied exactly from its header (e.g. "ep-123"). Treat each episode independently: never move a guest, topic or brand from one episode to another.\n\n${blocks.join("\n\n")}`;
  const result = await generateJson({
    system: SYSTEM,
    prompt,
    responseSchema: batchResponseSchema,
    validator: BatchValidator,
    temperature: 0.1,
  });

  const wanted = new Map(eps.map((e) => [e.id, e]));
  const out = new Map<string, Extraction>();
  for (const { episode_id, ...x } of result.episodes) {
    // Tolerate "ep-59", "EPISODE 59", "59": the trailing number is the id.
    const ep = wanted.get(episode_id.match(/(\d+)\s*$/)?.[1] ?? "");
    if (!ep || out.has(ep.id)) continue;
    const show = allShows.find((s) => s.id === ep.show_id);
    out.set(ep.id, dropSelfBrands(dedupeExtraction(x), [show?.name ?? ep.show_id, ...(show?.self_brands ?? [])]));
  }
  return out;
}

/** Podcast hosting/distribution platforms whose names show up in boilerplate, not ads. */
export const PLATFORM_BRANDS = [
  "Megaphone", "Acast", "Spotify", "Spotify for Podcasters", "Anchor", "Apple Podcasts", "Google Podcasts",
  "YouTube", "Instagram", "Twitter", "X", "LinkedIn", "Facebook", "WhatsApp", "Threads", "Omny", "Omny Studio",
  "Audioboom", "Buzzsprout", "Simplecast", "Captivate", "Zencastr", "Hubhopper", "Podbean", "Libsyn",
  "Riverside", "RSS.com", "Art19", "Amazon Music", "JioSaavn", "Gaana", "IVM Podcasts",
];

/**
 * Remove the show's own brands (self-promotion isn't a sponsorship signal) and
 * hosting platforms. A brand also matches when it starts with a self brand,
 * so "BeerBiceps SkillHouse" is dropped for a show that lists "BeerBiceps".
 */
export function dropSelfBrands(x: Extraction, selfBrands: string[]): Extraction {
  const own = selfBrands.map(normalizeBrandName).filter(Boolean);
  const platforms = new Set(PLATFORM_BRANDS.map(normalizeBrandName));
  const isOwn = (name: string) => {
    const n = normalizeBrandName(name);
    return platforms.has(n) || own.some((o) => n === o || n.startsWith(`${o} `));
  };
  return { ...x, brands: x.brands.filter((b) => !isOwn(b.name)) };
}

const RANK: Record<BrandRelationship, number> = { sponsor: 3, ad_read: 2, product_placement: 1, mentioned: 0 };

export function dedupeExtraction(x: Extraction): Extraction {
  const brands = new Map<string, Extraction["brands"][number]>();
  for (const b of x.brands) {
    const key = b.name.toLowerCase();
    const prev = brands.get(key);
    if (!prev || RANK[b.relationship] > RANK[prev.relationship]) brands.set(key, b);
  }
  const guests = new Map(x.guests.map((g) => [g.name.toLowerCase(), g]));
  const topics = [...new Map(x.topics.map((t) => [t.toLowerCase(), t])).values()].slice(0, 5);
  return { guests: [...guests.values()], topics, brands: [...brands.values()] };
}

export type ExtractStats = { attempted: number; succeeded: number; failed: number; remaining: number };

/**
 * Extract every episode that hasn't been processed yet, stopping early when
 * `deadline` (ms epoch) is near so serverless invocations finish in time.
 * Episodes that fail 3 times are left with an error and skipped thereafter.
 */
export async function extractPending(opts: { deadline: number }): Promise<ExtractStats> {
  const sql = await db();
  const perCall = settings.gemini.episodes_per_call;
  const parallel = settings.gemini.concurrency;
  const stats: ExtractStats = { attempted: 0, succeeded: 0, failed: 0, remaining: 0 };

  const record = async (ep: PendingEpisode, x: Extraction | undefined, error?: string) => {
    stats.attempted++;
    if (x) {
      stats.succeeded++;
      await sql`
        UPDATE episodes SET extraction = ${sql.json(x as never)}, extracted_at = now(), extract_error = NULL,
          extract_attempts = extract_attempts + 1
        WHERE id = ${ep.id}`;
    } else {
      stats.failed++;
      const message = (error ?? "episode missing from Gemini batch response").slice(0, 500);
      console.error(`[extract] episode ${ep.id} (${ep.show_id}) failed: ${message}`);
      await sql`
        UPDATE episodes SET extract_error = ${message}, extract_attempts = extract_attempts + 1
        WHERE id = ${ep.id}`;
    }
  };

  // Leave headroom for one more Gemini round trip.
  while (Date.now() < opts.deadline - 25_000) {
    const pending = await sql<PendingEpisode[]>`
      SELECT id::text, show_id, title, description, transcript_url
      FROM episodes
      WHERE extracted_at IS NULL AND extract_attempts < 3
      ORDER BY published_at DESC
      LIMIT ${perCall * parallel}`;
    if (pending.length === 0) break;
    const chunks: PendingEpisode[][] = [];
    for (let i = 0; i < pending.length; i += perCall) chunks.push(pending.slice(i, i + perCall));
    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const results = await extractBatch(chunk);
          for (const ep of chunk) await record(ep, results.get(ep.id));
        } catch (err) {
          for (const ep of chunk) await record(ep, undefined, (err as Error).message);
        }
      }),
    );
  }
  const [{ count }] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM episodes WHERE extracted_at IS NULL AND extract_attempts < 3`;
  stats.remaining = count;
  console.log(`[extract] attempted=${stats.attempted} ok=${stats.succeeded} failed=${stats.failed} remaining=${stats.remaining}`);
  return stats;
}
