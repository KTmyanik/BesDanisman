import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const QUESTIONS = [
  "horizon",
  "loss_tolerance",
  "experience",
  "income_stability",
  "goal",
  "volatility_comfort",
];

function profile(overrides: Record<string, unknown> = {}) {
  return {
    katilim: false,
    isNewAccount: true,
    companyCode: "AHS",
    holdings: [] as { fundId: string; percentage: number }[],
    yearsToRetirement: 18,
    monthlyContributionTry: 5000,
    balanceTry: 0,
    contractType: "gonullu",
    riskAnswers: QUESTIONS.map((questionId) => ({ questionId, value: 3 })),
    ...overrides,
  };
}

function bulletin(date: string, tarih: string, usd: string, eur: string) {
  return `<?xml version="1.0"?><Tarih_Date Tarih="${tarih}" Date="${date}"><Currency CurrencyCode="USD"><Unit>1</Unit><ForexSelling>${usd}</ForexSelling></Currency><Currency CurrencyCode="EUR"><Unit>1</Unit><ForexSelling>${eur}</ForexSelling></Currency></Tarih_Date>`;
}

function quote(price: number) {
  return JSON.stringify({
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: price,
            chartPreviousClose: price,
            regularMarketTime: 1_760_800_000,
          },
        },
      ],
    },
  });
}

function marketFetch() {
  return async (input: string) => {
    if (input.includes("today.xml")) {
      return new Response(bulletin("10/16/2026", "16.10.2026", "42", "46"), { status: 200 });
    }
    if (input.includes("tcmb.gov.tr")) {
      return new Response(bulletin("10/15/2026", "15.10.2026", "40", "44"), { status: 200 });
    }
    if (input.includes("XU100")) return new Response(quote(11000), { status: 200 });
    if (input.includes("GSPC")) return new Response(quote(5000), { status: 200 });
    if (input.includes("GC%3DF") || input.includes("GC=F")) return new Response(quote(2000), { status: 200 });
    if (input.includes("VIX")) return new Response(quote(20), { status: 200 });
    return new Response("", { status: 404 });
  };
}

async function post(body: unknown, raw?: string) {
  const response = await POST(
    new Request("http://localhost/api/recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    })
  );
  return { status: response.status, json: await response.json() };
}

function planTotal(recommendation: {
  targetAllocation: { percentage: number }[];
  unfilled: { percentage: number }[];
}) {
  const filled = recommendation.targetAllocation.reduce((sum, item) => sum + item.percentage, 0);
  const open = recommendation.unfilled.reduce((sum, item) => sum + item.percentage, 0);
  return filled + open;
}

describe("recommend API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 for a missing profile, a bad percentage, a foreign code, a katilim clash, and an empty risk answer", async () => {
    const missing = await post(
      profile({ yearsToRetirement: undefined, monthlyContributionTry: undefined, balanceTry: undefined, contractType: undefined })
    );
    expect(missing.status).toBe(400);
    expect(missing.json.error).toContain("yıl");

    const badPercent = await post(
      profile({ isNewAccount: false, holdings: [{ fundId: "AVO", percentage: 140 }] })
    );
    expect(badPercent.status).toBe(400);
    expect(badPercent.json.error).toContain("yüzde");

    const foreign = await post(
      profile({ isNewAccount: false, holdings: [{ fundId: "YABANCI", percentage: 100 }] })
    );
    expect(foreign.status).toBe(400);
    expect(foreign.json.error).toContain("YABANCI");

    const clash = await post(
      profile({ isNewAccount: false, katilim: false, holdings: [{ fundId: "GEV", percentage: 100 }] })
    );
    expect(clash.status).toBe(400);
    expect(clash.json.error).toContain("uyuşmuyor");

    const emptyRisk = await post(profile({ riskAnswers: [] }));
    expect(emptyRisk.status).toBe(400);
    expect(emptyRisk.json.error).toContain("Risk");

    const broken = await post(undefined, "{");
    expect(broken.status).toBe(400);
    expect([missing, badPercent, foreign, clash, emptyRisk, broken].every((item) => item.status !== 500)).toBe(
      true
    );
  });

  it("returns a plan that totals 100 from a full profile and a fresh snapshot", async () => {
    vi.stubGlobal("fetch", marketFetch());
    const result = await post(profile());
    expect(result.status).toBe(200);
    expect(result.json.success).toBe(true);
    expect(result.json.recommendation.companyCode).toBe("AHS");
    expect(planTotal(result.json.recommendation)).toBe(100);
    expect(JSON.stringify(result.json)).not.toMatch(/9500|5800|2650/);
  });

  it("keeps macro tilt at zero and names the missing market data", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("down");
    });
    const result = await post(profile());
    expect(result.status).toBe(200);
    expect(planTotal(result.json.recommendation)).toBe(100);
    const rationale = result.json.recommendation.rationale.join(" ");
    expect(rationale).toContain("Eksik piyasa verisi");
    expect(rationale).toContain("Makro sapma 0 puan");
    expect(
      result.json.recommendation.actions.every((action: { reason: string }) =>
        action.reason.includes("makro sapma 0 puan")
      )
    ).toBe(true);
  });
});
