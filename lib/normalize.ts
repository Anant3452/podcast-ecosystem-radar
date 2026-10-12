/**
 * Deterministic entity resolution for guests and brands.
 * Pure functions only, so they're easy to unit test.
 */

const HONORIFICS = new Set([
  "mr", "mrs", "ms", "miss", "mx", "dr", "prof", "professor", "sir", "shri", "sri", "smt", "kumari",
  "capt", "col", "gen", "adv", "ca", "er", "hon", "jr", "sr", "phd", "md",
]);

// Words that decorate a brand name without changing which company it is.
const BRAND_SUFFIXES = new Set([
  "app", "apps", "india", "inc", "ltd", "limited", "pvt", "private", "llp", "llc", "co", "company",
  "corp", "corporation", "technologies", "technology", "tech", "labs", "official", "com", "in", "the",
]);

function baseClean(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Dr. Ritesh  Agarwal (OYO)" -> "ritesh agarwal oyo"; honorifics and punctuation removed. */
export function normalizePersonName(name: string): string {
  return baseClean(name)
    .split(" ")
    .filter((w) => w && !HONORIFICS.has(w))
    .join(" ");
}

/** "Zepto App", "zepto.com", "Zepto Pvt Ltd" -> "zepto". */
export function normalizeBrandName(name: string): string {
  const words = baseClean(name).split(" ").filter(Boolean);
  // Strip decorative words from the end (and a leading "the"), but never empty the name.
  while (words.length > 1 && BRAND_SUFFIXES.has(words[words.length - 1])) words.pop();
  if (words.length > 1 && words[0] === "the") words.shift();
  return words.join(" ");
}

/** Classic Levenshtein edit distance with an early exit once `max` is exceeded. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export type Cluster<T> = {
  /** Normalized key of the cluster's representative. */
  key: string;
  /** Most common original spelling, used for display. */
  display: string;
  members: T[];
};

/**
 * Edit-distance budget for a pair of normalized names. The full `maxDistance`
 * (2) applies to names of 8+ characters ("Kunaal Shah" ~ "Kunal Shah");
 * 5-7 character names get 1 edit ("Zepto" ~ "Zeptoo"); shorter names must
 * match exactly ("Ola" vs "Oyo"). Two edits on a short word changes too much
 * of it: "Intel" and "Airtel" are distance 2 but different companies.
 */
export function allowedDistance(a: string, b: string, maxDistance = 2): number {
  const len = Math.min(a.length, b.length);
  if (len < 5) return 0;
  if (len < 8) return Math.min(1, maxDistance);
  return maxDistance;
}

/**
 * Group items whose normalized names are close (see `allowedDistance`), using
 * single-link clustering via union-find. Merged names must also share their
 * first character, which typos almost never change.
 */
export function clusterByName<T>(
  items: T[],
  getName: (item: T) => string,
  normalizeFn: (name: string) => string,
  maxDistance = 2,
): Cluster<T>[] {
  const keys = [...new Set(items.map((i) => normalizeFn(getName(i))).filter(Boolean))];
  const parent = new Map(keys.map((k) => [k, k]));
  const find = (k: string): string => {
    let root = k;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(k, root);
    return root;
  };
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      const budget = allowedDistance(a, b, maxDistance);
      if (budget === 0 || a[0] !== b[0]) continue;
      if (levenshtein(a, b, budget) <= budget) {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(rb, ra);
      }
    }
  }

  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = normalizeFn(getName(item));
    if (!k) continue;
    const root = find(k);
    const list = groups.get(root) ?? [];
    list.push(item);
    groups.set(root, list);
  }

  return [...groups.entries()].map(([root, members]) => {
    // Pick the most common normalized variant ("kunal shah" x2 beats "kunaal shah" x1),
    // then its least decorated original spelling ("Kunal Shah" over "Dr. Kunal Shah",
    // "Zepto" over "Zepto app"), alphabetical as the final tie-break.
    const variantCounts = new Map<string, number>();
    for (const m of members) {
      const v = normalizeFn(getName(m));
      variantCounts.set(v, (variantCounts.get(v) ?? 0) + 1);
    }
    const decoration = (s: string) => s.length - normalizeFn(s).length;
    const display = members
      .map((m) => getName(m).trim())
      .sort(
        (x, y) =>
          variantCounts.get(normalizeFn(y))! - variantCounts.get(normalizeFn(x))! ||
          decoration(x) - decoration(y) ||
          x.localeCompare(y),
      )[0];
    return { key: root, display, members };
  });
}
