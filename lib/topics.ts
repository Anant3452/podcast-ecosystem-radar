import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateJson } from "@/lib/gemini";

/**
 * One Gemini call per run: take this week's raw topic labels and map each to a
 * canonical label, so "fundraising" and "raising funds" collapse together.
 * The mapping is persisted in topic_canon and applied by lib/analyze.ts.
 */

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    mapping: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { raw: { type: Type.STRING }, canonical: { type: Type.STRING } },
        required: ["raw", "canonical"],
      },
    },
  },
  required: ["mapping"],
};

const Validator = z.object({
  mapping: z.array(z.object({ raw: z.string(), canonical: z.string().trim().min(2) })).catch([]),
});

const SYSTEM = `You merge near-duplicate podcast topic labels into canonical topics.
You receive a JSON array of topic labels. Return a mapping entry for EVERY input label (raw must be copied exactly).
- Labels that mean the same theme map to ONE shared canonical label (e.g. "fundraising", "raising funds", "VC fundraising" -> "Fundraising").
- Keep distinct themes distinct; don't merge merely related ideas (e.g. "IPO markets" and "angel investing" stay separate).
- Canonical labels are short (1-4 words), Title Case, specific enough to be useful to a podcast host (e.g. "Quick Commerce", "AI Agents", "D2C Brand Building").
- Do NOT collapse labels into vague umbrella categories ("Business", "Entrepreneurship", "Business Strategy", "Technology", "Artificial Intelligence") when the inputs are more specific: "AI coding tools" and "AI job displacement" are different topics. Use an umbrella label only for inputs that are themselves that vague.
- If a list of EXISTING canonical labels is given, reuse one of them whenever it fits.
- Never invent new themes that aren't represented in the inputs.`;

export async function canonicalizeTopics(rawLabels: string[]): Promise<Map<string, string>> {
  const sql = await db();
  const unique = [...new Map(rawLabels.map((l) => [l.trim().toLowerCase(), l.trim()])).values()].filter(Boolean);
  const canon = new Map<string, string>();
  if (unique.length === 0) return canon;

  const existing = await sql<{ canonical: string }[]>`
    SELECT DISTINCT canonical FROM topic_canon ORDER BY canonical LIMIT 300`;
  const prompt = [
    existing.length ? `EXISTING CANONICAL LABELS:\n${JSON.stringify(existing.map((r) => r.canonical))}` : "",
    `TOPIC LABELS TO MAP:\n${JSON.stringify(unique)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const { mapping } = await generateJson({ system: SYSTEM, prompt, responseSchema, validator: Validator, temperature: 0 });
    for (const m of mapping) canon.set(m.raw.trim().toLowerCase(), m.canonical);
  } catch (err) {
    // Fall back to identity mapping; analysis still works, just with less merging.
    console.error(`[topics] canonicalization failed, using raw labels: ${(err as Error).message}`);
  }
  // Any label the model skipped maps to itself.
  for (const l of unique) if (!canon.has(l.toLowerCase())) canon.set(l.toLowerCase(), l);

  const rows = [...canon.entries()].map(([raw, canonical]) => ({ raw, canonical }));
  await sql`
    INSERT INTO topic_canon ${sql(rows, "raw", "canonical")}
    ON CONFLICT (raw) DO UPDATE SET canonical = EXCLUDED.canonical, updated_at = now()`;
  console.log(`[topics] ${unique.length} labels -> ${new Set(canon.values()).size} canonical topics`);
  return canon;
}
