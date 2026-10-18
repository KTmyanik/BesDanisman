"use client";

import type { MacroAnalysis, MacroIndicator } from "@/lib/types";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

function formatAsOf(asOf: string | null): string {
  if (!asOf) return "yok";
  if (/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    const [year, month, day] = asOf.split("-").map(Number);
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) return "yok";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(date);
}

function IndicatorCard({ indicator }: { indicator: MacroIndicator }) {
  const Icon =
    indicator.sentiment === "positive"
      ? TrendingUp
      : indicator.sentiment === "negative"
        ? TrendingDown
        : Minus;

  const colorClass =
    indicator.sentiment === "positive"
      ? "text-emerald-600 bg-emerald-50"
      : indicator.sentiment === "negative"
        ? "text-red-600 bg-red-50"
        : "text-slate-600 bg-slate-50";

  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{indicator.name}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {indicator.value === null
              ? "—"
              : indicator.value.toLocaleString("tr-TR", {
                  maximumFractionDigits: 2,
                })}
            {indicator.value !== null && (
              <span className="ml-1 text-sm font-normal text-slate-500">
                {indicator.unit}
              </span>
            )}
          </p>
        </div>
        <div className={`rounded-lg p-2 ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {indicator.changePercent !== null && (
        <p
          className={`mt-2 text-sm font-medium ${
            indicator.changePercent >= 0 ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {indicator.changePercent >= 0 ? "+" : ""}
          {indicator.changePercent.toFixed(2)}%
        </p>
      )}
      <p className="mt-2 text-xs text-slate-400">Veri tarihi: {formatAsOf(indicator.asOf)}</p>
      <p className="mt-2 text-xs text-slate-500">{indicator.description}</p>
    </div>
  );
}

export function MacroDashboard({ macro }: { macro: MacroAnalysis }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
        <strong>Özet:</strong> {macro.summary}
      </div>
      {macro.missing.length > 0 && (
        <p className="text-sm text-amber-800">
          Eksik göstergeler: {macro.missing.join(", ")}. Bu göstergelere bağlı
          kurallar uygulanmadı.
        </p>
      )}

      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-800">
          🇹🇷 Türkiye
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {macro.turkey.map((ind) => (
            <IndicatorCard key={ind.name} indicator={ind} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-800">
          🌍 Dünya
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {macro.global.map((ind) => (
            <IndicatorCard key={ind.name} indicator={ind} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <h4 className="font-semibold text-blue-800">Öngörüler</h4>
          <ul className="mt-2 space-y-1 text-sm text-blue-700">
            {macro.outlook.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <h4 className="font-semibold text-red-800">Riskler</h4>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {macro.risks.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <h4 className="font-semibold text-emerald-800">Fırsatlar</h4>
          <ul className="mt-2 space-y-1 text-sm text-emerald-700">
            {macro.opportunities.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Veri zamanı:{" "}
        {new Date(macro.fetchedAt).toLocaleString("tr-TR")}
      </p>
    </div>
  );
}
