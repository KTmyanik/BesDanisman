import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  fetchMarketData,
  fxChangePercent,
  parseBulletinDate,
  parseTcmbBulletin,
  parseYahooChart,
  previousWeekdays,
  tcmbArchiveUrl,
} from "./macro-data";

function bulletin(date: string, tarih: string, usd: string, eur: string) {
  return `<?xml version="1.0"?><Tarih_Date Tarih="${tarih}" Date="${date}"><Currency CurrencyCode="USD"><Unit>1</Unit><ForexSelling>${usd}</ForexSelling></Currency><Currency CurrencyCode="EUR"><Unit>1</Unit><ForexSelling>${eur}</ForexSelling></Currency></Tarih_Date>`;
}

function mockFetch(files: Record<string, string | number>) {
  return async (input: string) => {
    const hit = Object.entries(files).find(([key]) => input.includes(key));
    if (!hit || typeof hit[1] === "number") {
      return new Response("", { status: typeof hit?.[1] === "number" ? hit[1] : 404 });
    }
    return new Response(hit[1], { status: 200 });
  };
}

describe("TCMB change", () => {
  it("reads the bulletin date from both TCMB formats", () => {
    expect(parseBulletinDate("10/16/2026", "16.10.2026")).toBe("2026-10-16");
    expect(parseBulletinDate(undefined, "15.10.2026")).toBe("2026-10-15");
  });

  it("steps back to the previous weekday", () => {
    expect(previousWeekdays("2026-10-16", 1)).toEqual(["2026-10-15"]);
    expect(previousWeekdays("2026-10-19", 1)).toEqual(["2026-10-16"]);
    expect(tcmbArchiveUrl("2026-10-15")).toBe(
      "https://www.tcmb.gov.tr/kurlar/202610/15102026.xml"
    );
  });

  it("calculates the change against the previous business day", async () => {
    const data = await fetchMarketData(
      mockFetch({
        "today.xml": bulletin("10/16/2026", "16.10.2026", "42", "46"),
        "15102026.xml": bulletin("10/15/2026", "15.10.2026", "40", "44"),
      })
    );
    expect(data.usdTry).toBe(42);
    expect(data.eurTry).toBe(46);
    expect(data.usdTryChange).toBe(5);
    expect(data.eurTryChange).toBeCloseTo((2 / 44) * 100);
    expect(data.usdTryAsOf).toBe("2026-10-16");
  });

  it("keeps a zero change when the rate did not move", () => {
    expect(fxChangePercent(40, 40)).toBe(0);
  });

  it("leaves the change null when the previous file is missing", async () => {
    const data = await fetchMarketData(
      mockFetch({
        "today.xml": bulletin("10/16/2026", "16.10.2026", "42", "46"),
      })
    );
    expect(data.usdTry).toBe(42);
    expect(data.usdTryChange).toBeNull();
    expect(data.eurTryChange).toBeNull();
  });

  it("skips a holiday file and uses the next weekday", async () => {
    const data = await fetchMarketData(
      mockFetch({
        "today.xml": bulletin("10/16/2026", "16.10.2026", "42", "46"),
        "15102026.xml": 404,
        "14102026.xml": bulletin("10/14/2026", "14.10.2026", "40", "44"),
      })
    );
    expect(data.usdTryChange).toBe(5);
  });

  it("leaves rates and changes null when today's file is missing", async () => {
    const data = await fetchMarketData(mockFetch({}));
    expect(data.usdTry).toBeNull();
    expect(data.eurTry).toBeNull();
    expect(data.usdTryChange).toBeNull();
    expect(data.eurTryChange).toBeNull();
  });

  it("parses a bulletin without inventing a zero rate", () => {
    const parsed = parseTcmbBulletin(
      `<?xml version="1.0"?><Tarih_Date Tarih="16.10.2026" Date="10/16/2026"><Currency CurrencyCode="USD"><Unit>1</Unit><ForexSelling></ForexSelling></Currency></Tarih_Date>`
    );
    expect(parsed?.usdTry).toBeNull();
  });
});

describe("Yahoo quotes", () => {
  it("does not replace a failed quote with a fixed price", async () => {
    const files = [
      "./macro-data.ts",
      "./macro-analysis.ts",
      "./portfolio-engine.ts",
      "./fund-menu.ts",
      "./fund-score.ts",
      "../app/api/recommend/route.ts",
    ];
    const source = files
      .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/\b9500\b/);
    expect(source).not.toMatch(/\b5800\b/);
    expect(source).not.toMatch(/\b2650\b/);
    expect(source).not.toMatch(/price:\s*18\b/);
    expect(source).not.toMatch(/(?:\|\||\?\?)\s*18\b/);
    expect(source).not.toMatch(/(?:vix|VIX)[^\n]{0,40}=\s*18\b/);

    const data = await fetchMarketData(async () => {
      throw new Error("down");
    });
    expect(data.bist100).toBeNull();
    expect(data.sp500).toBeNull();
    expect(data.goldUsd).toBeNull();
    expect(data.vix).toBeNull();
    expect(JSON.stringify(data)).not.toMatch(/9500|5800|2650/);
  });

  it("reads price and change from a chart payload", () => {
    const quote = parseYahooChart({
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 110,
              chartPreviousClose: 100,
              regularMarketTime: 1_760_800_000,
            },
          },
        ],
      },
    });
    expect(quote?.price).toBe(110);
    expect(quote?.changePercent).toBe(10);
    expect(quote?.asOf).toBe(new Date(1_760_800_000 * 1000).toISOString());
  });
});
