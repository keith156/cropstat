import React from 'react';
import { ArrowRight, Check, SatelliteDish } from 'lucide-react';
import type { CalibrationQuestion, LanguageMode } from '../types/agro';

interface CalibrationQuestionsModalProps {
  questions: CalibrationQuestion[];
  answers: Record<string, string>;
  aiSourceLabel: string;
  isGeneratingStrategies: boolean;
  languageMode: LanguageMode;
  onChangeAnswer: (questionId: string, value: string) => void;
  onSubmitAnswers: () => void;
}

export const CalibrationQuestionsModal: React.FC<CalibrationQuestionsModalProps> = ({
  questions,
  answers,
  aiSourceLabel,
  isGeneratingStrategies,
  languageMode,
  onChangeAnswer,
  onSubmitAnswers,
}) => {
  if (questions.length === 0) return null;

  const isFarmer = languageMode === 'farmer';
  const allAnswered = questions.every((q) => (answers[q.id] ?? '').trim().length > 0);

  return (
    <section
      id="calibration"
      aria-label="Satellite-to-Ground Calibration Questions"
      className="scroll-mt-20 bg-[#0e1513] border border-emerald-800/60 rounded-xl p-6 space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1b2924] pb-4">
        <div>
          <p className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
            <SatelliteDish className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              03. {isFarmer ? '3 Quick Questions About Your Farm' : 'Stage A · Satellite-to-Ground Calibration'}
            </span>
          </p>
          <h2 className="text-xl font-semibold text-slate-100 mt-1">
            {isFarmer
              ? 'Tell Us 3 Simple Things About Your Land'
              : 'Verify Your Local Field Reality Before Generating Crop Rotations'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            {isFarmer
              ? 'Tap the choice closest to what you do on your farm, or write your own short answer.'
              : 'Satellites measure regional moisture and rain from orbit, but only you know how crop residues are handled, what amendments are affordable, and which crops sell nearby.'}
          </p>
        </div>
        {!isFarmer && <span className="text-xs font-mono text-slate-400">{aiSourceLabel}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {questions.map((q, index) => {
          const currentAnswer = answers[q.id] ?? '';
          return (
            <div
              key={q.id}
              className="bg-[#111a17] border border-[#22322d] rounded-xl p-4 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                {isFarmer ? (
                  <div className="text-xs font-semibold text-emerald-400">
                    Question {index + 1} of {questions.length}
                  </div>
                ) : (
                  <div className="text-[11px] font-mono text-cyan-300 leading-snug">
                    <span className="text-emerald-400 font-semibold mr-1.5">0{index + 1}.</span>
                    {q.satelliteTrigger}
                  </div>
                )}

                <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                  {q.question}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {q.whyWeAsk}
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-col gap-1.5">
                  {q.quickOptions.map((opt) => {
                    const isSelected = currentAnswer === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onChangeAnswer(q.id, opt)}
                        aria-pressed={isSelected}
                        className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200 font-medium'
                            : 'bg-[#0c1311] border-[#21312c] text-slate-300 hover:border-emerald-700 hover:text-white'
                        }`}
                      >
                        <span>{opt}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label htmlFor={`custom-${q.id}`} className="sr-only">
                    Custom answer for question {index + 1}
                  </label>
                  <input
                    id={`custom-${q.id}`}
                    type="text"
                    value={currentAnswer}
                    onChange={(e) => onChangeAnswer(q.id, e.target.value)}
                    placeholder={isFarmer ? 'Or write your own short answer...' : 'Or type your exact field practice...'}
                    className="w-full bg-[#0a100e] border border-[#243630] rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <p className="text-xs text-slate-400">
          {allAnswered
            ? (isFarmer
                ? 'All 3 questions answered — click the button to see your 3 crop plans.'
                : 'All 3 calibration checks answered — ready to synthesize 3 tailored rotation strategies.')
            : (isFarmer
                ? 'Pick or type an answer for all 3 questions to see your plans.'
                : 'Select a quick option or type an answer for all 3 questions to continue.')}
        </p>

        <button
          type="button"
          onClick={onSubmitAnswers}
          disabled={!allAnswered || isGeneratingStrategies}
          className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-950/60 disabled:text-slate-500 text-slate-950 font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
        >
          <span>
            {isGeneratingStrategies
              ? (isFarmer ? 'Making Your 3 Simple Crop Plans...' : 'Generating 3 Rotation Strategies...')
              : (isFarmer ? 'Show My 3 Simple Crop Plans' : 'Generate 3 Resilient Rotation Strategies')}
          </span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};
