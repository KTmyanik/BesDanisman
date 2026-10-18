import { describe, expect, it } from "vitest";
import { horizonAnswerFromYears, parsePersonProfile, validatePlanInputs } from "./person-profile";
import { parseStoredSession, serializeStoredSession, sessionFingerprint, type StoredSession } from "./profile-storage";
import type { RiskAnswer } from "./types";

function answers(horizon: number): RiskAnswer[] {
  return [
    { questionId: "horizon", value: horizon },
    { questionId: "loss_tolerance", value: 4 },
    { questionId: "experience", value: 3 },
    { questionId: "income_stability", value: 4 },
    { questionId: "goal", value: 3 },
    { questionId: "volatility_comfort", value: 3 },
  ];
}

const person = {
  yearsToRetirement: 18,
  monthlyContributionTry: "5000",
  balanceTry: "120000",
  contractType: "gonullu",
};

describe("person profile", () => {
  it("rejects an empty field and accepts zero contribution", () => {
    expect(parsePersonProfile({ ...person, yearsToRetirement: "" }).ok).toBe(false);
    expect(parsePersonProfile({ ...person, contractType: "" }).ok).toBe(false);
    const zero = parsePersonProfile({ ...person, monthlyContributionTry: "0", balanceTry: "0" });
    expect(zero.ok && zero.profile.monthlyContributionTry).toBe(0);
  });

  it("maps remaining years onto the horizon buckets", () => {
    expect(horizonAnswerFromYears(4)).toBe(1);
    expect(horizonAnswerFromYears(5)).toBe(2);
    expect(horizonAnswerFromYears(10)).toBe(3);
    expect(horizonAnswerFromYears(20)).toBe(4);
    expect(horizonAnswerFromYears(30)).toBe(5);
  });

  it("returns 400-ready errors for a missing questionnaire or a mismatched horizon", () => {
    const missing = validatePlanInputs({ ...person, riskAnswers: answers(3).slice(0, 5) });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain("Altı sorunun");

    const mismatch = validatePlanInputs({ ...person, riskAnswers: answers(1) });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.error).toContain("uyuşmuyor");

    const ready = validatePlanInputs({ ...person, riskAnswers: answers(3) });
    expect(ready.ok).toBe(true);
    if (ready.ok) expect(ready.risk.score).not.toBe(50);
  });
});

describe("profile storage", () => {
  it("round-trips the form and drops an unreadable payload", () => {
    const fingerprint = sessionFingerprint({
      hasPortfolio: false,
      katilim: false,
      companyCode: "AHS",
      yearsToRetirement: "18",
      monthlyContributionTry: "5000",
      balanceTry: "0",
      contractType: "oks",
      riskAnswers: answers(3),
      holdings: [],
    });
    const session: StoredSession = {
      version: 1,
      step: 1,
      hasPortfolio: false,
      katilim: false,
      companyCode: "AHS",
      yearsToRetirement: "18",
      monthlyContributionTry: "5000",
      balanceTry: "0",
      contractType: "oks",
      riskAnswers: answers(3),
      questionIndex: 2,
      holdings: [],
      inflationPercent: "24",
      result: null,
    };
    expect(parseStoredSession(serializeStoredSession(session))?.companyCode).toBe("AHS");
    expect(fingerprint).toContain("AHS");
    expect(parseStoredSession("not-json")).toBeNull();
    expect(parseStoredSession(JSON.stringify({ version: 2 }))).toBeNull();
  });
});
