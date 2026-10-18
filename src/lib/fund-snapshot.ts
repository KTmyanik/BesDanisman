import fs from "fs";
import path from "path";
import { classifyFund, isKatilimFund, shortFundName } from "./fund-classify";
import type { FundCategory } from "./types";

export const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SnapshotFund {
  code: string;
  name: string;
  fundType: string;
  companyCode: string;
  company: string;
  tefasDurum: boolean;
  riskDegeri: number | null;
  getiri1y: number | null;
  getiri6a: number | null;
  getiriYb: number | null;
  getiri3y: number | null;
  yillikUcret: number | null;
  portfoyBuyukluk: number | null;
}

export interface FundSnapshot {
  fetchedAt: string;
  source: string;
  funds: SnapshotFund[];
}

export interface ClassifiedFund extends SnapshotFund {
  shortName: string;
  category: FundCategory | null;
  katilim: boolean;
}

export function snapshotFilePath(): string {
  return path.join(process.cwd(), "data", "funds-snapshot.json");
}

export function snapshotProblem(snapshot: FundSnapshot | null, now = Date.now()): string | null {
  if (!snapshot || snapshot.funds.length === 0) {
    return "Fon evreni anlık görüntüsü yok. py scripts/snapshot-bes-funds.py ile oluşturun.";
  }
  const fetchedAt = Date.parse(snapshot.fetchedAt);
  if (Number.isNaN(fetchedAt)) {
    return "Fon evreni anlık görüntüsünün veri tarihi okunamadı.";
  }
  if (now - fetchedAt > SNAPSHOT_MAX_AGE_MS) {
    return "Fon evreni anlık görüntüsü güncel değil. py scripts/snapshot-bes-funds.py ile yenileyin.";
  }
  return null;
}

function isSnapshotFund(value: unknown): value is SnapshotFund {
  if (!value || typeof value !== "object") return false;
  const row = value as SnapshotFund;
  return typeof row.code === "string" && typeof row.name === "string" && typeof row.companyCode === "string";
}

export function parseSnapshot(value: unknown): FundSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as FundSnapshot;
  if (typeof raw.fetchedAt !== "string" || typeof raw.source !== "string" || !Array.isArray(raw.funds)) {
    return null;
  }
  const funds = raw.funds.filter(isSnapshotFund);
  if (funds.length !== raw.funds.length) return null;
  return { fetchedAt: raw.fetchedAt, source: raw.source, funds };
}

export function loadFundSnapshot(filePath = snapshotFilePath()): FundSnapshot | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    return parseSnapshot(parsed);
  } catch {
    return null;
  }
}

export function classifySnapshot(snapshot: FundSnapshot): ClassifiedFund[] {
  const seen = new Set<string>();
  const funds: ClassifiedFund[] = [];
  for (const fund of snapshot.funds) {
    const code = fund.code.trim().toUpperCase();
    if (!code || !fund.companyCode.trim() || seen.has(code)) continue;
    seen.add(code);
    funds.push({
      ...fund,
      code,
      companyCode: fund.companyCode.trim().toUpperCase(),
      shortName: shortFundName(fund.name),
      category: classifyFund(fund.fundType, fund.name),
      katilim: isKatilimFund(fund.fundType, fund.name),
    });
  }
  return funds;
}
