import { describe, expect, it } from "vitest";
import { clusterByName, levenshtein, normalizeBrandName, normalizePersonName } from "@/lib/normalize";

describe("normalizePersonName", () => {
  it("lowercases, strips honorifics, punctuation and extra whitespace", () => {
    expect(normalizePersonName("Dr. Ritesh   Agarwal")).toBe("ritesh agarwal");
    expect(normalizePersonName("Mr. Kunal Shah,")).toBe("kunal shah");
    expect(normalizePersonName("Shri  Nithin Kamath")).toBe("nithin kamath");
  });

  it("strips diacritics and apostrophes", () => {
    expect(normalizePersonName("Zoë O'Brien")).toBe("zoe obrien");
  });

  it("keeps a name that is only an honorific-like word empty-safe", () => {
    expect(normalizePersonName("Dr.")).toBe("");
  });
});

describe("normalizeBrandName", () => {
  it("removes decorative suffixes", () => {
    expect(normalizeBrandName("Zepto App")).toBe("zepto");
    expect(normalizeBrandName("Zepto")).toBe("zepto");
    expect(normalizeBrandName("Razorpay Pvt. Ltd.")).toBe("razorpay");
    expect(normalizeBrandName("zepto.com")).toBe("zepto");
    expect(normalizeBrandName("The Whole Truth")).toBe("whole truth");
  });

  it("never reduces a brand to an empty string", () => {
    expect(normalizeBrandName("India")).toBe("india");
    expect(normalizeBrandName("Tech")).toBe("tech");
  });
});

describe("levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });

  it("exits early beyond max", () => {
    expect(levenshtein("abcdefgh", "zzzzzzzz", 2)).toBeGreaterThan(2);
  });
});

describe("clusterByName", () => {
  const names = (xs: string[]) => xs.map((name) => ({ name }));

  it("merges spellings within distance 2", () => {
    const clusters = clusterByName(
      names(["Kunal Shah", "Kunaal Shah", "Dr. Kunal Shah", "Nithin Kamath"]),
      (x) => x.name,
      normalizePersonName,
    );
    expect(clusters).toHaveLength(2);
    const kunal = clusters.find((c) => c.key.includes("kunal"))!;
    expect(kunal.members).toHaveLength(3);
    expect(kunal.display).toBe("Kunal Shah");
  });

  it("merges brand variants like 'Zepto' and 'Zepto app'", () => {
    const clusters = clusterByName(names(["Zepto", "Zepto app", "ZEPTO"]), (x) => x.name, normalizeBrandName);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(3);
  });

  it("does not merge distinct short brands two edits apart ('Intel' vs 'Airtel')", () => {
    const clusters = clusterByName(names(["Intel", "Airtel"]), (x) => x.name, normalizeBrandName);
    expect(clusters).toHaveLength(2);
  });

  it("allows one edit for 5-7 character names ('Zepto' ~ 'Zeptoo')", () => {
    const clusters = clusterByName(names(["Zepto", "Zeptoo"]), (x) => x.name, normalizeBrandName);
    expect(clusters).toHaveLength(1);
  });

  it("does not merge short distinct names", () => {
    const clusters = clusterByName(names(["Ola", "Oyo", "Uber"]), (x) => x.name, normalizeBrandName);
    expect(clusters).toHaveLength(3);
  });

  it("does not merge names further than 2 edits apart", () => {
    const clusters = clusterByName(names(["Aman Gupta", "Anupam Gupta"]), (x) => x.name, normalizePersonName);
    expect(clusters).toHaveLength(2);
  });

  it("chains transitively (single link)", () => {
    const clusters = clusterByName(names(["abcdefgh", "abcdefxy", "abcdezzy"]), (x) => x.name, (s) => s);
    expect(clusters).toHaveLength(1);
  });

  it("skips empty normalized names", () => {
    expect(clusterByName(names(["Dr.", "  "]), (x) => x.name, normalizePersonName)).toHaveLength(0);
  });
});
