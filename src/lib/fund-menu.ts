import type {
  CategoryRankings,
  FundCategory,
  MarketExample,
  PortfolioHolding,
  ScoredFundPick,
} from "./types";
import type { ClassifiedFund } from "./fund-snapshot";
import { scoreFunds } from "./fund-score";

export const TARGET_SLEEVES: FundCategory[] = [
  "para_piyasasi",
  "borclanma",
  "altin",
  "hisse",
  "karma",
  "dis_piyasa",
  "emtia",
];

const SLEEVE_SOURCES: Partial<Record<FundCategory, FundCategory[]>> = {
  borclanma: ["borclanma", "kamu_borclanma", "ozel_borclanma"],
  hisse: ["hisse", "katilim_hisse"],
  emtia: ["kiymetli_maden"],
};

export function sleeveSources(category: FundCategory): FundCategory[] {
  return SLEEVE_SOURCES[category] ?? [category];
}

export interface ScoredMenuFund extends ClassifiedFund {
  score: number;
  scoreBreakdown: ScoredFundPick["scoreBreakdown"];
}

export function scoreMenu(funds: ClassifiedFund[], yearsToRetirement: number): ScoredMenuFund[] {
  const scores = scoreFunds(funds, yearsToRetirement);
  return funds.map((fund) => {
    const scored = scores.get(fund.code);
    return {
      ...fund,
      score: scored?.score ?? 0,
      scoreBreakdown: scored?.scoreBreakdown ?? {
        getiriPuani: null,
        tutarlilikPuani: null,
        ucretPuani: null,
        buyuklukPuani: null,
        tefasPuani: null,
        riskUyumPuani: null,
        getiri1y: fund.getiri1y,
        getiri6a: fund.getiri6a,
        getiri3y: fund.getiri3y,
        getiriYb: fund.getiriYb,
        yillikUcret: fund.yillikUcret,
        portfoyBuyukluk: fund.portfoyBuyukluk,
      },
    };
  });
}

export function mergeHoldings(holdings: PortfolioHolding[]): PortfolioHolding[] {
  const merged = new Map<string, number>();
  for (const holding of holdings) {
    const code = holding.fundId.trim().toUpperCase();
    if (!code) continue;
    merged.set(code, (merged.get(code) ?? 0) + holding.percentage);
  }
  return [...merged.entries()].map(([fundId, percentage]) => ({ fundId, percentage }));
}

export function validatePlanRequest(input: {
  companyCode: string;
  katilim: boolean;
  isNewAccount: boolean;
  holdings: PortfolioHolding[];
  funds: ClassifiedFund[];
}):
  | { ok: true; holdings: PortfolioHolding[]; menu: ClassifiedFund[] }
  | { ok: false; status: number; error: string } {
  const companyCode = input.companyCode.trim().toUpperCase();
  if (!companyCode) {
    return { ok: false, status: 400, error: "Emeklilik şirketi seçilmedi." };
  }

  const menu = input.funds.filter(
    (fund) => fund.companyCode === companyCode && fund.katilim === input.katilim
  );
  if (menu.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Bu şirketin menüsünde seçtiğiniz fon tercihine uygun fon yok. Plan üretilmedi.",
    };
  }

  if (input.isNewAccount) {
    if (input.holdings.length > 0) {
      return { ok: false, status: 400, error: "Yeni hesap senaryosunda mevcut fon gönderilmez." };
    }
    return { ok: true, holdings: [], menu };
  }

  const holdings = mergeHoldings(input.holdings);
  if (holdings.length === 0) {
    return { ok: false, status: 400, error: "Mevcut portföyde fon kodu yok." };
  }

  const byCode = new Map(input.funds.map((fund) => [fund.code, fund]));
  for (const holding of holdings) {
    const fund = byCode.get(holding.fundId);
    if (!fund) {
      return { ok: false, status: 400, error: `${holding.fundId} fon evreninde yok.` };
    }
    if (fund.katilim !== input.katilim) {
      return {
        ok: false,
        status: 400,
        error: `${holding.fundId} fon tercihiyle uyuşmuyor.`,
      };
    }
  }

  const total = holdings.reduce((sum, holding) => sum + holding.percentage, 0);
  if (Math.abs(total - 100) >= 0.1) {
    return { ok: false, status: 400, error: "Fon yüzdelerinin toplamı %100 olmalıdır." };
  }

  return { ok: true, holdings, menu };
}

export function bestFundForSleeve(
  sleeve: FundCategory,
  menu: ScoredMenuFund[]
): ScoredMenuFund | null {
  const sources = new Set(sleeveSources(sleeve));
  const matches = menu.filter((fund) => fund.category !== null && sources.has(fund.category));
  matches.sort((a, b) => b.score - a.score);
  return matches[0] ?? null;
}

function toPick(fund: ScoredMenuFund, rank: number): ScoredFundPick {
  return {
    code: fund.code,
    name: fund.name,
    shortName: fund.shortName,
    company: fund.company,
    category: fund.category ?? "karma",
    fundType: fund.fundType,
    score: fund.score,
    rank,
    scoreBreakdown: fund.scoreBreakdown,
  };
}

export function marketExamples(
  funds: ClassifiedFund[],
  katilim: boolean,
  yearsToRetirement: number,
  sleeves: FundCategory[]
): MarketExample[] {
  const universe = scoreMenu(
    funds.filter((fund) => fund.katilim === katilim),
    yearsToRetirement
  );
  const seen = new Set<FundCategory>();
  const examples: MarketExample[] = [];
  for (const sleeve of sleeves) {
    if (seen.has(sleeve)) continue;
    seen.add(sleeve);
    const sources = new Set(sleeveSources(sleeve));
    const matches = universe
      .filter((fund) => fund.category !== null && sources.has(fund.category))
      .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code, "tr"))
      .slice(0, 3);
    matches.forEach((fund, index) => {
      examples.push({
        category: sleeve,
        code: fund.code,
        shortName: fund.shortName,
        company: fund.company,
        companyCode: fund.companyCode,
        score: fund.score,
        rank: index + 1,
      });
    });
  }
  return examples;
}

export function rankCompanyMenu(
  menu: ScoredMenuFund[],
  fetchedAt: string,
  source: string
): CategoryRankings {
  const categories: CategoryRankings["categories"] = {};
  for (const sleeve of TARGET_SLEEVES) {
    const sources = new Set(sleeveSources(sleeve));
    const matches = menu
      .filter((fund) => fund.category !== null && sources.has(fund.category))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    if (matches.length > 0) {
      categories[sleeve] = matches.map((fund, index) => toPick(fund, index + 1));
    }
  }
  return { fetchedAt, source, categories };
}
