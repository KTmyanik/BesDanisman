import { describe, expect, it } from "vitest";
import type { ClassifiedFund } from "./fund-snapshot";
import { SCORE_WEIGHTS, scoreFunds } from "./fund-score";

function fund(overrides: Partial<ClassifiedFund>): ClassifiedFund {
  return {
    code: "AAA",
    name: "FON",
    shortName: "FON",
    fundType: "Hisse Senedi Fonu",
    companyCode: "ORN",
    company: "ÖRNEK",
    category: "hisse",
    katilim: false,
    tefasDurum: true,
    riskDegeri: 6,
    getiri1y: 10,
    getiri6a: 4,
    getiriYb: 3,
    getiri3y: 12,
    yillikUcret: 1.5,
    portfoyBuyukluk: 1_000_000_000,
    ...overrides,
  };
}

describe("peer fund score", () => {
  it("keeps fee and size inside a cap below the return rank", () => {
    expect(SCORE_WEIGHTS.fee + SCORE_WEIGHTS.size).toBeLessThan(SCORE_WEIGHTS.returnRank);
  });

  it("does not let a high return and a missing window pass a consistent cheaper fund", () => {
    const cheap = fund({
      code: "UCZ",
      getiri1y: 20,
      getiri3y: 18,
      yillikUcret: 1,
    });
    const expensive = fund({
      code: "PAH",
      getiri1y: 80,
      getiri3y: null,
      yillikUcret: 4.5,
    });
    const scores = scoreFunds([cheap, expensive], 18);
    expect(scores.get("UCZ")!.score).toBeGreaterThan(scores.get("PAH")!.score);
    expect(scores.get("PAH")!.scoreBreakdown.getiri3y).toBeNull();
    expect(scores.get("PAH")!.scoreBreakdown.getiriPuani).not.toBe(0);
  });

  it("does not let fee and size overturn a full return-rank gap", () => {
    const cheap = fund({ code: "UCZ", getiri1y: 20, getiri3y: 18, yillikUcret: 1 });
    const expensive = fund({ code: "PAH", getiri1y: 80, getiri3y: 70, yillikUcret: 4.5 });
    const scores = scoreFunds([cheap, expensive], 18);
    expect(scores.get("PAH")!.score).toBeGreaterThan(scores.get("UCZ")!.score);
  });

  it("uses the short window for money market and ignores a large one-year return", () => {
    const quiet = fund({
      code: "KISA",
      category: "para_piyasasi",
      getiri6a: 8,
      getiri1y: 1,
      getiri3y: null,
    });
    const flashy = fund({
      code: "UZUN",
      category: "para_piyasasi",
      getiri6a: 2,
      getiri1y: 80,
      getiri3y: null,
    });
    const scores = scoreFunds([quiet, flashy], 18);
    expect(scores.get("KISA")!.score).toBeGreaterThan(scores.get("UZUN")!.score);
  });

  it("shifts equity rank toward the three-year window on a long horizon", () => {
    const recent = fund({ code: "YAK", getiri1y: 40, getiri3y: 5, yillikUcret: 1.5 });
    const durable = fund({ code: "UZK", getiri1y: 10, getiri3y: 30, yillikUcret: 1.5 });
    const shortHorizon = scoreFunds([recent, durable], 4);
    const longHorizon = scoreFunds([recent, durable], 25);
    expect(shortHorizon.get("YAK")!.score).toBeGreaterThan(shortHorizon.get("UZK")!.score);
    expect(longHorizon.get("UZK")!.score).toBeGreaterThan(longHorizon.get("YAK")!.score);
  });
});
