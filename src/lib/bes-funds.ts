import type { BesFund, FundCategory } from "./types";

export const FUND_CATEGORIES: Record<
  FundCategory,
  { label: string; riskRange: [number, number] }
> = {
  para_piyasasi: { label: "Para Piyasası", riskRange: [1, 2] },
  standart: { label: "Standart Fon", riskRange: [3, 5] },
  oks_standart: { label: "OKS Standart Fon", riskRange: [3, 5] },
  borclanma: { label: "Borçlanma Araçları", riskRange: [2, 4] },
  kamu_borclanma: { label: "Kamu Borçlanma", riskRange: [2, 4] },
  ozel_borclanma: { label: "Özel Sektör Borçlanma", riskRange: [2, 5] },
  dis_borclanma: { label: "Dış Borçlanma", riskRange: [3, 6] },
  doviz_borclanma: { label: "Döviz Cinsi Borçlanma", riskRange: [3, 6] },
  altin: { label: "Altın", riskRange: [4, 6] },
  kiymetli_maden: { label: "Kıymetli Maden", riskRange: [4, 7] },
  hisse: { label: "Hisse Senedi", riskRange: [6, 9] },
  katilim_hisse: { label: "Katılım Hisse", riskRange: [6, 9] },
  karma: { label: "Karma / Dengeli", riskRange: [4, 6] },
  dis_piyasa: { label: "Dış Piyasa", riskRange: [5, 8] },
  kira_sertifikasi: { label: "Kira Sertifikası", riskRange: [2, 5] },
  emtia: { label: "Emtia", riskRange: [5, 7] },
};

export const BES_FUNDS: BesFund[] = [
  {
    id: "pp-standart",
    name: "Para Piyasası Fonu",
    category: "para_piyasasi",
    riskScore: 1,
    description: "Kısa vadeli, düşük riskli likit enstrümanlar",
    katilim: false,
  },
  {
    id: "pp-katilim",
    name: "Katılım Para Piyasası Fonu",
    category: "para_piyasasi",
    riskScore: 1,
    description: "Faizsiz para piyasası enstrümanları",
    katilim: true,
  },
  {
    id: "bf-standart",
    name: "Borçlanma Araçları Fonu",
    category: "borclanma",
    riskScore: 3,
    description: "Devlet tahvili ve hazine bonosu ağırlıklı",
    katilim: false,
  },
  {
    id: "bf-katilim",
    name: "Katılım Borçlanma Fonu",
    category: "borclanma",
    riskScore: 3,
    description: "Sukuk ve katılım bonoları",
    katilim: true,
  },
  {
    id: "ak-standart",
    name: "Altın Fonu",
    category: "altin",
    riskScore: 5,
    description: "Fiziki altın ve altın endeksli enstrümanlar",
    katilim: false,
  },
  {
    id: "ak-katilim",
    name: "Katılım Altın Fonu",
    category: "altin",
    riskScore: 5,
    description: "Katılım prensiplerine uygun altın yatırımı",
    katilim: true,
  },
  {
    id: "hs-standart",
    name: "Hisse Senedi Fonu",
    category: "hisse",
    riskScore: 8,
    description: "BIST hisselerine yoğunlaşmış",
    katilim: false,
  },
  {
    id: "hs-katilim",
    name: "Katılım Hisse Senedi Fonu",
    category: "hisse",
    riskScore: 8,
    description: "Faaliyetleri faize dayalı olmayan şirketler",
    katilim: true,
  },
  {
    id: "kb-standart",
    name: "Karma / Dengeli Fon",
    category: "karma",
    riskScore: 5,
    description: "Hisse ve sabit getirili enstrüman karışımı",
    katilim: false,
  },
  {
    id: "kb-katilim",
    name: "Katılım Karma Fon",
    category: "karma",
    riskScore: 5,
    description: "Katılım uyumlu dengeli dağılım",
    katilim: true,
  },
  {
    id: "dg-standart",
    name: "Dış Piyasa Fonu",
    category: "dis_piyasa",
    riskScore: 7,
    description: "Yurt dışı hisse ve tahvil piyasaları",
    katilim: false,
  },
  {
    id: "dg-katilim",
    name: "Katılım Dış Piyasa Fonu",
    category: "dis_piyasa",
    riskScore: 7,
    description: "Global katılım endekslerine yatırım",
    katilim: true,
  },
];

export function getFundById(id: string): BesFund | undefined {
  return BES_FUNDS.find((f) => f.id === id);
}

export function getFundsForPreference(katilim: boolean): BesFund[] {
  return BES_FUNDS.filter((f) => f.katilim === katilim);
}

export function getCategoryLabel(category: FundCategory): string {
  return FUND_CATEGORIES[category].label;
}
