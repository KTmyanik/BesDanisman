import {
  MINIMUM_WAGE_MONTHS_IN_YEAR,
  MONTHLY_GROSS_MINIMUM_WAGE_TRY,
  SEPARATE_OKS_AND_BES_CAPS,
  STATE_CONTRIBUTION_CAP_RULE,
  STATE_CONTRIBUTION_RATE,
  VESTING,
  type VestingFullReason,
} from "./bes-parameters";

export type ContributionPlan = "bes" | "oks";
export type ContributionPayer = "participant" | "employer";
export type VestingReason = "sure" | VestingFullReason;

export interface StateContributionInput {
  /** Turkish-lira contributions posted to the company in the calendar year. */
  annualContributionTry: number;
  payer: ContributionPayer;
  plan: ContributionPlan;
}

export interface StateContributionResult {
  applicable: boolean;
  reason: string;
  plan: ContributionPlan;
  rate: number;
  eligibleContributionTry: number;
  stateContributionTry: number;
  carryoverContributionTry: number;
  annualCapTry: number;
  limitsAreSeparateFromTheOtherPlan: boolean;
  parameterEffectiveFrom: string;
  source: string;
  sourceUrl: string;
}

function roundKurus(value: number): number {
  return Math.round(value * 100) / 100;
}

export function annualGrossMinimumWageTry(): number {
  return MONTHLY_GROSS_MINIMUM_WAGE_TRY.value * MINIMUM_WAGE_MONTHS_IN_YEAR;
}

export function annualStateContributionCapTry(): number {
  return roundKurus(annualGrossMinimumWageTry() * STATE_CONTRIBUTION_RATE.value);
}

export function calculateStateContribution(
  input: StateContributionInput
): StateContributionResult {
  if (!Number.isFinite(input.annualContributionTry) || input.annualContributionTry < 0) {
    throw new Error("Yıllık katkı payı sıfırdan küçük olamaz");
  }

  const shared = {
    plan: input.plan,
    rate: STATE_CONTRIBUTION_RATE.value,
    annualCapTry: annualStateContributionCapTry(),
    limitsAreSeparateFromTheOtherPlan: SEPARATE_OKS_AND_BES_CAPS.value,
    parameterEffectiveFrom: STATE_CONTRIBUTION_RATE.effectiveFrom,
    source: STATE_CONTRIBUTION_RATE.source,
    sourceUrl: STATE_CONTRIBUTION_RATE.sourceUrl,
  };

  if (input.payer === "employer") {
    return {
      ...shared,
      applicable: false,
      reason: "İşveren tarafından ödenen katkı payına devlet katkısı ödenmez.",
      eligibleContributionTry: 0,
      stateContributionTry: 0,
      carryoverContributionTry: 0,
    };
  }

  const ceiling = annualGrossMinimumWageTry();
  const eligibleContributionTry = Math.min(input.annualContributionTry, ceiling);
  const carryoverContributionTry = roundKurus(
    Math.max(0, input.annualContributionTry - ceiling)
  );

  return {
    ...shared,
    applicable: true,
    reason: STATE_CONTRIBUTION_CAP_RULE.text,
    eligibleContributionTry: roundKurus(eligibleContributionTry),
    stateContributionTry: roundKurus(eligibleContributionTry * STATE_CONTRIBUTION_RATE.value),
    carryoverContributionTry,
  };
}

export function vestedRatio(yearsInSystem: number, reason: VestingReason): number {
  if (!Number.isFinite(yearsInSystem) || yearsInSystem < 0) {
    throw new Error("Sistemde geçen yıl sıfırdan küçük olamaz");
  }
  if ((VESTING.fullReasons as readonly string[]).includes(reason)) {
    return VESTING.fullRatio;
  }
  let ratio = 0;
  for (const bracket of VESTING.byYears) {
    if (yearsInSystem >= bracket.minYears) ratio = bracket.ratio;
  }
  return ratio;
}
