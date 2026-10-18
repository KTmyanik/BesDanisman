import { calculateRiskProfile, RISK_QUESTIONS, type RiskProfileResult } from "./risk-profile";
import type { ContractType, PersonProfile, RiskAnswer } from "./types";

export const PERSON_LIMITS = {
  maxYearsToRetirement: 70,
  maxMoneyTry: 1_000_000_000,
} as const;

const CONTRACT_TYPES = new Set<ContractType>(["gonullu", "oks"]);

export function horizonAnswerFromYears(years: number): number {
  if (years < 5) return 1;
  if (years < 10) return 2;
  if (years < 20) return 3;
  if (years < 30) return 4;
  return 5;
}

export function horizonLabel(value: number): string {
  const question = RISK_QUESTIONS.find((item) => item.id === "horizon");
  return question?.options.find((option) => option.value === value)?.label ?? "";
}

function missing(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

export function parseYears(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) return null;
    if (value < 0 || value > PERSON_LIMITS.maxYearsToRetirement) return null;
    return value;
  }
  if (typeof value !== "string" || !/^\d{1,2}$/.test(value.trim())) return null;
  const years = Number(value.trim());
  if (years > PERSON_LIMITS.maxYearsToRetirement) return null;
  return years;
}

export function parseMoney(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value > PERSON_LIMITS.maxMoneyTry) return null;
    if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return null;
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s/g, "").replace("₺", "");
  if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) return null;
  const amount = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(amount) || amount > PERSON_LIMITS.maxMoneyTry) return null;
  return amount;
}

export function parsePersonProfile(input: {
  yearsToRetirement: unknown;
  monthlyContributionTry: unknown;
  balanceTry: unknown;
  contractType: unknown;
}): { ok: true; profile: PersonProfile } | { ok: false; error: string } {
  if (missing(input.yearsToRetirement)) {
    return { ok: false, error: "Emekliliğe kalan yıl girilmedi." };
  }
  const yearsToRetirement = parseYears(input.yearsToRetirement);
  if (yearsToRetirement === null) {
    return { ok: false, error: "Emekliliğe kalan yıl 0 ile 70 arasında tam sayı olmalıdır." };
  }

  if (missing(input.monthlyContributionTry)) {
    return { ok: false, error: "Aylık katkı girilmedi." };
  }
  const monthlyContributionTry = parseMoney(input.monthlyContributionTry);
  if (monthlyContributionTry === null) {
    return { ok: false, error: "Aylık katkı sıfır veya pozitif bir tutar olmalıdır." };
  }

  if (missing(input.balanceTry)) {
    return { ok: false, error: "Mevcut birikim girilmedi." };
  }
  const balanceTry = parseMoney(input.balanceTry);
  if (balanceTry === null) {
    return { ok: false, error: "Mevcut birikim sıfır veya pozitif bir tutar olmalıdır." };
  }

  if (missing(input.contractType) || !CONTRACT_TYPES.has(input.contractType as ContractType)) {
    return { ok: false, error: "Sözleşme türü seçilmedi." };
  }

  return {
    ok: true,
    profile: {
      yearsToRetirement,
      monthlyContributionTry,
      balanceTry,
      contractType: input.contractType as ContractType,
    },
  };
}

function parseRiskAnswers(value: unknown): RiskAnswer[] | null {
  if (!Array.isArray(value)) return null;
  const answers: RiskAnswer[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const questionId = (item as { questionId?: unknown }).questionId;
    const answerValue = (item as { value?: unknown }).value;
    if (typeof questionId !== "string" || typeof answerValue !== "number") return null;
    answers.push({ questionId, value: answerValue });
  }
  return answers;
}

export function validatePlanInputs(input: {
  yearsToRetirement: unknown;
  monthlyContributionTry: unknown;
  balanceTry: unknown;
  contractType: unknown;
  riskAnswers: unknown;
}): { ok: true; profile: PersonProfile; risk: RiskProfileResult } | { ok: false; error: string } {
  const person = parsePersonProfile(input);
  if (!person.ok) return person;

  const answers = parseRiskAnswers(input.riskAnswers);
  if (!answers) {
    return { ok: false, error: "Risk anketi eksik. Altı sorunun hepsi cevaplanmadan plan üretilmez." };
  }

  const risk = calculateRiskProfile(answers);
  if (!risk) {
    return { ok: false, error: "Risk anketi eksik. Altı sorunun hepsi cevaplanmadan plan üretilmez." };
  }

  const horizon = answers.filter((answer) => answer.questionId === "horizon").at(-1)?.value;
  if (horizon !== horizonAnswerFromYears(person.profile.yearsToRetirement)) {
    return { ok: false, error: "Ufuk cevabı emekliliğe kalan yılla uyuşmuyor." };
  }

  return { ok: true, profile: person.profile, risk };
}

export function contractTypeLabel(contractType: ContractType): string {
  return contractType === "oks" ? "OKS" : "Gönüllü BES";
}
