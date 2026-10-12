import { describe, expect, it } from "vitest";
import { analyze, brandSignals, guestOverlap, topicClusters, type EpisodeRecord } from "@/lib/analyze";
import type { Extraction } from "@/lib/extract";

const NOW = new Date("2026-10-12T00:30:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

let seq = 0;
function ep(show: string, ago: number, x: Partial<Extraction>): EpisodeRecord {
  seq++;
  return {
    id: String(seq),
    show_id: show,
    show_name: show.toUpperCase(),
    title: `${show} episode ${seq}`,
    url: `https://example.com/${show}/${seq}`,
    published_at: daysAgo(ago),
    extraction: { guests: [], topics: [], brands: [], ...x },
  };
}

describe("guestOverlap", () => {
  it("finds guests on 2+ distinct shows within the window, merging spellings", () => {
    const eps = [
      ep("a", 3, { guests: [{ name: "Kunal Shah", role_or_company: "CRED" }] }),
      ep("b", 10, { guests: [{ name: "Kunaal Shah", role_or_company: null }] }),
      ep("c", 40, { guests: [{ name: "Kunal Shah", role_or_company: null }] }), // outside 30d
      ep("a", 5, { guests: [{ name: "Solo Guest", role_or_company: null }] }),
    ];
    const res = guestOverlap(eps, NOW, 30);
    expect(res).toHaveLength(1);
    expect(res[0].name).toMatch(/Kuna+l Shah/);
    expect(res[0].role_or_company).toBe("CRED");
    expect(res[0].show_count).toBe(2);
    expect(res[0].shows.map((s) => s.show_id)).toEqual(["a", "b"]);
    expect(res[0].episodes.every((e) => e.url?.startsWith("https://example.com/"))).toBe(true);
  });

  it("does not count two episodes of the same show as overlap", () => {
    const eps = [
      ep("a", 1, { guests: [{ name: "Same Show", role_or_company: null }] }),
      ep("a", 2, { guests: [{ name: "Same Show", role_or_company: null }] }),
    ];
    expect(guestOverlap(eps, NOW, 30)).toHaveLength(0);
  });

  it("ranks by number of shows", () => {
    const g = (name: string) => ({ guests: [{ name, role_or_company: null }] });
    const eps = [ep("a", 1, g("Two Shows")), ep("b", 1, g("Two Shows")), ep("a", 1, g("Three Shows")), ep("b", 1, g("Three Shows")), ep("c", 1, g("Three Shows"))];
    expect(guestOverlap(eps, NOW, 30).map((x) => x.name)).toEqual(["Three Shows", "Two Shows"]);
  });
});

describe("topicClusters", () => {
  it("groups canonical topics covered by 2+ shows within 7 days", () => {
    const canon = new Map([
      ["fundraising", "Fundraising"],
      ["raising funds", "Fundraising"],
      ["quick commerce", "Quick Commerce"],
    ]);
    const eps = [
      ep("a", 1, { topics: ["fundraising", "quick commerce"] }),
      ep("b", 6, { topics: ["Raising funds"] }),
      ep("c", 9, { topics: ["quick commerce"] }), // outside 7d
    ];
    const res = topicClusters(eps, NOW, 7, canon);
    expect(res.map((t) => t.topic)).toEqual(["Fundraising"]);
    expect(res[0].show_count).toBe(2);
    expect(res[0].episodes).toHaveLength(2);
  });

  it("counts a topic once per episode even if repeated", () => {
    const eps = [ep("a", 1, { topics: ["AI", "ai"] }), ep("b", 1, { topics: ["AI"] })];
    const res = topicClusters(eps, NOW, 7);
    expect(res[0].episodes).toHaveLength(2);
  });
});

describe("brandSignals", () => {
  it("keeps only brands with at least one sponsor/ad_read, ranked by distinct shows", () => {
    const eps = [
      ep("a", 2, { brands: [{ name: "Zepto", relationship: "sponsor" }, { name: "OnlyMentioned", relationship: "mentioned" }] }),
      ep("b", 3, { brands: [{ name: "Zepto app", relationship: "mentioned" }] }),
      ep("c", 4, { brands: [{ name: "Groww", relationship: "ad_read" }] }),
      ep("d", 50, { brands: [{ name: "OldSponsor", relationship: "sponsor" }] }), // outside window
    ];
    const res = brandSignals(eps, NOW, 30);
    expect(res.map((b) => b.brand)).toEqual(["Zepto", "Groww"]);
    expect(res[0].show_count).toBe(2);
    expect(res[0].paid_show_count).toBe(1);
    expect(res[0].relationships).toEqual(["sponsor", "mentioned"]);
    expect(res[0].episodes.map((e) => e.relationship).sort()).toEqual(["mentioned", "sponsor"]);
  });
});

describe("analyze", () => {
  it("is deterministic and reports windows and stats", () => {
    const eps = [
      ep("a", 1, { guests: [{ name: "X Person", role_or_company: null }], topics: ["ai agents"] }),
      ep("b", 2, { guests: [{ name: "X Person", role_or_company: null }], topics: ["AI agents"] }),
    ];
    const opts = { now: NOW, guestWindowDays: 30, topicWindowDays: 7 };
    const a = analyze(eps, opts);
    expect(a).toEqual(analyze(eps, opts));
    expect(a.stats).toEqual({ episodes_considered: 2, shows_with_episodes: 2, episodes_in_topic_window: 2 });
    expect(a.guest_overlap).toHaveLength(1);
    expect(a.topic_clusters).toHaveLength(1);
    expect(a.windows.topic.days).toBe(7);
    expect(a.windows.brand.days).toBe(30);
  });

  it("ignores future-dated episodes", () => {
    const future = ep("a", -2, { topics: ["t"] });
    const now = ep("b", 1, { topics: ["t"] });
    expect(analyze([future, now], { now: NOW, guestWindowDays: 30, topicWindowDays: 7 }).topic_clusters).toHaveLength(0);
  });
});
