import type { FundCategory } from "./types";

export const CATEGORY_COLORS: Record<FundCategory, string> = {
  para_piyasasi: "#60a5fa",
  standart: "#38bdf8",
  oks_standart: "#0284c7",
  borclanma: "#34d399",
  kamu_borclanma: "#10b981",
  ozel_borclanma: "#059669",
  dis_borclanma: "#0f766e",
  doviz_borclanma: "#14b8a6",
  altin: "#fbbf24",
  kiymetli_maden: "#d97706",
  hisse: "#f87171",
  katilim_hisse: "#e11d48",
  karma: "#a78bfa",
  dis_piyasa: "#fb923c",
  kira_sertifikasi: "#6ee7b7",
  emtia: "#94a3b8",
};

export function getCategoryColor(category: FundCategory): string {
  return CATEGORY_COLORS[category] ?? "#94a3b8";
}
