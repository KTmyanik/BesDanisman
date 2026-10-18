import { describe, expect, it } from "vitest";
import { buildMacroAnalysis } from "./macro-analysis";
import type { ScoredMenuFund } from "./fund-menu";
import {
  GLIDE_PATH,
  REBALANCE_THRESHOLD,
  categoryTargets,
  defensiveShare,
  generateRecommendation,
  growthShare,
} from "./portfolio-engine";
import { horizonAnswerFromYears } from "./person-profile";
import type { FundCategory, MarketSnapshot, RiskLevel } from "./types";

const RISKS: RiskLevel[] = ["dusuk", "orta", "yuksek"];
const YEARS = [0, 5, 10, 20, 30];

function emptyMarket(): MarketSnapshot {
  return {
    usdTry: null,
    usdTryChange: null,
    usdTryAsOf: null,
    eurTry: null,
    eurTryChange: null,
    eurTryAsOf: null,
    bist100: null,
    bist100Change: null,
    bist100AsOf: null,
    sp500: null,
    sp500Change: null,
    sp500AsOf: null,
    goldUsd: null,
    goldChange: null,
    goldAsOf: null,
    vix: null,
    vixChange: null,
    vixAsOf: null,
  };
}

function stressedMarket(): MarketSnapshot {
  return {
    ...emptyMarket(),
    usdTry: 40,
    usdTryChange: 1,
    usdTryAsOf: "2026-10-16",
    bist100: 10000,
    bist100Change: -2,
    bist100AsOf: "2026-10-16",
    goldUsd: 2000,
    goldChange: 1,
    goldAsOf: "2026-10-16",
    vix: 30,
    vixChange: 1,
    vixAsOf: "2026-10-16T12:00:00.000Z",
  };
}

function fund(code: string, category: FundCategory): ScoredMenuFund {
  return {
    code,
    name: `${code} FON`,
    shortName: `${code} FON`,
    fundType: category,
    companyCode: "ORN",
    company: "ÖRNEK EMEKLİLİK A.Ş.",
    category,
    katilim: false,
    tefasDurum: true,
    riskDegeri: 4,
    getiri1y: 10,
    getiri6a: 4,
    getiriYb: 3,
    getiri3y: null,
    yillikUcret: 1.5,
    portfoyBuyukluk: 1_000_000_000,
    score: 10,
    scoreBreakdown: {
      getiriPuani: 1,
      tutarlilikPuani: 1,
      ucretPuani: 1,
      buyuklukPuani: 1,
      tefasPuani: 1,
      riskUyumPuani: 1,
      getiri1y: 10,
      getiri6a: 4,
      getiriYb: 3,
      getiri3y: null,
      yillikUcret: 1.5,
      portfoyBuyukluk: 1_000_000_000,
    },
  };
}

const fullMenu = [
  fund("PP", "para_piyasasi"),
  fund("BO", "borclanma"),
  fund("AU", "altin"),
  fund("HS", "hisse"),
  fund("KM", "karma"),
  fund("DP", "dis_piyasa"),
  fund("EM", "kiymetli_maden"),
];

function plan(overrides: Partial<Parameters<typeof generateRecommendation>[0]> = {}) {
  return generateRecommendation({
    riskLevel: "orta",
    riskScore: 50,
    yearsToRetirement: 18,
    katilim: false,
    holdings: [],
    macro: buildMacroAnalysis(emptyMarket()),
    isNewAccount: true,
    menu: fullMenu,
    companyCode: "ORN",
    companyName: "ÖRNEK EMEKLİLİK A.Ş.",
    ...overrides,
  });
}

describe("glide path", () => {
  it("sums to 100 for every risk band and horizon, with and without tilt", () => {
    for (const risk of RISKS) {
      for (const years of YEARS) {
        for (const market of [emptyMarket(), stressedMarket()]) {
          const { glide, targets, tilt } = categoryTargets(risk, years, buildMacroAnalysis(market));
          for (const allocation of [glide, targets]) {
            const values = Object.values(allocation);
            expect(values.reduce((sum, value) => sum + value, 0)).toBe(100);
            expect(values.every((value) => value >= 0)).toBe(true);
          }
          const moved = Object.values(tilt).reduce((sum, value) => sum + Math.abs(value), 0);
          expect(moved).toBeLessThanOrEqual(8);
          for (const key of Object.keys(glide) as FundCategory[]) {
            expect(Math.abs(targets[key] - glide[key])).toBeLessThanOrEqual(3);
          }
        }
      }
    }
  });

  it("gives a long horizon more growth and a short horizon more cash and bonds", () => {
    for (const risk of RISKS) {
      const buckets = YEARS.map((years) => categoryTargets(risk, years, buildMacroAnalysis(emptyMarket())).glide);
      for (let index = 1; index < buckets.length; index += 1) {
        expect(growthShare(buckets[index])).toBeGreaterThan(growthShare(buckets[index - 1]));
        expect(defensiveShare(buckets[index])).toBeLessThan(defensiveShare(buckets[index - 1]));
      }
    }
    const bucket = horizonAnswerFromYears(18);
    expect(Object.values(GLIDE_PATH.orta[bucket]).reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("keeps commodity apart unless the menu has no precious-metal fund", () => {
    const separate = plan();
    expect(separate.allocationNotes).toEqual([]);
    expect(separate.targetAllocation.find((item) => item.fundId === "EM")?.percentage).toBeGreaterThan(0);
    expect(separate.targetAllocation.find((item) => item.fundId === "AU")?.percentage).toBe(12);

    const merged = plan({ menu: fullMenu.filter((item) => item.code !== "EM") });
    expect(merged.allocationNotes).toEqual([
      "Menüde ayrı kıymetli maden fonu olmadığı için emtia payı altına yazıldı.",
    ]);
    expect(merged.targetAllocation.some((item) => item.category === "emtia")).toBe(false);
    expect(merged.targetAllocation.find((item) => item.fundId === "AU")?.percentage).toBe(15);
  });

  it("leaves a missing menu sleeve unfilled instead of moving its weight", () => {
    const result = plan({ menu: fullMenu.filter((item) => item.code !== "PP") });
    const para = result.unfilled.find((item) => item.category === "para_piyasasi");
    expect(para?.percentage).toBe(15);
    const filled = result.targetAllocation.reduce((sum, item) => sum + item.percentage, 0);
    expect(filled + (para?.percentage ?? 0)).toBe(100);
    expect(result.targetAllocation.find((item) => item.fundId === "HS")?.percentage).toBe(18);
  });

  it("skips an existing gap under 5 points and still shows a new-account target", () => {
    const fresh = plan({ yearsToRetirement: 2, riskLevel: "dusuk" });
    const small = fresh.targetAllocation.find((item) => item.percentage < REBALANCE_THRESHOLD);
    expect(small).toBeTruthy();
    expect(fresh.actions.some((action) => action.fundId === small?.fundId)).toBe(true);
    expect(fresh.actions.every((action) => !action.reason.includes("momentum"))).toBe(true);
    expect(fresh.actions[0]?.reason).toContain("5 yıldan az");

    const holdings = fresh.targetAllocation.map((item) => ({
      fundId: item.fundId,
      percentage: item.fundId === small?.fundId ? 0 : item.percentage,
    }));
    const quiet = plan({
      yearsToRetirement: 2,
      riskLevel: "dusuk",
      isNewAccount: false,
      holdings,
    });
    expect(quiet.actions.some((action) => action.fundId === small?.fundId)).toBe(false);
    const quietRow = quiet.fundDeltas.find((row) => row.fundId === small?.fundId);
    expect(quietRow?.currentPercent).toBe(0);
    expect(quietRow?.targetPercent).toBe(small?.percentage);

    const loudHoldings = fresh.targetAllocation.map((item) => ({
      fundId: item.fundId,
      percentage: item.fundId === "BO" ? item.percentage - REBALANCE_THRESHOLD : item.percentage,
    }));
    const loud = plan({
      yearsToRetirement: 2,
      riskLevel: "dusuk",
      isNewAccount: false,
      holdings: loudHoldings,
    });
    expect(loud.actions.some((action) => action.fundId === "BO")).toBe(true);
    const loudReason = loud.actions.find((action) => action.fundId === "BO")?.reason ?? "";
    expect(loudReason).not.toContain("BIST");
    expect(loudReason).toContain("BO");
    expect(loudReason).toContain("eşik 5 puan");
    expect(loudReason.split(".").length).toBe(2);
  });

  it("lists the rules that did not fire", () => {
    const missingType = { ...fund("XX", "karma"), category: null, fundType: "Bilinmeyen" };
    const result = plan({
      menu: [...fullMenu.filter((item) => item.code !== "PP"), missingType],
    });
    const texts = result.skippedRules.map((rule) => rule.text).join(" ");
    expect(texts).toContain("USD/TRY");
    expect(texts).toContain("EUR/TRY");
    expect(texts).toContain("XX fon türü eşleşmedi");
    expect(texts).toContain("Para Piyasası menüde yok");
    const noFee = plan({
      menu: fullMenu.map((item) => (item.code === "AU" ? { ...item, yillikUcret: null } : item)),
    });
    expect(noFee.skippedRules.some((rule) => rule.text.includes("AU ücreti bilinmiyor"))).toBe(true);
    expect(result.fundDeltas.every((row) => row.currentPercent === 0)).toBe(true);
    expect(result.actions[0]?.reason.includes("Makro ortam")).toBe(false);
  });

  it("keeps a fund from another company in the current book and out of the target", () => {
    const result = plan({
      isNewAccount: false,
      holdings: [
        { fundId: "HS", percentage: 60 },
        { fundId: "DIS", percentage: 40 },
      ],
      directory: [
        {
          code: "DIS",
          shortName: "DİĞER HİSSE",
          category: "hisse",
          companyCode: "DIG",
        },
      ],
    });
    expect(result.targetAllocation.some((item) => item.fundId === "DIS")).toBe(false);
    const row = result.fundDeltas.find((item) => item.fundId === "DIS");
    expect(row?.currentPercent).toBe(40);
    expect(row?.targetPercent).toBe(0);
    const action = result.actions.find((item) => item.fundId === "DIS");
    expect(action?.type).toBe("cikar");
    expect(action?.reason).toContain("seçilen şirketin menüsünde değil");
    expect(action?.reason).toContain("eşik 5 puan");
  });
});
