import { describe, expect, it } from "vitest";
import { calculateRiskProfile, RISK_MODEL, RISK_QUESTIONS } from "./risk-profile";
import type { RiskAnswer } from "./types";

function answers(overrides: Record<string, number> = {}): RiskAnswer[] {
  const base: Record<string, number> = {
    horizon: 3,
    loss_tolerance: 3,
    experience: 3,
    income_stability: 4,
    goal: 1,
    volatility_comfort: 1,
  };
  return Object.entries({ ...base, ...overrides }).map(([questionId, value]) => ({
    questionId,
    value,
  }));
}

describe("risk profile", () => {
  it("does not invent a medium score when answers are missing", () => {
    expect(calculateRiskProfile([])).toBeNull();
    expect(calculateRiskProfile(answers().filter((answer) => answer.questionId !== "goal"))).toBeNull();
  });

  it("scores only horizon and loss tolerance", () => {
    const weights = Object.values(RISK_MODEL.drivers);
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBe(1);
    expect(RISK_MODEL.recordedButNotScored).toEqual(["goal", "volatility_comfort"]);

    const calm = calculateRiskProfile(answers({ goal: 1, volatility_comfort: 1 }));
    const eager = calculateRiskProfile(answers({ goal: 5, volatility_comfort: 5 }));
    expect(calm?.score).toBe(50);
    expect(eager?.score).toBe(calm?.score);
  });

  it("lets a long horizon and high loss tolerance reach the high band", () => {
    const risk = calculateRiskProfile(
      answers({ horizon: 5, loss_tolerance: 5, experience: 5, income_stability: 5 })
    );
    expect(risk).toMatchObject({ score: 100, level: "yuksek" });
  });

  it("does not let experience raise a low score", () => {
    const risk = calculateRiskProfile(
      answers({ horizon: 1, loss_tolerance: 1, experience: 5, income_stability: 5 })
    );
    expect(risk).toMatchObject({ score: 0, level: "dusuk" });
  });

  it("blocks the high band when experience is only deposits or none", () => {
    const blocked = calculateRiskProfile(
      answers({ horizon: 5, loss_tolerance: 5, experience: 1, income_stability: 5 })
    );
    const allowed = calculateRiskProfile(
      answers({ horizon: 5, loss_tolerance: 5, experience: 3, income_stability: 5 })
    );
    expect(blocked).toMatchObject({ score: 66, level: "orta" });
    expect(allowed).toMatchObject({ score: 100, level: "yuksek" });
  });

  it("caps the score when income is unstable", () => {
    const risk = calculateRiskProfile(
      answers({ horizon: 5, loss_tolerance: 5, experience: 5, income_stability: 1 })
    );
    expect(risk).toMatchObject({ score: 33, level: "dusuk" });
    expect(RISK_QUESTIONS).toHaveLength(6);
  });
});
