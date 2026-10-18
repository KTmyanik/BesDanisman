import type { RiskAnswer, RiskLevel } from "./types";

export interface RiskQuestion {
  id: string;
  text: string;
  options: { value: number; label: string }[];
}

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: "horizon",
    text: "Emekliliğe kaç yılınız kaldı?",
    options: [
      { value: 1, label: "5 yıldan az" },
      { value: 2, label: "5–10 yıl" },
      { value: 3, label: "10–20 yıl" },
      { value: 4, label: "20–30 yıl" },
      { value: 5, label: "30 yıldan fazla" },
    ],
  },
  {
    id: "loss_tolerance",
    text: "Portföyünüz %20 değer kaybettiğinde ne yaparsınız?",
    options: [
      { value: 1, label: "Hemen daha güvenli fonlara geçerim" },
      { value: 2, label: "Endişelenir, kısmen azaltırım" },
      { value: 3, label: "Beklerim, uzun vadeye güvenirim" },
      { value: 4, label: "Alım fırsatı görür, eklerim" },
      { value: 5, label: "Agresif fonlara yönelirim" },
    ],
  },
  {
    id: "experience",
    text: "Yatırım deneyiminiz nasıl?",
    options: [
      { value: 1, label: "Hiç yatırım yapmadım" },
      { value: 2, label: "Sadece mevduat / BES" },
      { value: 3, label: "Hisse ve fon deneyimim var" },
      { value: 4, label: "Aktif portföy yönetiyorum" },
      { value: 5, label: "Profesyonel düzeyde" },
    ],
  },
  {
    id: "income_stability",
    text: "Gelir istikrarınız nasıl?",
    options: [
      { value: 1, label: "Düzensiz / belirsiz" },
      { value: 2, label: "Orta düzeyde istikrarlı" },
      { value: 3, label: "Düzenli maaşlı çalışan" },
      { value: 4, label: "İyi gelir, birikim yapabiliyorum" },
      { value: 5, label: "Çok yüksek gelir, kayıp tolere edebilirim" },
    ],
  },
  {
    id: "goal",
    text: "BES'ten beklentiniz nedir?",
    options: [
      { value: 1, label: "Sermayemi korumak, enflasyonun üstünde getiri" },
      { value: 2, label: "Düşük riskle istikrarlı büyüme" },
      { value: 3, label: "Orta riskle makul getiri" },
      { value: 4, label: "Yüksek getiri, dalgalanmayı kabul ederim" },
      { value: 5, label: "Maksimum uzun vadeli büyüme" },
    ],
  },
  {
    id: "volatility_comfort",
    text: "Aylık getiri dalgalanması sizi ne kadar rahatsız eder?",
    options: [
      { value: 1, label: "Çok rahatsız eder, istikrar isterim" },
      { value: 2, label: "Biraz dalgalanma tolere ederim" },
      { value: 3, label: "Orta düzey dalgalanma normal" },
      { value: 4, label: "Dalgalanma beni endişelendirmez" },
      { value: 5, label: "Yüksek dalgalanma = yüksek fırsat" },
    ],
  },
];

/**
 * Ufuk ve kayıp toleransı skoru kurar. Gelir istikrarı kapasite tavanıdır.
 * Deneyim skoru yükseltmez; 3'ün altındaki deneyim yüksek banda çıkışı kapatır.
 * Amaç ve dalgalanma cevapları kayıt için zorunludur, skora girmez.
 */
export const RISK_MODEL = {
  drivers: {
    horizon: 0.5,
    loss_tolerance: 0.5,
  },
  recordedButNotScored: ["goal", "volatility_comfort"],
  incomeCapacityCap: {
    1: 33,
    2: 50,
    3: 66,
    4: null,
    5: null,
  },
  experienceAllowsHighRiskFrom: 3,
  highRiskCapWhenBlocked: 66,
  bands: { dusukMax: 33, ortaMax: 66 },
} as const;

export interface RiskProfileResult {
  score: number;
  level: RiskLevel;
  label: string;
  description: string;
}

function answerToScore(value: number): number {
  return ((value - 1) / 4) * 100;
}

export function calculateRiskProfile(answers: RiskAnswer[]): RiskProfileResult | null {
  if (!Array.isArray(answers) || answers.length === 0) return null;

  const byId = new Map<string, number>();
  for (const answer of answers) {
    if (!answer || typeof answer.questionId !== "string") return null;
    if (!Number.isInteger(answer.value) || answer.value < 1 || answer.value > 5) return null;
    byId.set(answer.questionId, answer.value);
  }

  for (const question of RISK_QUESTIONS) {
    if (!byId.has(question.id)) return null;
  }

  let weighted = 0;
  for (const [id, weight] of Object.entries(RISK_MODEL.drivers)) {
    const value = byId.get(id);
    if (value === undefined) return null;
    weighted += answerToScore(value) * weight;
  }

  let score = Math.round(weighted);
  const income = byId.get("income_stability");
  if (income === undefined || !(income in RISK_MODEL.incomeCapacityCap)) return null;
  const incomeCap = RISK_MODEL.incomeCapacityCap[income as keyof typeof RISK_MODEL.incomeCapacityCap];
  if (incomeCap !== null) score = Math.min(score, incomeCap);

  const experience = byId.get("experience");
  if (experience === undefined) return null;
  if (experience < RISK_MODEL.experienceAllowsHighRiskFrom && score > RISK_MODEL.highRiskCapWhenBlocked) {
    score = RISK_MODEL.highRiskCapWhenBlocked;
  }

  if (score <= RISK_MODEL.bands.dusukMax) {
    return {
      score,
      level: "dusuk",
      label: "Düşük Risk (Muhafazakâr)",
      description: "Skor ufuk ve kayıp toleransından gelir. Bant düşük riskte kaldı.",
    };
  }
  if (score <= RISK_MODEL.bands.ortaMax) {
    return {
      score,
      level: "orta",
      label: "Orta Risk (Dengeli)",
      description: "Skor ufuk ve kayıp toleransından gelir. Bant dengeli riskte kaldı.",
    };
  }
  return {
    score,
    level: "yuksek",
    label: "Yüksek Risk (Agresif)",
    description:
      "Skor ufuk ve kayıp toleransından gelir. Gelir kapasitesi ve deneyim yüksek banda izin verdi.",
  };
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  dusuk: "Düşük Risk",
  orta: "Orta Risk",
  yuksek: "Yüksek Risk",
};
