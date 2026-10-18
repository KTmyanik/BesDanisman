import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MONTHLY_GROSS_MINIMUM_WAGE_TRY,
  OKS_WELCOME_STATE_CONTRIBUTION_TRY,
  STATE_CONTRIBUTION_RATE,
} from "./bes-parameters";
import {
  annualGrossMinimumWageTry,
  annualStateContributionCapTry,
  calculateStateContribution,
  vestedRatio,
} from "./state-contribution";

describe("2026 state contribution registry", () => {
  it("matches the published wage, rate, and cap", () => {
    expect(MONTHLY_GROSS_MINIMUM_WAGE_TRY.value).toBe(33_030);
    expect(MONTHLY_GROSS_MINIMUM_WAGE_TRY.effectiveFrom).toBe("2026-01-01");
    expect(STATE_CONTRIBUTION_RATE.value).toBe(0.2);
    expect(STATE_CONTRIBUTION_RATE.effectiveFrom).toBe("2026-01-01");
    expect(annualGrossMinimumWageTry()).toBe(396_360);
    expect(annualStateContributionCapTry()).toBe(79_272);
    expect(OKS_WELCOME_STATE_CONTRIBUTION_TRY.value).toBe(500);
    expect(OKS_WELCOME_STATE_CONTRIBUTION_TRY.countsTowardAnnualCap).toBe(false);
  });

  it("does not hardcode the rate or the cap in the calculator", () => {
    const source = readFileSync(new URL("./state-contribution.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/0\.2\b/);
    expect(source).not.toMatch(/33_?030|396_?360|79_?272/);
  });

  it("pays the registry rate up to the annual wage", () => {
    const within = calculateStateContribution({
      annualContributionTry: 10_000,
      payer: "participant",
      plan: "bes",
    });
    expect(within.applicable).toBe(true);
    expect(within.rate).toBe(STATE_CONTRIBUTION_RATE.value);
    expect(within.stateContributionTry).toBe(10_000 * STATE_CONTRIBUTION_RATE.value);
    expect(within.carryoverContributionTry).toBe(0);
    expect(within.source).toBe(STATE_CONTRIBUTION_RATE.source);

    const over = calculateStateContribution({
      annualContributionTry: annualGrossMinimumWageTry() + 1_000,
      payer: "participant",
      plan: "oks",
    });
    expect(over.stateContributionTry).toBe(annualStateContributionCapTry());
    expect(over.carryoverContributionTry).toBe(1_000);
    expect(over.stateContributionTry).not.toBe(
      annualStateContributionCapTry() + OKS_WELCOME_STATE_CONTRIBUTION_TRY.value
    );
  });

  it("pays nothing on employer contributions", () => {
    const result = calculateStateContribution({
      annualContributionTry: 10_000,
      payer: "employer",
      plan: "bes",
    });
    expect(result.applicable).toBe(false);
    expect(result.stateContributionTry).toBe(0);
  });

  it("keeps BES and OKS caps independent", () => {
    const input = {
      annualContributionTry: annualGrossMinimumWageTry(),
      payer: "participant" as const,
    };
    const bes = calculateStateContribution({ ...input, plan: "bes" });
    const oks = calculateStateContribution({ ...input, plan: "oks" });
    expect(bes.limitsAreSeparateFromTheOtherPlan).toBe(true);
    expect(bes.stateContributionTry).toBe(annualStateContributionCapTry());
    expect(oks.stateContributionTry).toBe(annualStateContributionCapTry());
  });

  it("reads vesting brackets from the registry", () => {
    expect(vestedRatio(2.9, "sure")).toBe(0);
    expect(vestedRatio(3, "sure")).toBe(0.15);
    expect(vestedRatio(6, "sure")).toBe(0.35);
    expect(vestedRatio(10, "sure")).toBe(0.6);
    expect(vestedRatio(1, "emeklilik")).toBe(1);
    expect(vestedRatio(0, "vefat")).toBe(1);
    expect(vestedRatio(4, "maluliyet")).toBe(1);
  });
});
