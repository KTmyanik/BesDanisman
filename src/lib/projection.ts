import {
  INFLATION_ASSUMPTION,
  OKS_WELCOME_STATE_CONTRIBUTION_TRY,
  SEPARATE_OKS_AND_BES_CAPS,
  VESTING,
} from "./bes-parameters";
import {
  annualStateContributionCapTry,
  calculateStateContribution,
  vestedRatio,
} from "./state-contribution";
import type { ContractType } from "./types";

export interface ProjectionFund {
  percentage: number;
  annualFeePercent: number | null;
}

export interface VestingRow {
  label: string;
  years: number;
  ratio: number;
  stateStockTry: number;
  vestedTry: number;
}

export interface AccumulationScenario {
  annualContributionTry: number;
  stateContributionTry: number;
  carryoverContributionTry: number;
  annualCapTry: number;
  rate: number;
  limitsAreSeparate: boolean;
  oksWelcomeTry: number | null;
  parameterEffectiveFrom: string;
  source: string;
  sourceUrl: string;
  capRule: string;
  vesting: VestingRow[];
  /** Decimal rate. Null means at least one selected fund has no fee in the snapshot. */
  annualFeeRate: number | null;
  inflationPercent: number;
  inflationSource: string;
  inflationEffectiveFrom: string;
  years: number;
  /** Contributions and fees. No state match and no fund-return assumption. */
  nominalTry: number;
  /** Nominal path plus the registry state match. */
  withStateTry: number;
  /** withStateTry in today's purchasing power under the inflation assumption. */
  realTry: number;
}

function roundKurus(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseInflationPercent(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value > 100) return null;
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace("%", "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const percent = Number(trimmed);
  if (percent > 100) return null;
  return percent;
}

/** Percent-weighted fee. A missing fee keeps the result null; no stand-in rate is used. */
export function blendedAnnualFeeRate(funds: ProjectionFund[]): number | null {
  const selected = funds.filter((fund) => fund.percentage > 0);
  if (selected.length === 0) return null;
  if (selected.some((fund) => fund.annualFeePercent === null || !Number.isFinite(fund.annualFeePercent))) {
    return null;
  }
  const weight = selected.reduce((sum, fund) => sum + fund.percentage, 0);
  if (weight <= 0) return null;
  const percent = selected.reduce(
    (sum, fund) => sum + fund.percentage * (fund.annualFeePercent as number),
    0
  ) / weight;
  return percent / 100;
}

function planOf(contractType: ContractType): "bes" | "oks" {
  return contractType === "oks" ? "oks" : "bes";
}

function stateStockTry(years: number, annualContributionTry: number, contractType: ContractType): number {
  const welcome = contractType === "oks" ? OKS_WELCOME_STATE_CONTRIBUTION_TRY.value : 0;
  let carryover = 0;
  let stock = 0;
  for (let year = 1; year <= years; year += 1) {
    const posted = annualContributionTry + carryover;
    const yearMatch = calculateStateContribution({
      annualContributionTry: posted,
      payer: "participant",
      plan: planOf(contractType),
    });
    stock += yearMatch.stateContributionTry;
    if (year === 1) stock += welcome;
    carryover = yearMatch.carryoverContributionTry;
  }
  return roundKurus(stock);
}

function vestingRows(
  yearsToRetirement: number,
  annualContributionTry: number,
  contractType: ContractType
): VestingRow[] {
  const rows: VestingRow[] = VESTING.byYears
    .filter((bracket) => bracket.minYears > 0)
    .map((bracket) => {
      const stateStock = stateStockTry(bracket.minYears, annualContributionTry, contractType);
      return {
        label: `${bracket.minYears} yıl`,
        years: bracket.minYears,
        ratio: bracket.ratio,
        stateStockTry: stateStock,
        vestedTry: roundKurus(stateStock * vestedRatio(bracket.minYears, "sure")),
      };
    });

  const retirementYears = yearsToRetirement === 0 ? 1 : yearsToRetirement;
  const retirementStock = stateStockTry(retirementYears, annualContributionTry, contractType);
  rows.push({
    label: "Emeklilik",
    years: yearsToRetirement,
    ratio: vestedRatio(yearsToRetirement, "emeklilik"),
    stateStockTry: retirementStock,
    vestedTry: roundKurus(retirementStock * VESTING.fullRatio),
  });
  return rows;
}

export function projectAccumulation(input: {
  monthlyContributionTry: number;
  balanceTry: number;
  yearsToRetirement: number;
  contractType: ContractType;
  funds: ProjectionFund[];
  inflationPercent: number;
}): AccumulationScenario {
  if (!Number.isFinite(input.monthlyContributionTry) || input.monthlyContributionTry < 0) {
    throw new Error("Aylık katkı sıfırdan küçük olamaz");
  }
  if (!Number.isFinite(input.balanceTry) || input.balanceTry < 0) {
    throw new Error("Mevcut birikim sıfırdan küçük olamaz");
  }
  if (!Number.isInteger(input.yearsToRetirement) || input.yearsToRetirement < 0) {
    throw new Error("Emekliliğe kalan yıl sıfırdan küçük olamaz");
  }
  if (!Number.isFinite(input.inflationPercent) || input.inflationPercent < 0 || input.inflationPercent > 100) {
    throw new Error("Enflasyon varsayımı 0 ile 100 arasında olmalıdır");
  }

  const annualContributionTry = roundKurus(input.monthlyContributionTry * 12);
  const currentYear = calculateStateContribution({
    annualContributionTry,
    payer: "participant",
    plan: planOf(input.contractType),
  });
  const feeRate = blendedAnnualFeeRate(input.funds);
  const welcome = input.contractType === "oks" ? OKS_WELCOME_STATE_CONTRIBUTION_TRY.value : 0;

  let nominal = input.balanceTry;
  let withState = input.balanceTry;
  let carryover = 0;
  for (let year = 1; year <= input.yearsToRetirement; year += 1) {
    const posted = annualContributionTry + carryover;
    const match = calculateStateContribution({
      annualContributionTry: posted,
      payer: "participant",
      plan: planOf(input.contractType),
    });
    nominal += annualContributionTry;
    withState += annualContributionTry + match.stateContributionTry + (year === 1 ? welcome : 0);
    if (feeRate !== null) {
      nominal *= 1 - feeRate;
      withState *= 1 - feeRate;
    }
    carryover = match.carryoverContributionTry;
  }
  if (input.yearsToRetirement === 0 && welcome > 0) {
    withState += welcome;
  }

  const nominalTry = roundKurus(nominal);
  const withStateTry = roundKurus(withState);
  const inflationRate = input.inflationPercent / 100;
  const realTry = roundKurus(withStateTry / (1 + inflationRate) ** input.yearsToRetirement);

  return {
    annualContributionTry,
    stateContributionTry: currentYear.stateContributionTry,
    carryoverContributionTry: currentYear.carryoverContributionTry,
    annualCapTry: annualStateContributionCapTry(),
    rate: currentYear.rate,
    limitsAreSeparate: SEPARATE_OKS_AND_BES_CAPS.value,
    oksWelcomeTry: input.contractType === "oks" ? welcome : null,
    parameterEffectiveFrom: currentYear.parameterEffectiveFrom,
    source: currentYear.source,
    sourceUrl: currentYear.sourceUrl,
    capRule: currentYear.reason,
    vesting: vestingRows(input.yearsToRetirement, annualContributionTry, input.contractType),
    annualFeeRate: feeRate,
    inflationPercent: input.inflationPercent,
    inflationSource: INFLATION_ASSUMPTION.source,
    inflationEffectiveFrom: INFLATION_ASSUMPTION.effectiveFrom,
    years: input.yearsToRetirement,
    nominalTry,
    withStateTry,
    realTry,
  };
}
