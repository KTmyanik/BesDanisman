"use client";

import { clsx } from "clsx";
import { Check } from "lucide-react";

const STEPS = [
  { id: 1, label: "Başlangıç" },
  { id: 2, label: "Risk Profili" },
  { id: 3, label: "Portföy" },
  { id: 4, label: "Plan" },
];

export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2 sm:gap-4">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div
              className={clsx(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition",
                currentStep > step.id
                  ? "bg-brand-600 text-white"
                  : currentStep === step.id
                    ? "bg-brand-600 text-white ring-4 ring-brand-100"
                    : "bg-slate-200 text-slate-500"
              )}
            >
              {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
            </div>
            <span className="mt-1 hidden text-xs text-slate-500 sm:block">
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={clsx(
                "h-0.5 w-8 sm:w-16",
                currentStep > step.id ? "bg-brand-600" : "bg-slate-200"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
