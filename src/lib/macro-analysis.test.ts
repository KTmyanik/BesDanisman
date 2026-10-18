import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MACRO_TILT_PER_CATEGORY,
  MACRO_TILT_TOTAL,
  buildMacroAnalysis,
  getMacroAdjustments,
} from "./macro-analysis";
import type { MarketSnapshot } from "./types";

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
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
    ...overrides,
  };
}

describe("macro rules with missing data", () => {
  it("does not call a missing USD move stable or claim a full analysis", () => {
    const analysis = buildMacroAnalysis(snapshot());
    expect(analysis.summary).not.toContain("görece stabil");
    expect(analysis.summary).not.toContain("piyasalar analiz edildi");
    expect(analysis.summary).toContain("USD/TRY değişimi yok");
    expect(analysis.missing).toContain("BIST 100");
    expect(analysis.missing).toContain("VIX (Korku Endeksi)");
    expect(getMacroAdjustments(analysis)).toEqual({
      para_piyasasi: 0,
      borclanma: 0,
      altin: 0,
      hisse: 0,
      karma: 0,
      dis_piyasa: 0,
      emtia: 0,
    });
  });

  it("applies only the rules whose inputs exist", () => {
    const goldOnly = buildMacroAnalysis(
      snapshot({ goldUsd: 2000, goldChange: 1, goldAsOf: "2026-10-16" })
    );
    expect(getMacroAdjustments(goldOnly).altin).toBe(2);
    expect(getMacroAdjustments(goldOnly).para_piyasasi).toBe(-2);
    expect(getMacroAdjustments(goldOnly).hisse).toBe(0);
    expect(goldOnly.missing).not.toContain("Altın (USD/ons)");

    const tense = buildMacroAnalysis(
      snapshot({ vix: 30, vixChange: 1, vixAsOf: "2026-10-16T12:00:00.000Z" })
    );
    expect(getMacroAdjustments(tense).para_piyasasi).toBe(2);
    expect(getMacroAdjustments(tense).hisse).toBe(-2);
    expect(getMacroAdjustments(tense).borclanma).toBe(1);
    expect(getMacroAdjustments(tense).dis_piyasa).toBe(-1);
  });

  it("keeps a stacked daily move inside the tilt limits", () => {
    const stacked = buildMacroAnalysis(
      snapshot({
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
      })
    );
    const tilt = getMacroAdjustments(stacked);
    const values = Object.values(tilt);
    expect(values.every((value) => Math.abs(value) <= MACRO_TILT_PER_CATEGORY)).toBe(true);
    expect(values.reduce((sum, value) => sum + Math.abs(value), 0)).toBeLessThanOrEqual(MACRO_TILT_TOTAL);
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(0);
  });

  it("does not describe the screen as a completed market analysis", () => {
    const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    const analysis = readFileSync(new URL("./macro-analysis.ts", import.meta.url), "utf8");
    expect(page).not.toContain("piyasalar analiz edildi");
    expect(analysis).not.toContain("piyasalar analiz edildi");
    expect(page).not.toContain("Piyasa verileri analiz ediliyor");
  });
});
