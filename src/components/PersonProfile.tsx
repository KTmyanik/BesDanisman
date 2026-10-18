"use client";

import { horizonAnswerFromYears, horizonLabel, parseYears } from "@/lib/person-profile";
import type { ContractType } from "@/lib/types";

interface Props {
  yearsToRetirement: string;
  monthlyContributionTry: string;
  balanceTry: string;
  contractType: "" | ContractType;
  onYears: (value: string) => void;
  onMonthly: (value: string) => void;
  onBalance: (value: string) => void;
  onContractType: (value: ContractType) => void;
}

export function PersonProfile({
  yearsToRetirement,
  monthlyContributionTry,
  balanceTry,
  contractType,
  onYears,
  onMonthly,
  onBalance,
  onContractType,
}: Props) {
  const years = parseYears(yearsToRetirement);
  const horizon = years === null ? null : horizonLabel(horizonAnswerFromYears(years));

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">Sözleşme türü</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onContractType("gonullu")}
            className={`rounded-xl border p-3 text-left text-sm font-medium transition ${
              contractType === "gonullu"
                ? "border-brand-600 bg-brand-50 text-brand-800"
                : "border-slate-200"
            }`}
          >
            Gönüllü BES
          </button>
          <button
            type="button"
            onClick={() => onContractType("oks")}
            className={`rounded-xl border p-3 text-left text-sm font-medium transition ${
              contractType === "oks"
                ? "border-brand-600 bg-brand-50 text-brand-800"
                : "border-slate-200"
            }`}
          >
            OKS
          </button>
        </div>
      </div>

      <label className="block">
        <span className="font-semibold text-slate-900">Emekliliğe kalan yıl</span>
        <input
          inputMode="numeric"
          value={yearsToRetirement}
          onChange={(event) => onYears(event.target.value)}
          placeholder="Örnek: 18"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        />
        {horizon && (
          <span className="mt-1 block text-sm text-slate-500">Anketteki ufuk cevabı: {horizon}</span>
        )}
      </label>

      <label className="block">
        <span className="font-semibold text-slate-900">Aylık katkı (TL)</span>
        <input
          inputMode="decimal"
          value={monthlyContributionTry}
          onChange={(event) => onMonthly(event.target.value)}
          placeholder="Örnek: 5000"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block">
        <span className="font-semibold text-slate-900">Mevcut birikim (TL)</span>
        <input
          inputMode="decimal"
          value={balanceTry}
          onChange={(event) => onBalance(event.target.value)}
          placeholder="Yoksa 0"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        />
        <span className="mt-1 block text-sm text-slate-500">Tutarı noktalama kullanmadan yazın.</span>
      </label>
    </div>
  );
}
