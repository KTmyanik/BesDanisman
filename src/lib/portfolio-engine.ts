import type { FundCategory } from "./types";
import { getMacroAdjustments } from "./macro-analysis";
import { getCategoryLabel, FUND_CATEGORIES } from "./bes-funds";
import { getCategoryColor } from "./category-colors";
import { bestFundForSleeve, type ScoredMenuFund } from "./fund-menu";
import { horizonAnswerFromYears, horizonLabel } from "./person-profile";
import { RISK_LEVEL_LABELS } from "./risk-profile";
import type {
  MacroAnalysis,
  PortfolioHolding,
  PortfolioRecommendation,
  RebalanceAction,
  RiskLevel,
} from "./types";

function sleeveAllocation(
  partial: Partial<Record<FundCategory, number>>
): Record<FundCategory, number> {
  const allocation = {} as Record<FundCategory, number>;
  for (const category of Object.keys(FUND_CATEGORIES) as FundCategory[]) {
    allocation[category] = partial[category] ?? 0;
  }
  return allocation;
}

type GlideSleeve = "para_piyasasi" | "borclanma" | "altin" | "hisse" | "karma" | "dis_piyasa" | "emtia";

/** Horizon bucket 1 is under 5 years. Bucket 5 is 30 years or more. */
export const GLIDE_PATH: Record<RiskLevel, Record<number, Record<GlideSleeve, number>>> = {
  dusuk: {
    1: { para_piyasasi: 38, borclanma: 40, altin: 8, hisse: 3, karma: 8, dis_piyasa: 3, emtia: 0 },
    2: { para_piyasasi: 30, borclanma: 40, altin: 10, hisse: 5, karma: 10, dis_piyasa: 5, emtia: 0 },
    3: { para_piyasasi: 20, borclanma: 35, altin: 12, hisse: 10, karma: 13, dis_piyasa: 8, emtia: 2 },
    4: { para_piyasasi: 15, borclanma: 30, altin: 12, hisse: 15, karma: 15, dis_piyasa: 10, emtia: 3 },
    5: { para_piyasasi: 10, borclanma: 25, altin: 12, hisse: 20, karma: 15, dis_piyasa: 13, emtia: 5 },
  },
  orta: {
    1: { para_piyasasi: 30, borclanma: 35, altin: 10, hisse: 8, karma: 12, dis_piyasa: 5, emtia: 0 },
    2: { para_piyasasi: 22, borclanma: 30, altin: 12, hisse: 12, karma: 14, dis_piyasa: 8, emtia: 2 },
    3: { para_piyasasi: 15, borclanma: 25, altin: 12, hisse: 18, karma: 15, dis_piyasa: 12, emtia: 3 },
    4: { para_piyasasi: 10, borclanma: 18, altin: 12, hisse: 25, karma: 15, dis_piyasa: 15, emtia: 5 },
    5: { para_piyasasi: 5, borclanma: 12, altin: 12, hisse: 30, karma: 15, dis_piyasa: 18, emtia: 8 },
  },
  yuksek: {
    1: { para_piyasasi: 20, borclanma: 30, altin: 10, hisse: 15, karma: 12, dis_piyasa: 10, emtia: 3 },
    2: { para_piyasasi: 12, borclanma: 22, altin: 12, hisse: 22, karma: 12, dis_piyasa: 15, emtia: 5 },
    3: { para_piyasasi: 8, borclanma: 15, altin: 12, hisse: 28, karma: 12, dis_piyasa: 18, emtia: 7 },
    4: { para_piyasasi: 5, borclanma: 10, altin: 10, hisse: 35, karma: 10, dis_piyasa: 22, emtia: 8 },
    5: { para_piyasasi: 3, borclanma: 8, altin: 10, hisse: 37, karma: 8, dis_piyasa: 24, emtia: 10 },
  },
};

export const REBALANCE_THRESHOLD = 5;

export function growthShare(allocation: Record<string, number>): number {
  return (allocation.hisse ?? 0) + (allocation.dis_piyasa ?? 0) + (allocation.emtia ?? 0);
}

export function defensiveShare(allocation: Record<string, number>): number {
  return (allocation.para_piyasasi ?? 0) + (allocation.borclanma ?? 0);
}

function withTilt(
  base: Record<FundCategory, number>,
  tilt: Record<string, number>
): Record<FundCategory, number> {
  const next = { ...base };
  for (const key of Object.keys(next) as FundCategory[]) {
    next[key] += tilt[key] ?? 0;
    if (next[key] < 0) next[key] = 0;
  }
  let drift = 100 - Object.values(next).reduce((sum, value) => sum + value, 0);
  const order = (Object.keys(next) as FundCategory[]).sort((a, b) => next[b] - next[a] || a.localeCompare(b));
  while (drift !== 0) {
    const key = drift > 0 ? order[0] : order.find((item) => next[item] > 0);
    if (!key) break;
    next[key] += drift > 0 ? 1 : -1;
    drift += drift > 0 ? -1 : 1;
  }
  return next;
}

export function categoryTargets(
  riskLevel: RiskLevel,
  yearsToRetirement: number,
  macro: MacroAnalysis
): {
  bucket: number;
  glide: Record<FundCategory, number>;
  targets: Record<FundCategory, number>;
  tilt: Record<string, number>;
} {
  const bucket = horizonAnswerFromYears(yearsToRetirement);
  const glide = sleeveAllocation(GLIDE_PATH[riskLevel][bucket]);
  const tilt = getMacroAdjustments(macro);
  return { bucket, glide, tilt, targets: withTilt(glide, tilt) };
}

function consolidateByFundId(
  items: { fundId: string; percentage: number }[]
): { fundId: string; percentage: number }[] {
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.fundId, (merged.get(item.fundId) ?? 0) + item.percentage);
  }
  return Array.from(merged.entries())
    .map(([fundId, percentage]) => ({ fundId, percentage }))
    .sort((a, b) => b.percentage - a.percentage);
}

function buildTargetAllocation(
  riskLevel: RiskLevel,
  yearsToRetirement: number,
  macro: MacroAnalysis,
  menu: ScoredMenuFund[]
): {
  targetAllocation: {
    fundId: string;
    percentage: number;
    name: string;
    category: FundCategory;
    annualFeePercent: number | null;
  }[];
  unfilled: { category: FundCategory; percentage: number }[];
  allocationNotes: string[];
  bucket: number;
  tilt: Record<string, number>;
} {
  const planned = categoryTargets(riskLevel, yearsToRetirement, macro);
  const targets = { ...planned.targets };
  const allocationNotes: string[] = [];
  const hasPreciousMetal = menu.some((fund) => fund.category === "kiymetli_maden");
  if (targets.emtia > 0 && !hasPreciousMetal) {
    targets.altin += targets.emtia;
    targets.emtia = 0;
    allocationNotes.push("Menüde ayrı kıymetli maden fonu olmadığı için emtia payı altına yazıldı.");
  }
  const unfilled: { category: FundCategory; percentage: number }[] = [];
  const picked: {
    fundId: string;
    percentage: number;
    name: string;
    category: FundCategory;
    annualFeePercent: number | null;
  }[] = [];

  for (const category of Object.keys(targets) as FundCategory[]) {
    const percentage = targets[category];
    if (percentage <= 0) continue;
    const fund = bestFundForSleeve(category, menu);
    if (!fund) {
      unfilled.push({ category, percentage });
      continue;
    }
    picked.push({
      fundId: fund.code,
      percentage,
      name: fund.shortName,
      category,
      annualFeePercent: fund.yillikUcret,
    });
  }

  const merged = consolidateByFundId(picked);
  const names = new Map(picked.map((item) => [item.fundId, item]));
  return {
    targetAllocation: merged.map((item) => ({
      ...item,
      name: names.get(item.fundId)?.name ?? item.fundId,
      category: names.get(item.fundId)?.category ?? "karma",
      annualFeePercent: names.get(item.fundId)?.annualFeePercent ?? null,
    })),
    unfilled,
    allocationNotes,
    bucket: planned.bucket,
    tilt: planned.tilt,
  };
}

function buildReason(input: {
  fundId: string;
  currentPercent: number;
  targetPercent: number;
  deltaPercent: number;
  yearsToRetirement: number;
  riskLevel: RiskLevel;
  tiltPoints: number;
  isNewAccount: boolean;
}): string {
  const horizon = horizonLabel(horizonAnswerFromYears(input.yearsToRetirement));
  const band = RISK_LEVEL_LABELS[input.riskLevel];
  const tilt = `makro sapma ${input.tiltPoints > 0 ? "+" : ""}${input.tiltPoints} puan`;
  if (input.isNewAccount) {
    return `${input.fundId} için girdi ${horizon} ufku ve ${band} bandı, eşik yeni hesapta uygulanmaz, hedef %${input.targetPercent}, ${tilt}.`;
  }
  return `${input.fundId} için girdi ${horizon} ufku ve ${band} bandı, bugün %${input.currentPercent}, hedef %${input.targetPercent}, mutlak fark ${Math.abs(input.deltaPercent)} puan, eşik ${REBALANCE_THRESHOLD} puan, ${tilt}.`;
}

export function generateRecommendation(params: {
  riskLevel: RiskLevel;
  riskScore: number;
  yearsToRetirement: number;
  katilim: boolean;
  holdings: PortfolioHolding[];
  macro: MacroAnalysis;
  isNewAccount: boolean;
  menu: ScoredMenuFund[];
  directory?: { code: string; shortName: string; category: FundCategory | null; companyCode: string }[];
  companyCode: string;
  companyName: string;
}): PortfolioRecommendation {
  const {
    riskLevel,
    riskScore,
    yearsToRetirement,
    katilim,
    holdings,
    macro,
    isNewAccount,
    menu,
    directory = [],
    companyCode,
    companyName,
  } = params;

  const { targetAllocation, unfilled, allocationNotes, tilt } = buildTargetAllocation(
    riskLevel,
    yearsToRetirement,
    macro,
    menu
  );
  const targetMap = new Map(
    targetAllocation.map((t) => [t.fundId, t.percentage])
  );

  const currentMap = new Map<string, number>();
  for (const h of holdings) {
    currentMap.set(h.fundId, h.percentage);
  }

  const allFundIds = new Set([...targetMap.keys(), ...currentMap.keys()]);
  const actions: RebalanceAction[] = [];

  for (const fundId of allFundIds) {
    const current = currentMap.get(fundId) ?? 0;
    const target = targetMap.get(fundId) ?? 0;
    const delta = Math.round((target - current) * 10) / 10;

    if (!isNewAccount && Math.abs(delta) < REBALANCE_THRESHOLD) continue;
    if (Math.abs(delta) < 0.05) continue;

    const listed = menu.find((item) => item.code === fundId);
    const known = directory.find((item) => item.code === fundId);
    if (!listed && !known && current === 0) continue;
    const category = listed?.category ?? known?.category ?? "standart";
    const outsideMenu = !listed;

    let type: RebalanceAction["type"];
    if (current === 0 && target > 0) type = "ekle";
    else if (target === 0 && current > 0) type = "cikar";
    else if (delta < 0) type = "azalt";
    else type = "artir";

    const reason = outsideMenu
      ? `${fundId} seçilen şirketin menüsünde değil. Bugün %${current}, hedef %0, mutlak fark ${Math.abs(delta)} puan, eşik ${REBALANCE_THRESHOLD} puan.`
      : buildReason({
          fundId,
          currentPercent: current,
          targetPercent: target,
          deltaPercent: delta,
          yearsToRetirement,
          riskLevel,
          tiltPoints: tilt[category] ?? 0,
          isNewAccount,
        });

    actions.push({
      type,
      fundId,
      fundName: listed?.shortName ?? known?.shortName ?? fundId,
      category,
      currentPercent: current,
      targetPercent: target,
      deltaPercent: delta,
      reason,
    });
  }

  actions.sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent));

  const horizon = horizonLabel(horizonAnswerFromYears(yearsToRetirement));
  const tiltUsed = Object.values(tilt).some((value) => value !== 0);
  const rationale: string[] = [
    `Risk skorunuz ${riskScore}/100 — ${RISK_LEVEL_LABELS[riskLevel]} bandı.`,
    `Hedef dağılım ${horizon} ufku ile bu risk bandının tablosundan kuruldu.`,
    tiltUsed
      ? "Makro sapma kategori başına en fazla 3, toplam en fazla 8 puandır."
      : macro.missing.length > 0
        ? `Eksik piyasa verisi: ${macro.missing.join(", ")}. Makro sapma 0 puan.`
        : "Makro sapma uygulanmadı.",
  ];

  rationale.push(`Hedef fonlar ${companyName} menüsündedir.`);
  if (katilim) {
    rationale.push("Katılım tercihiniz açık olduğu için senaryo katılım fon etiketleriyle kuruldu.");
  }
  const skippedRules = [
    ...macro.missing
      .filter((name) => name.startsWith("USD/TRY") || name.startsWith("EUR/TRY"))
      .map((name) => ({
        id: `fx-${name}`,
        text: `${name} eksik. Bu kura bağlı sapma uygulanmadı.`,
      })),
    ...menu
      .filter((fund) => fund.category === null)
      .map((fund) => ({
        id: `type-${fund.code}`,
        text: `${fund.code} fon türü eşleşmedi. Öneriye girmedi.`,
      })),
    ...unfilled.map((item) => ({
      id: `menu-${item.category}`,
      text: `${getCategoryLabel(item.category)} menüde yok. %${item.percentage} hedefe yazılmadı.`,
    })),
    ...targetAllocation
      .filter((item) => item.annualFeePercent === null)
      .map((item) => ({
        id: `fee-${item.fundId}`,
        text: `${item.fundId} ücreti bilinmiyor. Kesinti hesabına girmedi.`,
      })),
  ];

  const fundDeltas = [...allFundIds]
    .map((fundId) => {
      const current = currentMap.get(fundId) ?? 0;
      const target = targetMap.get(fundId) ?? 0;
      const known = menu.find((item) => item.code === fundId) ?? directory.find((item) => item.code === fundId);
      const picked = targetAllocation.find((item) => item.fundId === fundId);
      return {
        fundId,
        name: picked?.name ?? known?.shortName ?? fundId,
        category: picked?.category ?? known?.category ?? null,
        currentPercent: current,
        targetPercent: target,
        deltaPercent: Math.round((target - current) * 10) / 10,
      };
    })
    .sort((a, b) => a.fundId.localeCompare(b.fundId, "tr"));

  const summary = isNewAccount
    ? "Yeni hesap senaryosunda dağılım, emekliliğe kalan yıl ve risk bandı tablosundan kuruldu."
    : `Mevcut dağılım hedef senaryoyla karşılaştırıldı. ${actions.length} başlıkta fark var.`;

  return {
    riskLevel,
    riskScore,
    companyCode,
    companyName,
    targetAllocation,
    unfilled,
    allocationNotes,
    skippedRules,
    fundDeltas,
    actions,
    summary,
    rationale,
    macroContext: macro,
    isNewAccount,
    katilim,
    categoryRankings: null,
    marketExamples: [],
  };
}

export function getAllocationBreakdown(
  allocation: { fundId: string; percentage: number; category?: FundCategory }[]
): { category: string; categoryKey: FundCategory; percentage: number; color: string }[] {
  const byCategory = new Map<FundCategory, number>();
  for (const item of allocation) {
    const cat = item.category ?? "karma";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + item.percentage);
  }

  return Array.from(byCategory.entries())
    .map(([cat, pct]) => ({
      category: getCategoryLabel(cat),
      categoryKey: cat,
      percentage: pct,
      color: getCategoryColor(cat),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}
