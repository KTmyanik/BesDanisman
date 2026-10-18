"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StepIndicator } from "@/components/StepIndicator";
import { RiskQuestionnaire } from "@/components/RiskQuestionnaire";
import { PortfolioInput } from "@/components/PortfolioInput";
import { PersonProfile } from "@/components/PersonProfile";
import { RecommendationResult } from "@/components/RecommendationResult";
import { INFLATION_ASSUMPTION } from "@/lib/bes-parameters";
import { horizonAnswerFromYears, parsePersonProfile, parseYears } from "@/lib/person-profile";
import {
  PROFILE_STORAGE_KEY,
  parseStoredSession,
  serializeStoredSession,
  sessionFingerprint,
  type StoredSession,
} from "@/lib/profile-storage";
import type {
  ContractType,
  PersonProfile as PersonProfileData,
  PortfolioHolding,
  PortfolioRecommendation,
  RiskAnswer,
} from "@/lib/types";
import { Loader2, PiggyBank, BarChart3, Shield } from "lucide-react";

const EMPTY_SESSION = {
  step: 1,
  hasPortfolio: null as boolean | null,
  katilim: null as boolean | null,
  companyCode: "",
  yearsToRetirement: "",
  monthlyContributionTry: "",
  balanceTry: "",
  contractType: "" as "" | ContractType,
  riskAnswers: [] as RiskAnswer[],
  questionIndex: 0,
  holdings: [] as PortfolioHolding[],
  inflationPercent: String(INFLATION_ASSUMPTION.value),
};

export default function HomePage() {
  const [step, setStep] = useState(1);
  const [hasPortfolio, setHasPortfolio] = useState<boolean | null>(null);
  const [katilim, setKatilim] = useState<boolean | null>(null);
  const [riskAnswers, setRiskAnswers] = useState<RiskAnswer[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [companyCode, setCompanyCode] = useState("");
  const [yearsToRetirement, setYearsToRetirement] = useState("");
  const [monthlyContributionTry, setMonthlyContributionTry] = useState("");
  const [balanceTry, setBalanceTry] = useState("");
  const [contractType, setContractType] = useState<"" | ContractType>("");
  const [inflationPercent, setInflationPercent] = useState(String(INFLATION_ASSUMPTION.value));
  const [hydrated, setHydrated] = useState(false);
  const resultFingerprint = useRef<string | null>(null);
  const [catalog, setCatalog] = useState<{
    funds: {
      code: string;
      shortName: string;
      companyCode: string;
      company: string;
      katilim: boolean;
    }[];
  } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    recommendation: PortfolioRecommendation;
    riskLabel: string;
    person: PersonProfileData;
  } | null>(null);

  const handleRiskAnswer = (questionId: string, value: number) => {
    if (questionId === "horizon") return;
    setRiskAnswers((prev) => {
      const filtered = prev.filter((a) => a.questionId !== questionId);
      return [...filtered, { questionId, value }];
    });
  };

  const handleYears = (value: string) => {
    setYearsToRetirement(value);
    const years = parseYears(value);
    setRiskAnswers((prev) => {
      const rest = prev.filter((answer) => answer.questionId !== "horizon");
      if (years === null) return rest;
      return [...rest, { questionId: "horizon", value: horizonAnswerFromYears(years) }];
    });
  };

  const fingerprint = useMemo(
    () =>
      sessionFingerprint({
        hasPortfolio,
        katilim,
        companyCode,
        yearsToRetirement,
        monthlyContributionTry,
        balanceTry,
        contractType,
        riskAnswers,
        holdings,
      }),
    [
      hasPortfolio,
      katilim,
      companyCode,
      yearsToRetirement,
      monthlyContributionTry,
      balanceTry,
      contractType,
      riskAnswers,
      holdings,
    ]
  );

  const fetchRecommendation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskAnswers,
          katilim,
          companyCode,
          holdings: hasPortfolio ? holdings : [],
          isNewAccount: !hasPortfolio,
          yearsToRetirement,
          monthlyContributionTry,
          balanceTry,
          contractType,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      resultFingerprint.current = fingerprint;
      setResult({
        recommendation: json.recommendation,
        riskLabel: json.risk.label,
        person: json.person,
      });
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const portfolioTotal = holdings.reduce((s, h) => s + h.percentage, 0);
  const portfolioValid = Math.abs(portfolioTotal - 100) < 0.1;

  useEffect(() => {
    const stored = parseStoredSession(localStorage.getItem(PROFILE_STORAGE_KEY));
    if (stored) {
      setStep(stored.step);
      setHasPortfolio(stored.hasPortfolio);
      setKatilim(stored.katilim);
      setCompanyCode(stored.companyCode);
      setYearsToRetirement(stored.yearsToRetirement);
      setMonthlyContributionTry(stored.monthlyContributionTry);
      setBalanceTry(stored.balanceTry);
      setContractType(stored.contractType);
      setRiskAnswers(stored.riskAnswers);
      setQuestionIndex(stored.questionIndex);
      setHoldings(stored.holdings);
      if (stored.inflationPercent) setInflationPercent(stored.inflationPercent);
      if (stored.result?.person && stored.result.fingerprint) {
        resultFingerprint.current = stored.result.fingerprint;
        setResult({
          recommendation: stored.result.recommendation,
          riskLabel: stored.result.riskLabel,
          person: stored.result.person,
        });
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !result) return;
    if (resultFingerprint.current !== fingerprint) {
      resultFingerprint.current = null;
      setResult(null);
    }
  }, [fingerprint, hydrated, result]);

  useEffect(() => {
    if (!hydrated) return;
    const session: StoredSession = {
      version: 1,
      step,
      hasPortfolio,
      katilim,
      companyCode,
      yearsToRetirement,
      monthlyContributionTry,
      balanceTry,
      contractType,
      riskAnswers,
      questionIndex,
      holdings,
      inflationPercent,
      result:
        result && resultFingerprint.current === fingerprint
          ? { ...result, fingerprint }
          : null,
    };
    localStorage.setItem(PROFILE_STORAGE_KEY, serializeStoredSession(session));
  }, [
    hydrated,
    step,
    hasPortfolio,
    katilim,
    companyCode,
    yearsToRetirement,
    monthlyContributionTry,
    balanceTry,
    contractType,
    riskAnswers,
    questionIndex,
    holdings,
    inflationPercent,
    result,
    fingerprint,
  ]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/funds")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) {
          setCatalogError(json.error ?? "Fon evreni alınamadı");
          return;
        }
        setCatalog({ funds: json.funds });
      })
      .catch(() => {
        if (!cancelled) setCatalogError("Fon evreni alınamadı");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const menuFunds = useMemo(() => {
    if (!catalog) return [];
    return catalog.funds
      .filter((fund) => fund.companyCode === companyCode && fund.katilim === katilim)
      .sort((a, b) => a.code.localeCompare(b.code, "tr"));
  }, [catalog, companyCode, katilim]);

  const holdingFunds = useMemo(() => {
    if (!catalog || katilim === null) return [];
    return catalog.funds
      .filter((fund) => fund.katilim === katilim)
      .sort(
        (a, b) =>
          a.company.localeCompare(b.company, "tr") || a.code.localeCompare(b.code, "tr")
      );
  }, [catalog, katilim]);

  const companies = useMemo(() => {
    if (!catalog) return [];
    const grouped = new Map<string, { code: string; name: string; count: number }>();
    for (const fund of catalog.funds) {
      if (fund.katilim !== katilim) continue;
      const current = grouped.get(fund.companyCode) ?? {
        code: fund.companyCode,
        name: fund.company,
        count: 0,
      };
      current.count += 1;
      grouped.set(fund.companyCode, current);
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [catalog, katilim]);

  const person = parsePersonProfile({
    yearsToRetirement,
    monthlyContributionTry,
    balanceTry,
    contractType,
  });
  const canLeaveStart =
    hasPortfolio !== null && katilim !== null && Boolean(companyCode) && person.ok && !catalogError;

  useEffect(() => {
    if (!catalog) return;
    if (!companyCode || hasPortfolio !== true) {
      if (!companyCode || hasPortfolio === false) setHoldings([]);
      return;
    }
    if (!companies.some((company) => company.code === companyCode)) {
      setCompanyCode("");
      setHoldings([]);
      return;
    }
    setHoldings((current) => {
      const kept = current.filter((holding) =>
        holdingFunds.some((fund) => fund.code === holding.fundId)
      );
      if (kept.length > 0) return kept;
      if (menuFunds[0]) return [{ fundId: menuFunds[0].code, percentage: 0 }];
      return [];
    });
  }, [catalog, companyCode, companies, hasPortfolio, holdingFunds, menuFunds]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <PiggyBank className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">BES Danışman</h1>
            <p className="text-sm text-slate-500">
              Tarihli plan senaryosu
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <StepIndicator currentStep={step} />

        {step === 1 && (
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="card text-center">
              <h2 className="text-2xl font-bold text-slate-900">
                Kişisel BES plan senaryosu
              </h2>
              <p className="mt-3 text-slate-600">
                Girdiğiniz bilgilere ve tarihli piyasa verisine göre bir dağılım
                senaryosu kurulur. Bu çıktı getiri vaadi değildir.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: BarChart3,
                  title: "Makro Analiz",
                  desc: "TCMB kurları & global piyasa verileri",
                },
                {
                  icon: Shield,
                  title: "Risk Profili",
                  desc: "6 soruluk anket ile kişisel profil",
                },
                {
                  icon: PiggyBank,
                  title: "Plan senaryosu",
                  desc: "Tarihli dağılım ve yazılı sınırlar",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="card text-center">
                  <Icon className="mx-auto h-8 w-8 text-brand-600" />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{desc}</p>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 className="font-semibold text-slate-900">
                Mevcut BES hesabınız var mı?
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setHasPortfolio(true)}
                  className={`rounded-xl border p-4 text-left transition ${
                    hasPortfolio === true
                      ? "border-brand-600 bg-brand-50 ring-2 ring-brand-200"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold">Evet, portföyüm var</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Mevcut dağılımımı senaryoyla karşılaştır
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setHasPortfolio(false)}
                  className={`rounded-xl border p-4 text-left transition ${
                    hasPortfolio === false
                      ? "border-brand-600 bg-brand-50 ring-2 ring-brand-200"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold">Hayır, yeni hesap açacağım</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Başlangıç dağılımı için senaryo kur
                  </p>
                </button>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold text-slate-900">Fon tercihi</h3>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setKatilim(false)}
                    className={`flex-1 rounded-xl border p-3 text-sm font-medium transition ${
                      katilim === false
                        ? "border-brand-600 bg-brand-50 text-brand-800"
                        : "border-slate-200"
                    }`}
                  >
                    Standart Fonlar
                  </button>
                  <button
                    type="button"
                    onClick={() => setKatilim(true)}
                    className={`flex-1 rounded-xl border p-3 text-sm font-medium transition ${
                      katilim
                        ? "border-brand-600 bg-brand-50 text-brand-800"
                        : "border-slate-200"
                    }`}
                  >
                    Katılım Fonları
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold text-slate-900">Emeklilik şirketi</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Hedef fonlar yalnızca bu şirketin menüsünden seçilir.
                </p>
                <select
                  value={companyCode}
                  onChange={(event) => setCompanyCode(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="">Şirket seçin</option>
                  {companies.map((company) => (
                    <option key={company.code} value={company.code}>
                      {company.name} ({company.count} fon)
                    </option>
                  ))}
                </select>
                {catalogError && (
                  <p className="mt-2 text-sm text-red-700">{catalogError}</p>
                )}
              </div>

              <PersonProfile
                yearsToRetirement={yearsToRetirement}
                monthlyContributionTry={monthlyContributionTry}
                balanceTry={balanceTry}
                contractType={contractType}
                onYears={handleYears}
                onMonthly={setMonthlyContributionTry}
                onBalance={setBalanceTry}
                onContractType={setContractType}
              />

              {hasPortfolio !== null && katilim !== null && companyCode && !person.ok && (
                <p className="mt-4 text-sm text-slate-600">{person.error}</p>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  disabled={!canLeaveStart}
                  onClick={() => setStep(2)}
                  className="btn-primary"
                >
                  Devam Et
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <RiskQuestionnaire
            answers={riskAnswers}
            onAnswer={handleRiskAnswer}
            currentQuestionIndex={questionIndex}
            readOnlyQuestionIds={["horizon"]}
            onNext={() => {
              if (questionIndex < 5) {
                setQuestionIndex((i) => i + 1);
              } else {
                setQuestionIndex(0);
                setStep(hasPortfolio ? 3 : 4);
                if (!hasPortfolio) fetchRecommendation();
              }
            }}
            onPrev={() => {
              if (questionIndex > 0) {
                setQuestionIndex((i) => i - 1);
              } else {
                setStep(1);
              }
            }}
          />
        )}

        {step === 3 && hasPortfolio && (
          <div className="space-y-6">
            <PortfolioInput
              funds={holdingFunds}
              holdings={holdings}
              onChange={setHoldings}
            />
            <div className="mx-auto flex max-w-2xl justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-secondary"
              >
                Geri
              </button>
              <button
                type="button"
                disabled={!portfolioValid || loading}
                onClick={fetchRecommendation}
                className="btn-primary flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Analiz Et
              </button>
            </div>
          </div>
        )}

        {step === 4 && loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
            <p className="mt-4 text-slate-600">
              Piyasa verileri alınıyor...
            </p>
          </div>
        )}

        {step === 4 && !loading && result && (
          <RecommendationResult
            recommendation={result.recommendation}
            riskLabel={result.riskLabel}
            person={result.person}
            inflationPercent={inflationPercent}
            onInflationPercent={setInflationPercent}
          />
        )}

        {error && (
          <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 4 && !loading && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => {
                resultFingerprint.current = null;
                setStep(EMPTY_SESSION.step);
                setHasPortfolio(EMPTY_SESSION.hasPortfolio);
                setKatilim(EMPTY_SESSION.katilim);
                setCompanyCode(EMPTY_SESSION.companyCode);
                setYearsToRetirement(EMPTY_SESSION.yearsToRetirement);
                setMonthlyContributionTry(EMPTY_SESSION.monthlyContributionTry);
                setBalanceTry(EMPTY_SESSION.balanceTry);
                setContractType(EMPTY_SESSION.contractType);
                setRiskAnswers(EMPTY_SESSION.riskAnswers);
                setQuestionIndex(EMPTY_SESSION.questionIndex);
                setHoldings(EMPTY_SESSION.holdings);
                setInflationPercent(EMPTY_SESSION.inflationPercent);
                setResult(null);
                setError(null);
              }}
              className="btn-secondary"
            >
              Baştan Başla
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
