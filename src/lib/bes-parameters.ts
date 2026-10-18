export interface Sourced<T> {
  value: T;
  /** First day the value is in force, YYYY-MM-DD. */
  effectiveFrom: string;
  /** Day this record was checked against the cited source, YYYY-MM-DD. */
  reviewedOn: string;
  source: string;
  sourceUrl: string;
}

export const LEGAL_PARAMETERS_REVIEWED_ON = "2026-10-18";

/** Monthly gross minimum wage. Annual cap base is this times 12. */
export const MONTHLY_GROSS_MINIMUM_WAGE_TRY: Sourced<number> = {
  value: 33_030,
  effectiveFrom: "2026-01-01",
  reviewedOn: LEGAL_PARAMETERS_REVIEWED_ON,
  source:
    "T.C. Çalışma ve Sosyal Güvenlik Bakanlığı: 1 Ocak 2026’dan itibaren aylık brüt asgari ücret 33.030 TL.",
  sourceUrl:
    "https://www.csgb.gov.tr/tr/haberler/2026-yilinda-gecerli-olacak-yeni-asgari-ucret-28-bin-75-lira-olarak-belirlendi/",
};

export const MINIMUM_WAGE_MONTHS_IN_YEAR = 12;

/**
 * State match on Turkish-lira contributions that reach the pension company.
 * Employer contributions are outside this rate. Foreign-currency contributions
 * are outside this record; no amount is produced for them.
 */
export const STATE_CONTRIBUTION_RATE: Sourced<number> = {
  value: 0.2,
  effectiveFrom: "2026-01-01",
  reviewedOn: LEGAL_PARAMETERS_REVIEWED_ON,
  source:
    "4632 sayılı Kanun Ek-1. 10811 sayılı Cumhurbaşkanı Kararı (7 Ocak 2026 tarihli ve 33130 sayılı Resmî Gazete) ile 1 Ocak 2026’dan itibaren Türk lirası katkı paylarında oran yüzde 20. EGM aynı oranı yayımlar.",
  sourceUrl: "https://www.egm.org.tr/bireysel-emeklilik/devlet-katkisi/",
};

export const STATE_CONTRIBUTION_CAP_RULE = {
  text: "Bir takvim yılında devlet katkısına esas katkı payı, o yılın brüt asgari ücretinin 12 aylık tutarını aşamaz. Devlet katkısı bu tutarın yürürlükteki oranıdır. Aşan katkı, sonraki yılın ilk günü şirkete intikal etmiş katkı sayılır. İşveren katkısı hesaba girmez. OKS ve gönüllü BES limitleri ayrıdır. Bu kayıt yalnızca Türk lirası katkı içindir.",
  effectiveFrom: "2026-01-01",
  reviewedOn: LEGAL_PARAMETERS_REVIEWED_ON,
  source: "EGM Devlet Katkısı Rehberi, 7 Ocak 2026.",
  sourceUrl: "https://cdn.egm.org.tr/sites/files/DK20Rehberi_07.01.2026-3103.pdf",
} as const;

export const SEPARATE_OKS_AND_BES_CAPS: Sourced<boolean> = {
  value: true,
  effectiveFrom: "2026-01-01",
  reviewedOn: LEGAL_PARAMETERS_REVIEWED_ON,
  source:
    "EGM: OKS sözleşmeleri ile gönüllü BES sözleşmeleri için devlet katkısı üst sınırı ayrı ayrı uygulanır.",
  sourceUrl: "https://www.egm.org.tr/otomatik-katilim/devlet-katkisi/",
};

/** One-time OKS amount after the participant stays past the opt-out window. Not part of the annual cap. */
export const OKS_WELCOME_STATE_CONTRIBUTION_TRY: Sourced<number> & {
  countsTowardAnnualCap: false;
} = {
  value: 500,
  countsTowardAnnualCap: false,
  effectiveFrom: "2026-01-01",
  reviewedOn: LEGAL_PARAMETERS_REVIEWED_ON,
  source:
    "4632 sayılı Kanun Ek-2. 1 Ocak 2026’dan itibaren cayma hakkını kullanmayan çalışana bir defalık 500 TL. Yıllık limite dahil değildir.",
  sourceUrl: "https://www.egm.org.tr/otomatik-katilim/devlet-katkisi/",
};

/**
 * Scenario assumption, not an inflation forecast. The report must say so,
 * and the screen must let the reader replace the percent.
 */
export const INFLATION_ASSUMPTION: Sourced<number> = {
  value: 24,
  effectiveFrom: "2026-08-13",
  reviewedOn: LEGAL_PARAMETERS_REVIEWED_ON,
  source:
    "TCMB Enflasyon Raporu 2026-III: 2026 ara hedefi yüzde 24 olarak korunmuştur. Bu yüzde bir senaryo varsayımıdır; enflasyon tahmini olarak kullanılmaz.",
  sourceUrl:
    "https://www.tcmb.gov.tr/wps/wcm/connect/b465a891-4453-40ce-a79c-3fb9b2c846b4/1b26_iii.pdf?MOD=AJPERES",
};

export const VESTING_FULL_REASONS = ["emeklilik", "vefat", "maluliyet"] as const;

export type VestingFullReason = (typeof VESTING_FULL_REASONS)[number];

export interface VestingYearBracket {
  minYears: number;
  ratio: number;
}

export const VESTING = {
  effectiveFrom: "2013-01-01",
  reviewedOn: LEGAL_PARAMETERS_REVIEWED_ON,
  source:
    "EGM hak ediş tablosu. 1 Ocak 2013’ten sonra sistemde geçen süreye göre devlet katkısı hesabındaki tutar.",
  sourceUrl: "https://www.egm.org.tr/bireysel-emeklilik/devlet-katkisi/",
  /** Applied when exit is not retirement, death, or disability. */
  byYears: [
    { minYears: 0, ratio: 0 },
    { minYears: 3, ratio: 0.15 },
    { minYears: 6, ratio: 0.35 },
    { minYears: 10, ratio: 0.6 },
  ] as const satisfies readonly VestingYearBracket[],
  fullReasons: VESTING_FULL_REASONS,
  fullRatio: 1,
} as const;
