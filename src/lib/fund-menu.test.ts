import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { marketExamples, mergeHoldings, validatePlanRequest } from "./fund-menu";
import { classifySnapshot, loadFundSnapshot, SNAPSHOT_MAX_AGE_MS, snapshotProblem, type FundSnapshot } from "./fund-snapshot";
import type { ClassifiedFund } from "./fund-snapshot";

function fund(overrides: Partial<ClassifiedFund>): ClassifiedFund {
  return {
    code: "AAA",
    name: "ÖRNEK EMEKLİLİK A.Ş. FON",
    shortName: "FON",
    fundType: "Hisse Senedi Fonu",
    companyCode: "ORN",
    company: "ÖRNEK EMEKLİLİK A.Ş.",
    category: "hisse",
    katilim: false,
    tefasDurum: true,
    riskDegeri: 6,
    getiri1y: 10,
    getiri6a: 5,
    getiriYb: 4,
    getiri3y: null,
    yillikUcret: 1.5,
    portfoyBuyukluk: 1_000_000_000,
    ...overrides,
  };
}

const menu = [
  fund({ code: "AAA" }),
  fund({ code: "BBB", category: "altin", fundType: "Altın Fonu" }),
  fund({
    code: "KKK",
    companyCode: "KAT",
    katilim: true,
    category: "katilim_hisse",
    fundType: "Katılım Hisse Senedi Fonu",
  }),
];

describe("portfolio validation", () => {
  it("merges two rows of the same code", () => {
    expect(
      mergeHoldings([
        { fundId: "aaa", percentage: 40 },
        { fundId: "AAA", percentage: 60 },
      ])
    ).toEqual([{ fundId: "AAA", percentage: 100 }]);
  });

  it("rejects an unknown code, a katılım mismatch, and a total other than 100", () => {
    expect(
      validatePlanRequest({
        companyCode: "ORN",
        katilim: false,
        isNewAccount: false,
        holdings: [{ fundId: "ZZZ", percentage: 100 }],
        funds: menu,
      }).ok
    ).toBe(false);

    expect(
      validatePlanRequest({
        companyCode: "ORN",
        katilim: false,
        isNewAccount: false,
        holdings: [{ fundId: "KKK", percentage: 100 }],
        funds: menu,
      })
    ).toMatchObject({ status: 400 });

    expect(
      validatePlanRequest({
        companyCode: "ORN",
        katilim: false,
        isNewAccount: false,
        holdings: [
          { fundId: "AAA", percentage: 40 },
          { fundId: "BBB", percentage: 40 },
        ],
        funds: menu,
      })
    ).toMatchObject({ status: 400 });
  });

  it("does not produce a plan for an empty company menu", () => {
    const result = validatePlanRequest({
      companyCode: "YOK",
      katilim: false,
      isNewAccount: true,
      holdings: [],
      funds: menu,
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
    });
    if (!result.ok) {
      expect(result.error).toContain("Plan üretilmedi");
    }
  });

  it("rejects a stale or missing snapshot", () => {
    expect(snapshotProblem(null)).toContain("yok");
    const stale: FundSnapshot = {
      fetchedAt: new Date(Date.now() - SNAPSHOT_MAX_AGE_MS - 1000).toISOString(),
      source: "test",
      funds: [fund({})],
    };
    expect(snapshotProblem(stale)).toContain("güncel değil");
    const fresh: FundSnapshot = {
      fetchedAt: new Date().toISOString(),
      source: "test",
      funds: [fund({})],
    };
    expect(snapshotProblem(fresh)).toBeNull();
  });

  it("classifies the current snapshot without sending standard funds to money market", () => {
    const file = fileURLToPath(new URL("../../data/funds-snapshot.json", import.meta.url));
    if (!existsSync(file)) return;
    const snapshot = loadFundSnapshot(file);
    expect(snapshot).not.toBeNull();
    if (!snapshot) return;
    const funds = classifySnapshot(snapshot);
    const byCode = new Map(funds.map((item) => [item.code, item]));
    expect(byCode.get("AVN")?.category).toBe("standart");
    expect(byCode.get("AAJ")?.category).toBe("oks_standart");
    expect(byCode.get("GEV")?.category).toBe("altin");
    expect(byCode.get("GEV")?.katilim).toBe(true);
    expect(byCode.get("AMG")?.category).toBe("doviz_borclanma");
    expect(byCode.get("AVR")?.category).toBe("dis_piyasa");
    expect(funds.every((item) => item.companyCode.length > 0)).toBe(true);
    expect(funds.some((item) => item.fundType === "Standart Fon" && item.category === "para_piyasasi")).toBe(
      false
    );
  });

  it("accepts another company's fund in the current portfolio and keeps the target menu", () => {
    const outside = fund({
      code: "DIS",
      companyCode: "DIG",
      company: "DİĞER EMEKLİLİK A.Ş.",
    });
    const result = validatePlanRequest({
      companyCode: "ORN",
      katilim: false,
      isNewAccount: false,
      holdings: [
        { fundId: "AAA", percentage: 60 },
        { fundId: "DIS", percentage: 40 },
      ],
      funds: [...menu, outside],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.holdings.map((item) => item.fundId).sort()).toEqual(["AAA", "DIS"]);
    expect(result.menu.every((item) => item.companyCode === "ORN")).toBe(true);
  });

  it("keeps another company's fund out of the target and in the comparison list", () => {
    const outside = fund({
      code: "ZZZ",
      companyCode: "DIG",
      company: "DİĞER EMEKLİLİK A.Ş.",
      category: "hisse",
    });
    const examples = marketExamples([fund({ code: "AAA" }), outside], false, 18, ["hisse"]);
    expect(examples.map((item) => item.rank)).toEqual([1, 2]);
    expect(examples.map((item) => item.code).sort()).toEqual(["AAA", "ZZZ"]);
    expect(JSON.stringify(examples)).not.toContain("percentage");
  });

  it("does not launch Python while ranking", () => {
    const source = readFileSync(new URL("./fund-menu.ts", import.meta.url), "utf8");
    const route = readFileSync(new URL("../app/api/recommend/route.ts", import.meta.url), "utf8");
    expect(source).not.toContain("execFile");
    expect(route).not.toContain("execFile");
    expect(route).not.toContain("rank-bes-funds");
    expect(route).not.toContain(".py");
    expect(route).not.toContain("120000");
  });
});
