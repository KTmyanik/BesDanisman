"use client";

import { RISK_QUESTIONS } from "@/lib/risk-profile";
import type { RiskAnswer } from "@/lib/types";

interface Props {
  answers: RiskAnswer[];
  onAnswer: (questionId: string, value: number) => void;
  currentQuestionIndex: number;
  onNext: () => void;
  onPrev: () => void;
  readOnlyQuestionIds?: string[];
}

export function RiskQuestionnaire({
  answers,
  onAnswer,
  currentQuestionIndex,
  onNext,
  onPrev,
  readOnlyQuestionIds = [],
}: Props) {
  const question = RISK_QUESTIONS[currentQuestionIndex];
  const currentAnswer = answers.find((a) => a.questionId === question.id)?.value;
  const isLast = currentQuestionIndex === RISK_QUESTIONS.length - 1;
  const readOnly = readOnlyQuestionIds.includes(question.id);

  return (
    <div className="card mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-sm text-slate-500">
          Soru {currentQuestionIndex + 1} / {RISK_QUESTIONS.length}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{
              width: `${((currentQuestionIndex + 1) / RISK_QUESTIONS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-slate-900">{question.text}</h2>
      {readOnly && (
        <p className="mt-2 text-sm text-slate-500">
          Bu cevap, emekliliğe kalan yıldan gelir.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {question.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-disabled={readOnly}
            onClick={() => {
              if (!readOnly) onAnswer(question.id, opt.value);
            }}
            className={`w-full rounded-xl border p-4 text-left transition ${
              currentAnswer === opt.value
                ? "border-brand-600 bg-brand-50 ring-2 ring-brand-200"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className="font-medium text-slate-800">{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentQuestionIndex === 0}
          className="btn-secondary"
        >
          Geri
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={currentAnswer === undefined}
          className="btn-primary"
        >
          {isLast ? "Tamamla" : "İleri"}
        </button>
      </div>
    </div>
  );
}
