import { NextResponse } from "next/server";
import { fetchMarketData } from "@/lib/macro-data";
import { buildMacroAnalysis } from "@/lib/macro-analysis";
import { generateRecommendation } from "@/lib/portfolio-engine";
import { marketExamples, rankCompanyMenu, scoreMenu, validatePlanRequest } from "@/lib/fund-menu";
import { validatePlanInputs } from "@/lib/person-profile";
import { classifySnapshot, loadFundSnapshot, snapshotProblem } from "@/lib/fund-snapshot";
import type { PortfolioHolding, RiskLevel } from "@/lib/types";

interface RecommendBody {
  riskAnswers: unknown;
  katilim: boolean;
  holdings: PortfolioHolding[];
  isNewAccount: boolean;
  companyCode: string;
  yearsToRetirement: unknown;
  monthlyContributionTry: unknown;
  balanceTry: unknown;
  contractType: unknown;
}

function parseRecommendBody(
  body: unknown
): { ok: true; value: RecommendBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "İstek gövdesi okunamadı." };
  }
  const raw = body as Record<string, unknown>;
  if (typeof raw.katilim !== "boolean") {
    return { ok: false, error: "Fon tercihi seçilmedi." };
  }
  if (typeof raw.isNewAccount !== "boolean") {
    return { ok: false, error: "Hesap durumu seçilmedi." };
  }
  if (typeof raw.companyCode !== "string") {
    return { ok: false, error: "Emeklilik şirketi seçilmedi." };
  }
  if (!Array.isArray(raw.holdings)) {
    return { ok: false, error: "Mevcut portföy listesi okunamadı." };
  }

  const holdings: PortfolioHolding[] = [];
  for (const item of raw.holdings) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Mevcut portföy satırı okunamadı." };
    }
    const row = item as { fundId?: unknown; percentage?: unknown };
    if (typeof row.fundId !== "string" || row.fundId.trim() === "") {
      return { ok: false, error: "Fon kodu okunamadı." };
    }
    if (
      typeof row.percentage !== "number" ||
      !Number.isFinite(row.percentage) ||
      row.percentage < 0 ||
      row.percentage > 100
    ) {
      return { ok: false, error: "Fon yüzdesi 0 ile 100 arasında olmalıdır." };
    }
    holdings.push({ fundId: row.fundId, percentage: row.percentage });
  }

  return {
    ok: true,
    value: {
      riskAnswers: raw.riskAnswers,
      katilim: raw.katilim,
      holdings,
      isNewAccount: raw.isNewAccount,
      companyCode: raw.companyCode,
      yearsToRetirement: raw.yearsToRetirement,
      monthlyContributionTry: raw.monthlyContributionTry,
      balanceTry: raw.balanceTry,
      contractType: raw.contractType,
    },
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "İstek gövdesi okunamadı." }, { status: 400 });
  }

  const parsed = parseRecommendBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  try {
    const snapshot = loadFundSnapshot();
    const problem = snapshotProblem(snapshot);
    if (problem || !snapshot) {
      return NextResponse.json({ success: false, error: problem }, { status: 503 });
    }

    const {
      riskAnswers,
      katilim,
      holdings,
      isNewAccount,
      companyCode,
      yearsToRetirement,
      monthlyContributionTry,
      balanceTry,
      contractType,
    } = parsed.value;

    const personCheck = validatePlanInputs({
      yearsToRetirement,
      monthlyContributionTry,
      balanceTry,
      contractType,
      riskAnswers,
    });
    if (!personCheck.ok) {
      return NextResponse.json({ success: false, error: personCheck.error }, { status: 400 });
    }

    const funds = classifySnapshot(snapshot);
    const check = validatePlanRequest({
      companyCode,
      katilim,
      isNewAccount,
      holdings,
      funds,
    });
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: check.status });
    }

    const risk = personCheck.risk;
    const marketData = await fetchMarketData();
    const macro = buildMacroAnalysis(marketData);
    const menu = scoreMenu(check.menu, personCheck.profile.yearsToRetirement);
    const companyName = menu[0]?.company ?? companyCode;

    const recommendation = generateRecommendation({
      riskLevel: risk.level as RiskLevel,
      riskScore: risk.score,
      yearsToRetirement: personCheck.profile.yearsToRetirement,
      katilim,
      holdings: check.holdings,
      macro,
      isNewAccount,
      menu,
      directory: funds,
      companyCode: companyCode.trim().toUpperCase(),
      companyName,
    });

    return NextResponse.json({
      success: true,
      risk,
      person: personCheck.profile,
      recommendation: {
        ...recommendation,
        categoryRankings: rankCompanyMenu(menu, snapshot.fetchedAt, snapshot.source),
        marketExamples: marketExamples(
          funds,
          katilim,
          personCheck.profile.yearsToRetirement,
          recommendation.targetAllocation.map((item) => item.category)
        ),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
