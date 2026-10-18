import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PLAN_CONTRACT,
  allocationFigure,
  citeFigure,
  figureLine,
  scenarioStatement,
} from "./plan-contract";

describe("plan contract", () => {
  it("states the output is a dated scenario", () => {
    const text = PLAN_CONTRACT.map((clause) => clause.text).join(" ");
    expect(text).toContain("getiri vaadi değildir");
    expect(text).toContain("kaynak");
    expect(text).toContain("veri tarihi");
    expect(PLAN_CONTRACT.map((clause) => clause.id)).toEqual([
      "scenario",
      "citation",
      "parameters",
      "menu",
      "verify",
    ]);
  });

  it("builds the result sentence from the data timestamp", () => {
    const sentence = scenarioStatement("2026-10-18T18:00:00.000Z");
    expect(sentence).toContain("Bu senaryo, girdiğiniz bilgilere ve ");
    expect(sentence).toContain("18 Ekim 2026");
    expect(sentence).toContain("tarihli veriye göre üretildi.");
  });

  it("rejects a figure without source or date", () => {
    expect(() => citeFigure("Yüzde", "", "2026-10-18")).toThrow(/kaynak ve veri tarihi/);
    expect(() => citeFigure("Yüzde", "Plan kuralları", "")).toThrow(/kaynak ve veri tarihi/);
    expect(() => citeFigure("Yüzde", "Plan kuralları", "yarın")).toThrow(/okunamadı/);
  });

  it("cites allocation percentages with the market timestamp", () => {
    const figure = allocationFigure("2026-10-18T18:00:00.000Z");
    const line = figureLine(figure);
    expect(line).toContain("Kategori dağılım yüzdeleri");
    expect(line).toContain("Kaynak: Girdiğiniz risk cevapları ve plan kuralları");
    expect(line).toContain("18 Ekim 2026");
  });

  it("is the disclaimer rendered on the result screen", () => {
    const screen = readFileSync(
      new URL("../components/RecommendationResult.tsx", import.meta.url),
      "utf8"
    );
    expect(screen).toContain("PLAN_CONTRACT");
    expect(screen).toContain("scenarioStatement");
    expect(screen).not.toContain("yatırım tavsiyesi değildir");
  });
});
