"use client";

import type { PortfolioHolding } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

export interface PortfolioFundOption {
  code: string;
  shortName: string;
  company: string;
}

interface Props {
  funds: PortfolioFundOption[];
  holdings: PortfolioHolding[];
  onChange: (holdings: PortfolioHolding[]) => void;
}

function groupedFunds(funds: PortfolioFundOption[]): [string, PortfolioFundOption[]][] {
  const groups = new Map<string, PortfolioFundOption[]>();
  for (const fund of funds) {
    const company = fund.company || "Diğer";
    const rows = groups.get(company) ?? [];
    rows.push(fund);
    groups.set(company, rows);
  }
  return [...groups.entries()];
}

export function PortfolioInput({ funds, holdings, onChange }: Props) {
  const total = holdings.reduce((sum, holding) => sum + holding.percentage, 0);

  const addRow = () => {
    const usedIds = new Set(holdings.map((holding) => holding.fundId));
    const nextFund = funds.find((fund) => !usedIds.has(fund.code));
    if (!nextFund) return;
    onChange([...holdings, { fundId: nextFund.code, percentage: 0 }]);
  };

  const removeRow = (index: number) => {
    onChange(holdings.filter((_, row) => row !== index));
  };

  const updateRow = (index: number, field: "fundId" | "percentage", value: string) => {
    const updated = [...holdings];
    if (field === "fundId") {
      updated[index] = { ...updated[index], fundId: value };
    } else {
      updated[index] = {
        ...updated[index],
        percentage: Math.max(0, Math.min(100, parseFloat(value) || 0)),
      };
    }
    onChange(updated);
  };

  return (
    <div className="card mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold text-slate-900">Mevcut BES Portföyünüz</h2>
      <p className="mt-2 text-sm text-slate-500">
        Başka şirketin fonu da seçilebilir. Hedef dağılım, seçtiğiniz şirketin menüsünde kalır. Toplam %100 olmalıdır.
      </p>

      <div className="mt-6 space-y-3">
        {holdings.map((holding, index) => (
          <div key={`${holding.fundId}-${index}`} className="flex items-center gap-3">
            <select
              value={holding.fundId}
              onChange={(event) => updateRow(index, "fundId", event.target.value)}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              {groupedFunds(funds).map(([company, companyFunds]) => (
                <optgroup key={company} label={company}>
                  {companyFunds.map((fund) => (
                    <option key={fund.code} value={fund.code}>
                      {fund.code} — {fund.shortName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="relative w-24">
              <input
                type="number"
                min={0}
                max={100}
                value={holding.percentage || ""}
                onChange={(event) => updateRow(index, "percentage", event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-8 text-sm"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                %
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        disabled={holdings.length >= funds.length}
        className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        <Plus className="h-4 w-4" /> Fon ekle
      </button>

      <div
        className={`mt-4 rounded-xl p-3 text-sm font-medium ${
          Math.abs(total - 100) < 0.1
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        Toplam: %{total.toFixed(1)}
        {Math.abs(total - 100) >= 0.1 && " — Toplam %100 olmalıdır"}
      </div>
    </div>
  );
}
