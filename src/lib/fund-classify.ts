import type { FundCategory } from "./types";

const TYPE_CATEGORY: Record<string, FundCategory> = {
  "Standart Fon": "standart",
  "Katılım Standart Fon": "standart",
  "OKS Standart Fon": "oks_standart",
  "OKS Katılım Standart Fon": "oks_standart",
  "Borçlanma Araçları Fonu": "borclanma",
  "Kamu Borçlanma Araçları Fonu": "kamu_borclanma",
  "Özel Sektör Borçlanma Araçları Fonu": "ozel_borclanma",
  "Dış Borçlanma Araçları Fonu": "dis_borclanma",
  "Kamu Yabancı Para (Döviz) Cinsinden Borçlanma Araç": "doviz_borclanma",
  "Altın Fonu": "altin",
  "Altın Katılım Fonu": "altin",
  "Kıymetli Madenler": "kiymetli_maden",
  "Hisse Senedi Fonu": "hisse",
  "Katılım Hisse Senedi Fonu": "katilim_hisse",
  "Endeks Fon": "hisse",
  "Karma Fon": "karma",
  "Değişken Fon": "karma",
  "Katılım Değişken Fon": "karma",
  "Fon Sepeti Fonu": "karma",
  "Kira Sertifikasi Katılım Fonu": "kira_sertifikasi",
};

const PROTECTED_TYPES = new Set<FundCategory>([
  "standart",
  "oks_standart",
  "borclanma",
  "kamu_borclanma",
  "ozel_borclanma",
  "dis_borclanma",
  "doviz_borclanma",
  "altin",
  "kiymetli_maden",
  "kira_sertifikasi",
]);

const FOREIGN_MARKET_TYPES = new Set([
  "Hisse Senedi Fonu",
  "Katılım Hisse Senedi Fonu",
  "Endeks Fon",
  "Karma Fon",
  "Değişken Fon",
  "Katılım Değişken Fon",
  "Fon Sepeti Fonu",
]);

const KATILIM_TYPES = new Set([
  "Altın Katılım Fonu",
  "Katılım Değişken Fon",
  "Katılım Fonu",
  "Katılım Hisse Senedi Fonu",
  "Katılım Standart Fon",
  "OKS Katılım Standart Fon",
  "Kira Sertifikasi Katılım Fonu",
]);

export function normalizeTr(value: string): string {
  return value
    .replace(/İ/g, "I")
    .replace(/ı/g, "I")
    .toUpperCase()
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
}

function isMoneyMarketName(normalized: string): boolean {
  return normalized.includes("PARA PIYASA") || /(?:^| )LIKIT(?: |$)/.test(normalized);
}

function isForeignMarketName(normalized: string): boolean {
  return (
    normalized.includes("DIS PIYASA") ||
    normalized.includes("YURT DISI") ||
    normalized.includes("GLOBAL") ||
    normalized.includes("ULUSLARARASI") ||
    normalized.includes("YABANCI")
  );
}

export function isKatilimFund(fundType: string, name: string): boolean {
  if (KATILIM_TYPES.has(fundType)) return true;
  const normalized = normalizeTr(name);
  if (/KATILIM(?!CI)/.test(normalized)) return true;
  return normalized.includes("SUKUK") || normalized.includes("KIRA SERTIF");
}

/** Null means the fund type is unknown and must not be recommended. */
export function classifyFund(fundType: string, name: string): FundCategory | null {
  const fromType = TYPE_CATEGORY[fundType];
  if (fromType && PROTECTED_TYPES.has(fromType)) return fromType;

  const normalized = normalizeTr(name);
  if (isMoneyMarketName(normalized)) return "para_piyasasi";
  if (FOREIGN_MARKET_TYPES.has(fundType) && isForeignMarketName(normalized)) {
    return "dis_piyasa";
  }
  if (fromType) return fromType;
  if (
    isForeignMarketName(normalized) &&
    (normalized.includes("HISSE") || normalized.includes("KARMA") || normalized.includes("DEGISKEN"))
  ) {
    return "dis_piyasa";
  }
  return null;
}

export function companyNameFromTitle(unvan: string): string {
  for (const marker of [" A.Ş.", " A.S.", " A.Ş ", " A.S "]) {
    const index = unvan.indexOf(marker);
    if (index > 0) return unvan.slice(0, index + marker.trimEnd().length).trim();
  }
  return unvan.slice(0, 80).trim();
}

export function shortFundName(unvan: string): string {
  const company = companyNameFromTitle(unvan);
  if (unvan.startsWith(company)) {
    const rest = unvan.slice(company.length).replace(/^[\s.]+/, "").trim();
    if (rest) return rest;
  }
  return unvan;
}
