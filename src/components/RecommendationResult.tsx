"use client";

import type { PersonProfile, PortfolioRecommendation, ScoredFundPick } from "@/lib/types";
import { contractTypeLabel } from "@/lib/person-profile";
import { getAllocationBreakdown } from "@/lib/portfolio-engine";
import { getCategoryLabel } from "@/lib/bes-funds";
import { SCORE_WEIGHTS } from "@/lib/fund-score";
import { getCategoryColor } from "@/lib/category-colors";
import type { FundCategory } from "@/lib/types";
import {
  PLAN_CONTRACT,
  allocationFigure,
  citeFigure,
  figureLine,
  scenarioStatement,
} from "@/lib/plan-contract";
import { ArrowDown, ArrowUp, Plus, Minus, AlertTriangle, Trophy } from "lucide-react";
import { BesEconomics } from "./BesEconomics";
import { MacroDashboard } from "./MacroDashboard";

const ACTION_CONFIG = {
  azalt: { icon: ArrowDown, color: "text-amber-700 bg-amber-50 border-amber-200", label: "Azalt" },
  artir: { icon: ArrowUp, color: "text-emerald-700 bg-emerald-50 border-emerald-200", label: "Artır" },
  ekle: { icon: Plus, color: "text-blue-700 bg-blue-50 border-blue-200", label: "Ekle" },
  cikar: { icon: Minus, color: "text-red-700 bg-red-50 border-red-200", label: "Çıkar" },
};

const RANK_STYLES: Record<number, string> = {
  1: "bg-amber-400 text-amber-950",
  2: "bg-slate-300 text-slate-800",
  3: "bg-amber-700/80 text-white",
};

function formatPercent(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `%${v.toFixed(1)}`;
}

function formatSize(v: number | null | undefined) {
  if (!v) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} milyar ₺`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)} milyon ₺`;
  return `${v.toLocaleString("tr-TR")} ₺`;
}

function AllocationBar({
  breakdown,
}: {
  breakdown: ReturnType<typeof getAllocationBreakdown>;
}) {
  return (
    <div className="mt-4 flex h-8 overflow-hidden rounded-full">
      {breakdown.map((b) => (
        <div
          key={b.categoryKey}
          style={{ width: `${b.percentage}%`, backgroundColor: b.color }}
          className="flex min-w-0 items-center justify-center"
          title={`${b.category}: %${b.percentage}`}
        >
          {b.percentage >= 5 && (
            <span className="truncate px-1 text-xs font-bold text-white drop-shadow-sm">
              %{b.percentage}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function RankedFundRow({ pick, color }: { pick: ScoredFundPick; color: string }) {
  const b = pick.scoreBreakdown;
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start gap-2">
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLES[pick.rank] ?? "bg-slate-200"}`}
        >
          {pick.rank}
        </span>
        <span
          className="inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {pick.code}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">{pick.shortName}</p>
          <p className="text-xs text-slate-500">{pick.company}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-brand-700">{pick.score.toFixed(1)} puan</p>
          <p className="text-xs text-slate-400">toplam skor</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
        <span>
          Getiri sırası: {b.getiriPuani ?? "—"} / {SCORE_WEIGHTS.returnRank}
        </span>
        <span>
          Tutarlılık: {b.tutarlilikPuani ?? "—"} / {SCORE_WEIGHTS.consistency}
        </span>
        <span>
          Ücret: {b.ucretPuani ?? "—"} / {SCORE_WEIGHTS.fee}
        </span>
        <span>
          Büyüklük puanı: {b.buyuklukPuani ?? "—"} / {SCORE_WEIGHTS.size}
        </span>
        <span>6 ay: {formatPercent(b.getiri6a)}</span>
        <span>1 yıl: {formatPercent(b.getiri1y)}</span>
        <span>3 yıl: {formatPercent(b.getiri3y)}</span>
        <span>Yönetim ücreti: {b.yillikUcret != null ? `%${b.yillikUcret}` : "—"}</span>
      </div>
    </li>
  );
}

function AllocationRow({
  fundId,
  name,
  category,
  percentage,
  picks,
}: {
  fundId: string;
  name: string;
  category: FundCategory;
  percentage: number;
  picks: ScoredFundPick[];
}) {
  const color = getCategoryColor(category);

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-semibold text-slate-800">
            {fundId} — {name}
          </span>
        </div>
        <span className="shrink-0 text-sm font-bold text-brand-700">%{percentage}</span>
      </div>

      {picks.length > 0 ? (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            Skora göre şirketinizin menüsündeki ilk 3 fon
          </div>
          <ul className="space-y-2">
            {picks.map((pick) => (
              <RankedFundRow key={pick.code} pick={pick} color={color} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
          Bu kategori için canlı skor verisi alınamadı. BEFAS üzerinden güncel fonları
          kontrol edin.
        </p>
      )}
    </div>
  );
}

function formatTry(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

export function RecommendationResult({
  recommendation,
  riskLabel,
  person,
  inflationPercent,
  onInflationPercent,
}: {
  recommendation: PortfolioRecommendation;
  riskLabel: string;
  person: PersonProfile;
  inflationPercent: string;
  onInflationPercent: (value: string) => void;
}) {
  const breakdown = getAllocationBreakdown(recommendation.targetAllocation);
  const rankings = recommendation.categoryRankings;
  const allocationLine = figureLine(allocationFigure(recommendation.macroContext.fetchedAt));
  const rankingLine = rankings
    ? figureLine(citeFigure("Fon skor sırası", rankings.source, rankings.fetchedAt))
    : null;

  const picksForCategory = (category: FundCategory): ScoredFundPick[] => {
    if (!rankings) return [];
    return rankings.categories[category] ?? [];
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="card border-brand-200 bg-gradient-to-br from-brand-50 to-white">
        <h2 className="text-2xl font-bold text-slate-900">Plan senaryonuz hazır</h2>
        <p className="mt-2 text-slate-600">
          {scenarioStatement(recommendation.macroContext.fetchedAt)}
        </p>
        <p className="mt-2 text-slate-600">{recommendation.summary}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-sm font-medium text-brand-800">
          Risk Profili: {riskLabel} ({recommendation.riskScore}/100)
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold">Girdiğiniz bilgiler</h3>
        <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <div>Sözleşme: {contractTypeLabel(person.contractType)}</div>
          <div>Emekliliğe kalan yıl: {person.yearsToRetirement}</div>
          <div>Aylık katkı: {formatTry(person.monthlyContributionTry)}</div>
          <div>Mevcut birikim: {formatTry(person.balanceTry)}</div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">Kaynak: girdiğiniz bilgiler.</p>
      </div>

      <BesEconomics
        person={person}
        recommendation={recommendation}
        inflationPercent={inflationPercent}
        onInflationPercent={onInflationPercent}
      />

      <div className="card">
        <h3 className="text-lg font-semibold">Hedef Fon Dağılımı</h3>
        {(recommendation.allocationNotes ?? []).map((note) => (
          <p key={note} className="mt-2 text-sm text-amber-800">
            {note}
          </p>
        ))}
        <AllocationBar breakdown={breakdown} />

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {breakdown.map((b) => (
            <div key={b.categoryKey} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
              {b.category} (%{b.percentage})
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-500">{allocationLine}</p>
        {rankingLine && (
          <p className="mt-1 text-xs text-slate-500">{rankingLine}</p>
        )}

        <div className="mt-5 space-y-3">
          {recommendation.targetAllocation.map((item) => (
            <AllocationRow
              key={item.fundId}
              fundId={item.fundId}
              name={item.name}
              category={item.category}
              percentage={item.percentage}
              picks={picksForCategory(item.category)}
            />
          ))}
          {recommendation.unfilled.length > 0 && (
            <p className="text-sm text-amber-800">
              Menüde fonu olmadığı için hedefe yazılmayan kategoriler:{" "}
              {recommendation.unfilled
                .map((item) => `${getCategoryLabel(item.category)} %${item.percentage}`)
                .join(", ")}
              .
            </p>
          )}
        </div>
      </div>

      {(recommendation.fundDeltas ?? []).length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold">Bugün, hedef ve fark</h3>
          <p className="mt-1 text-sm text-slate-500">Satırlar fon kodudur. Kategori yalnızca grup başlığıdır.</p>
          <div className="mt-4 space-y-4">
            {[...new Set((recommendation.fundDeltas ?? []).map((row) => row.category))].map((category) => (
              <div key={category ?? "unknown"}>
                <h4 className="text-sm font-semibold text-slate-800">
                  {category ? getCategoryLabel(category) : "Tür eşleşmedi"}
                </h4>
                <table className="mt-1 w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1 font-medium">Kod</th>
                      <th className="py-1 font-medium">Bugün</th>
                      <th className="py-1 font-medium">Hedef</th>
                      <th className="py-1 font-medium">Fark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recommendation.fundDeltas ?? [])
                      .filter((row) => row.category === category)
                      .map((row) => (
                        <tr key={row.fundId} className="border-t border-slate-100">
                          <td className="py-1 font-medium">{row.fundId}</td>
                          <td className="py-1">%{row.currentPercent}</td>
                          <td className="py-1">%{row.targetPercent}</td>
                          <td className="py-1">
                            {row.deltaPercent > 0 ? "+" : ""}
                            {row.deltaPercent}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {(recommendation.skippedRules ?? []).length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold">Uygulanmayan kurallar</h3>
          <ul className="mt-3 space-y-2">
            {recommendation.skippedRules.map((rule) => (
              <li key={rule.id} className="text-sm text-slate-700">
                {rule.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(recommendation.marketExamples ?? []).length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold">Piyasa geneli ilk 3</h3>
          <p className="mt-2 text-sm text-slate-600">
            Bu sıra hedef yüzdeye yazılmaz. Hedef fonlar {recommendation.companyName} menüsünde kalır.
          </p>
          <div className="mt-4 space-y-4">
            {[...new Set((recommendation.marketExamples ?? []).map((example) => example.category))].map(
              (category) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold text-slate-800">{getCategoryLabel(category)}</h4>
                  <ol className="mt-1 space-y-1 text-sm text-slate-700">
                    {(recommendation.marketExamples ?? [])
                      .filter((example) => example.category === category)
                      .map((example) => (
                        <li key={`${category}-${example.code}`}>
                          {example.rank}. {example.code} — {example.shortName}. {example.company}
                        </li>
                      ))}
                  </ol>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {recommendation.actions.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold">
            {recommendation.isNewAccount
              ? "Hedef dağılımın adımları"
              : "Dağılım farkları"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {!recommendation.isNewAccount &&
              "Mevcut dağılım ile hedef senaryo arasındaki farklar:"}
          </p>
          <div className="mt-4 space-y-3">
            {recommendation.actions.map((action) => {
              const config = ACTION_CONFIG[action.type];
              const Icon = config.icon;
              const color = getCategoryColor(action.category);

              return (
                <div key={action.fundId} className={`rounded-xl border p-4 ${config.color}`}>
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: color }}
                    />
                    <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">
                        {config.label}: {action.fundId} — {action.fundName}
                        <span className="ml-2 font-normal">
                          %{action.currentPercent} → %{action.targetPercent} (
                          {action.deltaPercent > 0 ? "+" : ""}
                          {action.deltaPercent} puan)
                        </span>
                      </p>
                      <p className="mt-1 text-sm opacity-90">{action.reason}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold">Gerekçeler</h3>
        <ul className="mt-3 space-y-2">
          {recommendation.rationale.map((r, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600">
              <span className="text-brand-600">•</span> {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3 className="mb-4 text-lg font-semibold">Makro Piyasa Analizi</h3>
        <MacroDashboard macro={recommendation.macroContext} />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">Bu senaryonun sınırları</p>
          <ul className="mt-2 space-y-1">
            {PLAN_CONTRACT.map((clause) => (
              <li key={clause.id}>{clause.text}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
