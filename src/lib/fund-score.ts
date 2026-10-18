import type { FundCategory } from "./types";
import type { ClassifiedFund } from "./fund-snapshot";

/**
 * Peer points inside one category. Fee plus size stay below the return-rank
 * cap, so those two cannot overturn a full return-rank gap by themselves.
 */
export const SCORE_WEIGHTS = {
  returnRank: 40,
  consistency: 25,
  fee: 20,
  size: 15,
} as const;

export interface FundScore {
  score: number;
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

type WindowKey = "getiri6a" | "getiri1y" | "getiri3y";

export function equityWindowWeights(yearsToRetirement: number): { getiri1y: number; getiri3y: number } {
  if (yearsToRetirement < 10) return { getiri1y: 0.7, getiri3y: 0.3 };
  if (yearsToRetirement >= 20) return { getiri1y: 0.3, getiri3y: 0.7 };
  return { getiri1y: 0.5, getiri3y: 0.5 };
}

export function sleeveOf(category: FundCategory): FundCategory {
  if (category === "kamu_borclanma" || category === "ozel_borclanma" || category === "borclanma") {
    return "borclanma";
  }
  if (category === "katilim_hisse" || category === "hisse") return "hisse";
  if (category === "kiymetli_maden" || category === "emtia") return "emtia";
  return category;
}

export function windowsForSleeve(sleeve: FundCategory, yearsToRetirement: number): { key: WindowKey; weight: number }[] {
  if (sleeve === "para_piyasasi") return [{ key: "getiri6a", weight: 1 }];
  if (sleeve === "hisse" || sleeve === "dis_piyasa") {
    const weights = equityWindowWeights(yearsToRetirement);
    return [
      { key: "getiri1y", weight: weights.getiri1y },
      { key: "getiri3y", weight: weights.getiri3y },
    ];
  }
  if (yearsToRetirement >= 20) {
    return [
      { key: "getiri1y", weight: 0.4 },
      { key: "getiri3y", weight: 0.6 },
    ];
  }
  if (yearsToRetirement < 10) {
    return [
      { key: "getiri6a", weight: 0.6 },
      { key: "getiri1y", weight: 0.4 },
    ];
  }
  return [{ key: "getiri1y", weight: 1 }];
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function rankPoints(
  rows: { code: string; value: number }[],
  code: string,
  cap: number,
  higherIsBetter: boolean
): number | null {
  const mine = rows.find((row) => row.code === code);
  if (!mine) return null;
  const distinct = [...new Set(rows.map((row) => row.value))].sort((a, b) =>
    higherIsBetter ? b - a : a - b
  );
  if (distinct.length <= 1) return cap;
  const place = distinct.indexOf(mine.value);
  return roundScore((1 - place / (distinct.length - 1)) * cap);
}

function consistencyPoints(fund: ClassifiedFund, windows: WindowKey[]): number | null {
  const present = windows
    .map((key) => fund[key])
    .filter((value): value is number => typeof value === "number");
  if (present.length === 0) return null;
  const positive = present.filter((value) => value > 0).length;
  const quality = positive / present.length;
  const coverage = present.length / windows.length;
  return roundScore(quality * coverage * SCORE_WEIGHTS.consistency);
}

function returnPoints(
  fund: ClassifiedFund,
  peers: ClassifiedFund[],
  windows: { key: WindowKey; weight: number }[]
): number | null {
  let weighted = 0;
  let weightSum = 0;
  for (const window of windows) {
    const rows = peers
      .map((peer) => ({ code: peer.code, value: peer[window.key] }))
      .filter((row): row is { code: string; value: number } => typeof row.value === "number");
    const points = rankPoints(rows, fund.code, SCORE_WEIGHTS.returnRank, true);
    if (points === null) continue;
    weighted += points * window.weight;
    weightSum += window.weight;
  }
  if (weightSum === 0) return null;
  return roundScore(weighted / weightSum);
}

function emptyBreakdown(fund: ClassifiedFund): FundScore["scoreBreakdown"] {
  return {
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
  };
}

export function scoreFunds(funds: ClassifiedFund[], yearsToRetirement: number): Map<string, FundScore> {
  const scored = new Map<string, FundScore>();
  const groups = new Map<string, ClassifiedFund[]>();
  for (const fund of funds) {
    const key = fund.category ? sleeveOf(fund.category) : "unknown";
    groups.set(key, [...(groups.get(key) ?? []), fund]);
  }

  for (const [key, peers] of groups) {
    const windows =
      key === "unknown" ? [] : windowsForSleeve(key as FundCategory, yearsToRetirement);
    const feeRows = peers
      .filter((fund) => typeof fund.yillikUcret === "number")
      .map((fund) => ({ code: fund.code, value: fund.yillikUcret as number }));
    const sizeRows = peers
      .filter((fund) => typeof fund.portfoyBuyukluk === "number")
      .map((fund) => ({ code: fund.code, value: fund.portfoyBuyukluk as number }));

    for (const fund of peers) {
      const breakdown = emptyBreakdown(fund);
      breakdown.getiriPuani = windows.length ? returnPoints(fund, peers, windows) : null;
      breakdown.tutarlilikPuani = windows.length ? consistencyPoints(fund, windows.map((item) => item.key)) : null;
      breakdown.ucretPuani = rankPoints(feeRows, fund.code, SCORE_WEIGHTS.fee, false);
      breakdown.buyuklukPuani = rankPoints(sizeRows, fund.code, SCORE_WEIGHTS.size, true);
      const parts = [
        breakdown.getiriPuani,
        breakdown.tutarlilikPuani,
        breakdown.ucretPuani,
        breakdown.buyuklukPuani,
      ].filter((value): value is number => typeof value === "number");
      scored.set(fund.code, {
        score: roundScore(parts.reduce((sum, value) => sum + value, 0)),
        scoreBreakdown: breakdown,
      });
    }
  }

  return scored;
}
