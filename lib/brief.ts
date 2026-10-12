import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import type { Analysis, EpisodeRef, ShowRef } from "@/lib/analyze";
import { generateJson, ThinkingLevel } from "@/lib/gemini";

/**
 * Turn the deterministic analysis into a skimmable brief. Gemini only writes
 * prose for items it is handed (by ref id); every link and show list is
 * attached afterwards by code from the analysis, so citations can't drift.
 */

export type SectionKey = "guests" | "topics" | "sponsors";

export type BriefItem = {
  ref: string;
  title: string;
  insight: string;
  action: string;
  shows: ShowRef[];
  episodes: (EpisodeRef & { relationship?: string })[];
  meta?: string;
};

export type BriefContent = {
  week_of: string;
  headline: string;
  sections: Record<SectionKey, BriefItem[]>;
  stats: Analysis["stats"];
  windows: Analysis["windows"];
  generated_by: "gemini" | "fallback";
};

const MAX_ITEMS = 7;
const MIN_ITEMS = 3;
const PROMPT_ITEMS = 12;

type Candidate = Omit<BriefItem, "insight" | "action"> & { facts: Record<string, unknown> };

function candidates(a: Analysis): Record<SectionKey, Candidate[]> {
  const ep = (e: EpisodeRef & { relationship?: string }) => ({
    show: e.show_name,
    title: e.title,
    date: e.published_at.slice(0, 10),
    ...(e.relationship ? { relationship: e.relationship } : {}),
  });
  return {
    guests: a.guest_overlap.slice(0, PROMPT_ITEMS).map((g, i) => ({
      ref: `G${i + 1}`,
      title: g.name,
      meta: g.role_or_company ?? undefined,
      shows: g.shows,
      episodes: g.episodes,
      facts: { guest: g.name, role_or_company: g.role_or_company, show_count: g.show_count, appearances: g.episodes.map(ep) },
    })),
    topics: a.topic_clusters.slice(0, PROMPT_ITEMS).map((t, i) => ({
      ref: `T${i + 1}`,
      title: t.topic,
      meta: `${t.show_count} shows · ${t.episodes.length} episodes`,
      shows: t.shows,
      episodes: t.episodes,
      facts: { topic: t.topic, show_count: t.show_count, episodes: t.episodes.map(ep) },
    })),
    sponsors: a.brand_signals.slice(0, PROMPT_ITEMS).map((b, i) => ({
      ref: `B${i + 1}`,
      title: b.brand,
      meta: b.relationships.join(", ").replace(/_/g, " "),
      shows: b.shows,
      episodes: b.episodes,
      facts: {
        brand: b.brand,
        show_count: b.show_count,
        paid_show_count: b.paid_show_count,
        relationships: b.relationships,
        mentions: b.episodes.map(ep),
      },
    })),
  };
}

const itemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ref: { type: Type.STRING },
    insight: { type: Type.STRING },
    action: { type: Type.STRING },
  },
  required: ["ref", "insight", "action"],
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    guests: { type: Type.ARRAY, items: itemSchema },
    topics: { type: Type.ARRAY, items: itemSchema },
    sponsors: { type: Type.ARRAY, items: itemSchema },
  },
  required: ["headline", "guests", "topics", "sponsors"],
  propertyOrdering: ["headline", "guests", "topics", "sponsors"],
};

const ItemV = z.object({ ref: z.string(), insight: z.string().trim().min(1), action: z.string().trim().min(1) });
const Validator = z.object({
  headline: z.string().trim().min(1),
  guests: z.array(ItemV).catch([]),
  topics: z.array(ItemV).catch([]),
  sponsors: z.array(ItemV).catch([]),
});

const SYSTEM = `You write a weekly intelligence brief for Aditya, who hosts a podcast for Indian startup founders (~9k monthly listeners).
You get JSON with three candidate lists (guests, topics, sponsors), each item carrying a ref id and its facts.
Hard rules:
- Use ONLY facts in the JSON. Do not add names, numbers, companies, dates, or claims that aren't there. No outside knowledge.
- Refer to items only by the refs provided. Never invent a ref.
- For each section, pick the ${MIN_ITEMS}-${MAX_ITEMS} most useful items (fewer only if fewer exist; an empty list is fine if none exist). Keep the input order unless another order is clearly more useful.
- insight: one sentence, max 30 words, stating the evidence (which shows, when, how often).
- action: one imperative sentence, max 25 words, e.g. "Pitch Kunal Shah for a booking: appeared on The Neon Show and Founder Thesis this month."
  - guests -> booking pitch; topics -> ride the theme or counter-program it; sponsors -> add to the sponsor pitch list with the evidence.
- headline: exactly 3 short sentences summarising the week ("This week in one line"), built only from the facts given. If a section is empty, say precisely what is missing (e.g. "No guest appeared on two or more monitored shows this month"), never "zero guests appeared".
Plain English, no hype, no emojis.`;

function withoutFacts(c: Candidate): Omit<Candidate, "facts"> {
  return { ref: c.ref, title: c.title, meta: c.meta, shows: c.shows, episodes: c.episodes };
}

function fallbackText(section: SectionKey, c: Candidate): { insight: string; action: string } {
  const shows = c.shows.map((s) => s.show_name);
  const list = shows.length > 1 ? `${shows.slice(0, -1).join(", ")} and ${shows.at(-1)}` : shows[0] ?? "";
  if (section === "guests")
    return {
      insight: `Appeared on ${c.shows.length} monitored shows (${list}) in the last month.`,
      action: `Pitch ${c.title} for a booking while they're doing media rounds.`,
    };
  if (section === "topics")
    return {
      insight: `Covered by ${c.shows.length} shows this week: ${list}.`,
      action: `Decide whether to ride "${c.title}" with a timely episode or counter-program it.`,
    };
  return {
    insight: `Paid placement on ${list}; ${c.episodes.length} mention(s) in the window.`,
    action: `Add ${c.title} to the sponsor pitch list, citing their spend on ${list}.`,
  };
}

function fallbackHeadline(a: Analysis): string {
  return [
    `${a.stats.episodes_considered} episodes across ${a.stats.shows_with_episodes} monitored shows were analysed.`,
    `${a.guest_overlap.length} guest(s) appeared on two or more shows this month and ${a.topic_clusters.length} topic(s) were shared by two or more shows this week.`,
    `${a.brand_signals.length} brand(s) showed paid podcast activity.`,
  ].join(" ");
}

export async function generateBrief(analysis: Analysis, weekOf: string): Promise<BriefContent> {
  const cands = candidates(analysis);
  const payload = {
    windows: analysis.windows,
    stats: analysis.stats,
    guests: cands.guests.map((c) => ({ ref: c.ref, ...c.facts })),
    topics: cands.topics.map((c) => ({ ref: c.ref, ...c.facts })),
    sponsors: cands.sponsors.map((c) => ({ ref: c.ref, ...c.facts })),
  };

  let llm: z.infer<typeof Validator> | null = null;
  try {
    llm = await generateJson({
      system: SYSTEM,
      prompt: `DATA:\n${JSON.stringify(payload)}`,
      responseSchema,
      validator: Validator,
      temperature: 0.3,
      thinking: ThinkingLevel.MEDIUM,
    });
  } catch (err) {
    console.error(`[brief] Gemini brief failed, using deterministic fallback: ${(err as Error).message}`);
  }

  const build = (section: SectionKey): BriefItem[] => {
    const byRef = new Map(cands[section].map((c) => [c.ref, c]));
    const used = new Set<string>();
    const items: BriefItem[] = [];
    // Grounding: only keep model items whose ref exists in the analysis.
    for (const it of llm?.[section] ?? []) {
      const c = byRef.get(it.ref);
      if (!c || used.has(it.ref) || items.length >= MAX_ITEMS) continue;
      used.add(it.ref);
      items.push({ ...withoutFacts(c), insight: it.insight, action: it.action });
    }
    // Top up to the minimum (or fill entirely when Gemini failed) from the analysis.
    for (const c of cands[section]) {
      if (items.length >= (llm ? MIN_ITEMS : MAX_ITEMS)) break;
      if (used.has(c.ref)) continue;
      used.add(c.ref);
      items.push({ ...withoutFacts(c), ...fallbackText(section, c) });
    }
    return items;
  };

  return {
    week_of: weekOf,
    headline: llm?.headline ?? fallbackHeadline(analysis),
    sections: { guests: build("guests"), topics: build("topics"), sponsors: build("sponsors") },
    stats: analysis.stats,
    windows: analysis.windows,
    generated_by: llm ? "gemini" : "fallback",
  };
}

export const SECTION_META: Record<SectionKey, { label: string; question: string; empty: string }> = {
  guests: {
    label: "Guests on media rounds",
    question: "Who appeared on 2+ shows in the last 30 days?",
    empty: "No guest appeared on two or more monitored shows in the last 30 days.",
  },
  topics: {
    label: "Topics in the air",
    question: "What did 2+ shows cover this week?",
    empty: "No topic was covered by two or more shows in the last 7 days.",
  },
  sponsors: {
    label: "Brands spending on podcasts",
    question: "Who is sponsoring or running ad reads?",
    empty: "No sponsor or ad-read activity was detected in the window.",
  },
};

const SECTION_ORDER: SectionKey[] = ["guests", "topics", "sponsors"];

export function renderMarkdown(b: BriefContent, siteUrl?: string): string {
  const lines = [`# Podcast Ecosystem Radar: week of ${b.week_of}`, "", `**This week in one line.** ${b.headline}`, ""];
  for (const key of SECTION_ORDER) {
    const meta = SECTION_META[key];
    lines.push(`## ${meta.label}`, `_${meta.question}_`, "");
    if (b.sections[key].length === 0) lines.push(meta.empty, "");
    for (const it of b.sections[key]) {
      lines.push(`### ${it.title}${it.meta ? ` (${it.meta})` : ""}`, it.insight, "", `**Action:** ${it.action}`, "");
      for (const e of it.episodes.slice(0, 5)) {
        const label = `${e.show_name}: ${e.title} (${e.published_at.slice(0, 10)})`;
        lines.push(`- ${e.url ? `[${label}](${e.url})` : label}`);
      }
      lines.push("");
    }
  }
  lines.push(
    "---",
    `${b.stats.episodes_considered} episodes from ${b.stats.shows_with_episodes} shows analysed.${siteUrl ? ` Full brief and archive: ${siteUrl}` : ""}`,
  );
  return lines.join("\n");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Email-safe HTML (inline styles, table-free single column). */
export function renderEmailHtml(b: BriefContent, siteUrl?: string): string {
  const accent: Record<SectionKey, string> = { guests: "#c2410c", topics: "#0f766e", sponsors: "#7c3aed" };
  const section = (key: SectionKey) => {
    const meta = SECTION_META[key];
    const items = b.sections[key];
    const body = items.length
      ? items
          .map(
            (it) => `
        <div style="border:1px solid #e7e2d9;border-left:4px solid ${accent[key]};border-radius:10px;padding:14px 16px;margin:0 0 12px;background:#ffffff">
          <div style="font-size:16px;font-weight:700;color:#1c1917">${esc(it.title)}${it.meta ? ` <span style="font-weight:400;color:#78716c;font-size:13px">· ${esc(it.meta)}</span>` : ""}</div>
          <div style="font-size:14px;color:#44403c;margin:6px 0">${esc(it.insight)}</div>
          <div style="font-size:14px;color:#1c1917;margin:6px 0"><strong style="color:${accent[key]}">Action:</strong> ${esc(it.action)}</div>
          <div style="font-size:12px;color:#78716c;margin-top:8px">${it.episodes
            .slice(0, 4)
            .map((e) =>
              e.url
                ? `<a href="${esc(e.url)}" style="color:#57534e">${esc(e.show_name)}: ${esc(e.title)}</a>`
                : `${esc(e.show_name)}: ${esc(e.title)}`,
            )
            .join("<br>")}</div>
        </div>`,
          )
          .join("")
      : `<p style="font-size:14px;color:#78716c">${esc(meta.empty)}</p>`;
    return `
      <h2 style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${accent[key]};margin:28px 0 4px">${esc(meta.label)}</h2>
      <p style="font-size:13px;color:#78716c;margin:0 0 12px">${esc(meta.question)}</p>${body}`;
  };
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:28px 18px">
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a8a29e">Podcast Ecosystem Radar · week of ${esc(b.week_of)}</div>
    <h1 style="font-size:24px;line-height:1.3;color:#1c1917;margin:8px 0 12px">This week in one line</h1>
    <p style="font-size:16px;line-height:1.55;color:#292524;margin:0">${esc(b.headline)}</p>
    ${SECTION_ORDER.map(section).join("")}
    <p style="font-size:12px;color:#a8a29e;margin-top:28px">${b.stats.episodes_considered} episodes from ${b.stats.shows_with_episodes} shows analysed with Gemini Flash.${siteUrl ? ` <a href="${esc(siteUrl)}" style="color:#78716c">Open the full brief and archive</a>.` : ""}</p>
  </div></body></html>`;
}
