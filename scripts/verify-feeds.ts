/**
 * Verify candidate RSS feeds: fetch each one and report how many episodes
 * were published in the last N days. Usage:
 *   npx tsx scripts/verify-feeds.ts [days] < candidates.tsv   (name<TAB>url per line)
 *   npx tsx scripts/verify-feeds.ts [days]                    (verifies config/shows.json)
 */
import { readFileSync } from "node:fs";
import Parser from "rss-parser";

const days = Number(process.argv[2] ?? 30);
const parser = new Parser({ timeout: 20000 });

async function readCandidates(): Promise<{ name: string; url: string }[]> {
  if (process.stdin.isTTY) {
    const shows = JSON.parse(readFileSync("config/shows.json", "utf8")) as {
      name: string;
      rss_url: string;
    }[];
    return shows.map((s) => ({ name: s.name, url: s.rss_url }));
  }
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks)
    .toString("utf8")
    .split("\n")
    .filter((l) => l.includes("\t"))
    .map((l) => {
      const [name, url] = l.split("\t");
      return { name: name.trim(), url: url.trim() };
    });
}

async function main() {
  const cutoff = Date.now() - days * 86400_000;
  const candidates = await readCandidates();
  const results = await Promise.all(
    candidates.map(async ({ name, url }) => {
      try {
        const feed = await parser.parseURL(url);
        const recent = feed.items.filter((i) => {
          const t = Date.parse(i.isoDate ?? i.pubDate ?? "");
          return Number.isFinite(t) && t >= cutoff;
        });
        const avgNotes = recent.length
          ? Math.round(
              recent.reduce((n, i) => n + (i.contentSnippet ?? i.content ?? "").length, 0) /
                recent.length,
            )
          : 0;
        return { name, url, ok: recent.length > 0, recent: recent.length, avgNotes };
      } catch (e) {
        return { name, url, ok: false, recent: 0, avgNotes: 0, error: (e as Error).message };
      }
    }),
  );
  for (const r of results) {
    console.log(
      `${r.ok ? "OK  " : "FAIL"} ${String(r.recent).padStart(3)} eps/${days}d  notes~${String(r.avgNotes).padStart(5)}ch  ${r.name}  ${r.url}${"error" in r ? `  (${r.error})` : ""}`,
    );
  }
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main();
