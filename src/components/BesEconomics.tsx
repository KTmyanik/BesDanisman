"use client";

import { INFLATION_ASSUMPTION } from "@/lib/bes-parameters";
import { citeFigure, figureLine, formatDataDate } from "@/lib/plan-contract";
import { parseInflationPercent, projectAccumulation } from "@/lib/projection";
import type { PersonProfile, PortfolioRecommendation } from "@/lib/types";

function formatTry(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(rate: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(rate);
}

export function BesEconomics({
  person,
  recommendation,
  inflationPercent,
  onInflationPercent,
}: {
  person: PersonProfile;
  recommendation: PortfolioRecommendation;
  inflationPercent: string;
  onInflationPercent: (value: string) => void;
}) {
  const parsedInflation = parseInflationPercent(inflationPercent);
  const scenario = projectAccumulation({
    monthlyContributionTry: person.monthlyContributionTry,
    balanceTry: person.balanceTry,
    yearsToRetirement: person.yearsToRetirement,
    contractType: person.contractType,
      funds: recommendation.targetAllocation.map((item) => ({
      percentage: item.percentage,
      annualFeePercent: item.annualFeePercent ?? null,
    })),
    inflationPercent: parsedInflation ?? INFLATION_ASSUMPTION.value,
  });
  const contributionLine = figureLine(
    citeFigure(
      `Yıllık devlet katkısı ${formatTry(scenario.stateContributionTry)}`,
      scenario.source.replace(/\.+$/, ""),
      `${scenario.parameterEffectiveFrom}T00:00:00+03:00`
    )
  );

  return (
    <div className="card">
      <h3 className="text-lg font-semibold">BES ekonomisi</h3>
      <p className="mt-2 text-sm text-slate-600">
        Birikim, girdiğiniz katkıya ve kayıtlı devlet katkısına göre kurulur. Fon getirisi içermez.
      </p>

      <dl className="mt-4 space-y-2 text-sm text-slate-800">
        <div className="flex justify-between gap-4">
          <dt>Yıllık katkı</dt>
          <dd className="font-medium">{formatTry(scenario.annualContributionTry)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Devlet katkısı (%{Math.round(scenario.rate * 100)})</dt>
          <dd className="font-medium">{formatTry(scenario.stateContributionTry)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Tavanı aşan katkı</dt>
          <dd className="font-medium">{formatTry(scenario.carryoverContributionTry)}</dd>
        </div>
        {scenario.oksWelcomeTry !== null && (
          <div className="flex justify-between gap-4">
            <dt>OKS bir defalık katkı</dt>
            <dd className="font-medium">{formatTry(scenario.oksWelcomeTry)}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs text-slate-500">{contributionLine}</p>
      {scenario.limitsAreSeparate && (
        <p className="mt-1 text-xs text-slate-500">
          OKS ve gönüllü BES için yıllık tavan ayrı ayrı uygulanır. Yıllık formül aynıdır.
        </p>
      )}
      {scenario.oksWelcomeTry !== null && (
        <p className="mt-1 text-xs text-slate-500">
          Bir defalık tutar yıllık limite dahil değildir. Kaynak: parametre kaydı.
        </p>
      )}

      <h4 className="mt-5 font-semibold text-slate-900">Hak ediş</h4>
      <p className="mt-1 text-xs text-slate-500">
        Tutar, aynı aylık katkı sürerse o yılda biriken devlet katkısına kayıtlı oranın uygulanmasıdır.
        Yürürlük: {formatDataDate(`${scenario.parameterEffectiveFrom}T00:00:00+03:00`)}.
      </p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1 font-medium">Dilim</th>
            <th className="py-1 font-medium">Oran</th>
            <th className="py-1 text-right font-medium">Hak edilen</th>
          </tr>
        </thead>
        <tbody>
          {scenario.vesting.map((row) => (
            <tr key={row.label} className="border-t border-slate-100">
              <td className="py-2">{row.label}</td>
              <td className="py-2">{formatPercent(row.ratio)}</td>
              <td className="py-2 text-right font-medium">{formatTry(row.vestedTry)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-sm text-slate-800">
        {scenario.annualFeeRate === null
          ? "Kesinti: bilinmiyor. Birikim, kesinti düşülmeden kuruldu."
          : `Yıllık kesinti: ${formatPercent(scenario.annualFeeRate)}. Seçilen fonların ücret ağırlığı her yıl birikimden düşülür.`}
      </p>

      <label className="mt-5 block">
        <span className="font-semibold text-slate-900">Enflasyon varsayımı (%)</span>
        <input
          inputMode="decimal"
          value={inflationPercent}
          onChange={(event) => onInflationPercent(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        />
        <span className="mt-1 block text-xs text-slate-500">
          {INFLATION_ASSUMPTION.source} Kayıt tarihi: {formatDataDate(`${INFLATION_ASSUMPTION.effectiveFrom}T00:00:00+03:00`)}.
        </span>
      </label>

      {parsedInflation === null ? (
        <p className="mt-3 text-sm text-amber-800">Enflasyon varsayımı 0 ile 100 arasında olmalıdır.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Nominal birikim</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatTry(scenario.nominalTry)}</p>
            <p className="mt-1 text-xs text-slate-500">
              Varsayım, {scenario.years} yıl: katkı ve kesinti. Devlet katkısı ve fon getirisi yok.
              {scenario.annualFeeRate === null ? " Kesinti bilinmiyor, tutara yansıtılmadı." : ""}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Devlet katkısı dahil</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatTry(scenario.withStateTry)}</p>
            <p className="mt-1 text-xs text-slate-500">
              Varsayım, {scenario.years} yıl: nominal tutara kayıtlı devlet katkısı eklenir. Fon getirisi yok.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Reel birikim</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatTry(scenario.realTry)}</p>
            <p className="mt-1 text-xs text-slate-500">
              Varsayım, {scenario.years} yıl: devlet katkısı dahil tutarın %{parsedInflation} enflasyonla bugünkü satın alma gücü.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
