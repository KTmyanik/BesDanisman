import type { PersonProfile, PortfolioHolding, PortfolioRecommendation, RiskAnswer } from "./types";

export const PROFILE_STORAGE_KEY = "bes-danisman.profile.v1";

export interface StoredSession {
  version: 1;
  step: number;
  hasPortfolio: boolean | null;
  katilim: boolean | null;
  companyCode: string;
  yearsToRetirement: string;
  monthlyContributionTry: string;
  balanceTry: string;
  contractType: "" | PersonProfile["contractType"];
  riskAnswers: RiskAnswer[];
  questionIndex: number;
  holdings: PortfolioHolding[];
  inflationPercent: string;
  result: {
    recommendation: PortfolioRecommendation;
    riskLabel: string;
    person: PersonProfile;
    fingerprint: string;
  } | null;
}

export function sessionFingerprint(input: {
  hasPortfolio: boolean | null;
  katilim: boolean | null;
  companyCode: string;
  yearsToRetirement: string;
  monthlyContributionTry: string;
  balanceTry: string;
  contractType: string;
  riskAnswers: RiskAnswer[];
  holdings: PortfolioHolding[];
}): string {
  return JSON.stringify({
    hasPortfolio: input.hasPortfolio,
    katilim: input.katilim,
    companyCode: input.companyCode,
    yearsToRetirement: input.yearsToRetirement.trim(),
    monthlyContributionTry: input.monthlyContributionTry.trim(),
    balanceTry: input.balanceTry.trim(),
    contractType: input.contractType,
    riskAnswers: [...input.riskAnswers].sort((a, b) => a.questionId.localeCompare(b.questionId)),
    holdings: input.holdings.map((holding) => ({
      fundId: holding.fundId,
      percentage: holding.percentage,
    })),
  });
}

export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (value.version !== 1) return null;
    if (typeof value.companyCode !== "string") return null;
    if (!Array.isArray(value.riskAnswers) || !Array.isArray(value.holdings)) return null;
    if (value.step !== 1 && value.step !== 2 && value.step !== 3 && value.step !== 4) return null;
    return value as StoredSession;
  } catch {
    return null;
  }
}

export function serializeStoredSession(session: StoredSession): string {
  return JSON.stringify(session);
}
