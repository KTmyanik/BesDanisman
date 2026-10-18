export type RiskLevel = "dusuk" | "orta" | "yuksek";

export type FundCategory =
  | "para_piyasasi"
  | "standart"
  | "oks_standart"
  | "borclanma"
  | "kamu_borclanma"
  | "ozel_borclanma"
  | "dis_borclanma"
  | "doviz_borclanma"
  | "altin"
  | "kiymetli_maden"
  | "hisse"
  | "katilim_hisse"
  | "karma"
  | "dis_piyasa"
  | "kira_sertifikasi"
  | "emtia";

export interface BesFund {
  id: string;
  name: string;
  category: FundCategory;
  riskScore: number; // 1-10
  description: string;
  katilim: boolean;
}

export interface PortfolioHolding {
  fundId: string;
  percentage: number;
}

export interface MacroIndicator {
  name: string;
  value: number | null;
  changePercent: number | null;
  /** Bulletin date (YYYY-MM-DD) or quote timestamp. */
  asOf: string | null;
  unit: string;
  sentiment: "positive" | "negative" | "neutral";
  description: string;
}

export interface MarketSnapshot {
  usdTry: number | null;
  usdTryChange: number | null;
  usdTryAsOf: string | null;
  eurTry: number | null;
  eurTryChange: number | null;
  eurTryAsOf: string | null;
  bist100: number | null;
  bist100Change: number | null;
  bist100AsOf: string | null;
  sp500: number | null;
  sp500Change: number | null;
  sp500AsOf: string | null;
  goldUsd: number | null;
  goldChange: number | null;
  goldAsOf: string | null;
  vix: number | null;
  vixChange: number | null;
  vixAsOf: string | null;
}

export interface MacroAnalysis {
  turkey: MacroIndicator[];
  global: MacroIndicator[];
  summary: string;
  outlook: string[];
  risks: string[];
  opportunities: string[];
  /** Indicator names or change series that were not available. */
  missing: string[];
  fetchedAt: string;
}

export interface SkippedRule {
  id: string;
  text: string;
}

export interface FundDelta {
  fundId: string;
  name: string;
  category: FundCategory | null;
  currentPercent: number;
  targetPercent: number;
  deltaPercent: number;
}

export interface RebalanceAction {
  type: "azalt" | "artir" | "ekle" | "cikar";
  fundId: string;
  fundName: string;
  category: FundCategory;
  currentPercent: number;
  targetPercent: number;
  deltaPercent: number;
  reason: string;
}

export interface PortfolioRecommendation {
  riskLevel: RiskLevel;
  riskScore: number;
  companyCode: string;
  companyName: string;
  targetAllocation: {
    fundId: string;
    percentage: number;
    name: string;
    category: FundCategory;
    /** Annual fee in percent points. Null means the snapshot has no fee. */
    annualFeePercent: number | null;
  }[];
  /** Other companies' funds. They never carry a target percentage. */
  marketExamples: MarketExample[];
  unfilled: { category: FundCategory; percentage: number }[];
  allocationNotes: string[];
  skippedRules: SkippedRule[];
  fundDeltas: FundDelta[];
  actions: RebalanceAction[];
  summary: string;
  rationale: string[];
  macroContext: MacroAnalysis;
  isNewAccount: boolean;
  katilim: boolean;
  categoryRankings: CategoryRankings | null;
}

export interface ScoredFundPick {
  code: string;
  name: string;
  shortName: string;
  company: string;
  category: FundCategory;
  fundType: string;
  score: number;
  rank: number;
  scoreBreakdown: {
    getiriPuani: number | null;
    tutarlilikPuani: number | null;
    ucretPuani: number | null;
    buyuklukPuani: number | null;
    tefasPuani: number | null;
    riskUyumPuani: number | null;
    getiri1y: number | null;
    getiri6a: number | null;
    getiri3y: number | null;
    getiriYb: number | null;
    yillikUcret: number | null;
    portfoyBuyukluk: number | null;
  };
}

export interface MarketExample {
  category: FundCategory;
  code: string;
  shortName: string;
  company: string;
  companyCode: string;
  score: number;
  rank: number;
}

export interface CategoryRankings {
  fetchedAt: string;
  source: string;
  categories: Partial<Record<FundCategory, ScoredFundPick[]>>;
}

export interface RiskAnswer {
  questionId: string;
  value: number; // 1-5
}

export type ContractType = "gonullu" | "oks";

export interface PersonProfile {
  yearsToRetirement: number;
  monthlyContributionTry: number;
  balanceTry: number;
  contractType: ContractType;
}

export interface UserSession {
  hasExistingPortfolio: boolean;
  katilimPreference: boolean;
  holdings: PortfolioHolding[];
  riskAnswers: RiskAnswer[];
}
