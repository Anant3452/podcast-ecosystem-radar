import { describe, expect, it } from "vitest";
import { dedupeExtraction, dropSelfBrands } from "@/lib/extract";

describe("dropSelfBrands", () => {
  it("drops the show's own brands, prefixed variants and podcast platforms", () => {
    const x = dropSelfBrands(
      {
        guests: [],
        topics: [],
        brands: [
          { name: "BeerBiceps SkillHouse", relationship: "ad_read" },
          { name: "Megaphone", relationship: "sponsor" },
          { name: "Spotify", relationship: "mentioned" },
          { name: "Zepto", relationship: "sponsor" },
        ],
      },
      ["BeerBiceps"],
    );
    expect(x.brands.map((b) => b.name)).toEqual(["Zepto"]);
  });
});

describe("dedupeExtraction", () => {
  it("keeps the strongest relationship per brand and dedupes guests and topics", () => {
    const x = dedupeExtraction({
      guests: [{ name: "A B", role_or_company: null }, { name: "a b", role_or_company: "X" }],
      topics: ["AI", "ai", "Fundraising"],
      brands: [
        { name: "Zepto", relationship: "mentioned" },
        { name: "zepto", relationship: "sponsor" },
      ],
    });
    expect(x.guests).toHaveLength(1);
    expect(x.topics).toHaveLength(2);
    expect(x.brands).toEqual([{ name: "zepto", relationship: "sponsor" }]);
  });
});
