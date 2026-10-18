import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INFLATION_ASSUMPTION, VESTING } from "./bes-parameters";
import {
  annualGrossMinimumWageTry,
  annualStateContributionCapTry,
  calculateStateContribution,
} from "./state-contribution";
import { blendedAnnualFeeRate, parseInflationPercent, projectAccumulation } from "./projection";

const base = {
  monthlyContributionTry: 5_000,
  balanceTry: 0,
  yearsToRetirement: 1,
  contractType: "gonullu" as const,
  funds: [{ percentage: 100, annualFeePercent: 0 }],
  inflationPercent: 0,
};

describe("accumulation scenario", () => {
  it("uses the registry rate and lists the amount above the cap on its own", () => {
    const within = projectAccumulation(base);
    expect(within.stateContributionTry).toBe(60_000 * within.rate);
    expect(within.carryoverContributionTry).toBe(0);
    expect(within.limitsAreSeparate).toBe(true);

    const over = projectAccumulation({
      ...base,
      monthlyContributionTry: 40_000,
    });
    expect(over.stateContributionTry).toBe(annualStateContributionCapTry());
    expect(over.carryoverContributionTry).toBe(480_000 - annualGrossMinimumWageTry());
    expect(over.oksWelcomeTry).toBeNull();
  });

  it("applies the same annual formula to OKS and keeps the welcome amount outside the cap", () => {
    const bes = projectAccumulation({ ...base, monthlyContributionTry: 40_000 });
    const oks = projectAccumulation({
      ...base,
      monthlyContributionTry: 40_000,
      contractType: "oks",
    });
    expect(oks.stateContributionTry).toBe(bes.stateContributionTry);
    expect(oks.oksWelcomeTry).toBe(500);
    expect(oks.nominalTry).toBeCloseTo(bes.nominalTry, 2);
    expect(oks.withStateTry).toBeCloseTo(bes.withStateTry + 500, 2);
  });

  it("shows vested amounts from the registry brackets", () => {
    const fixed = projectAccumulation({
      ...base,
      yearsToRetirement: 10,
      funds: [{ percentage: 100, annualFeePercent: 0 }],
    });
    const three = fixed.vesting.find((row) => row.label === "3 yıl");
    const six = fixed.vesting.find((row) => row.label === "6 yıl");
    const ten = fixed.vesting.find((row) => row.label === "10 yıl");
    const retirement = fixed.vesting.find((row) => row.label === "Emeklilik");
    const yearly = calculateStateContribution({
      annualContributionTry: 60_000,
      payer: "participant",
      plan: "bes",
    }).stateContributionTry;
    expect(three?.ratio).toBe(VESTING.byYears.find((bracket) => bracket.minYears === 3)?.ratio);
    expect(three?.vestedTry).toBeCloseTo(yearly * 3 * (three?.ratio ?? 0), 2);
    expect(six?.ratio).toBe(VESTING.byYears.find((bracket) => bracket.minYears === 6)?.ratio);
    expect(ten?.ratio).toBe(VESTING.byYears.find((bracket) => bracket.minYears === 10)?.ratio);
    expect(retirement?.ratio).toBe(VESTING.fullRatio);
    expect(retirement?.vestedTry).toBeCloseTo(yearly * 10, 2);
    expect(fixed.vesting).toHaveLength(4);
  });

  it("drops a known fee and refuses to invent one", () => {
    const charged = projectAccumulation(base);
    const free = projectAccumulation({
      ...base,
      funds: [{ percentage: 100, annualFeePercent: 0 }],
    });
    const withFee = projectAccumulation({
      ...base,
      funds: [{ percentage: 100, annualFeePercent: 1 }],
    });
    expect(withFee.nominalTry).toBeLessThan(free.nominalTry);
    expect(withFee.annualFeeRate).toBeCloseTo(0.01, 6);

    const unknown = projectAccumulation({
      ...base,
      balanceTry: 100_000,
      monthlyContributionTry: 0,
      funds: [
        { percentage: 60, annualFeePercent: 1.9 },
        { percentage: 40, annualFeePercent: null },
      ],
    });
    expect(blendedAnnualFeeRate([{ percentage: 40, annualFeePercent: null }])).toBeNull();
    expect(unknown.annualFeeRate).toBeNull();
    expect(unknown.nominalTry).toBe(100_000);
    expect(charged.annualFeeRate).toBe(0);

    const source = readFileSync(new URL("./projection.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/1\.5\b/);
    expect(source).not.toMatch(/0\.2\b/);
  });

  it("places nominal and real side by side from the assumption, not a forecast", () => {
    expect(INFLATION_ASSUMPTION.value).toBe(24);
    expect(INFLATION_ASSUMPTION.source).toContain("varsayım");
    const flat = projectAccumulation({ ...base, yearsToRetirement: 2, inflationPercent: 0 });
    const assumed = projectAccumulation({
      ...base,
      yearsToRetirement: 2,
      inflationPercent: INFLATION_ASSUMPTION.value,
    });
    expect(assumed.years).toBe(2);
    expect(assumed.nominalTry).toBe(flat.nominalTry);
    expect(assumed.withStateTry).toBe(flat.withStateTry);
    expect(assumed.withStateTry).toBeGreaterThan(assumed.nominalTry);
    expect(assumed.realTry).toBeLessThan(assumed.withStateTry);
    expect(parseInflationPercent("10,5")).toBe(10.5);
    expect(parseInflationPercent("101")).toBeNull();
  });
});
