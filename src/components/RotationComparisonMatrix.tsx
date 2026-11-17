import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import type {
  CropStage,
  LanguageMode,
  MonthlyCropPlan,
  RotationStrategy,
  StressTestResult,
} from '../types/agro';

interface RotationComparisonMatrixProps {
  strategies: RotationStrategy[];
  stressResults: Record<string, StressTestResult>;
  isShockActive: boolean;
  aiSourceLabel: string;
  languageMode: LanguageMode;
}

type DetailTab = 'nasa' | 'agronomy' | 'gaps';

const STAGE_STYLES: Record<CropStage, { bg: string; border: string; label: string }> = {
  Planting: { bg: 'bg-sky-500/80', border: 'border-sky-400', label: 'Plant' },
  Growing: { bg: 'bg-emerald-500/85', border: 'border-emerald-400', label: 'Grow' },
  Harvest: { bg: 'bg-amber-500/85', border: 'border-amber-400', label: 'Harv' },
  'Cover Crop': { bg: 'bg-teal-500/80', border: 'border-teal-300', label: 'Cover' },
  'Bare Soil': { bg: 'bg-rose-500/85', border: 'border-rose-400', label: 'Bare' },
};

export const RotationComparisonMatrix: React.FC<RotationComparisonMatrixProps> = ({
  strategies,
  stressResults,
  isShockActive,
  aiSourceLabel,
  languageMode,
}) => {
  const [activeTabs, setActiveTabs] = useState<Record<string, DetailTab>>({});
  const [selectedMonths, setSelectedMonths] = useState<Record<string, number>>({});

  if (strategies.length === 0) return null;

  const isFarmer = languageMode === 'farmer';

  const getTab = (id: string): DetailTab => activeTabs[id] ?? 'nasa';
  const setTab = (id: string, tab: DetailTab) =>
    setActiveTabs((prev) => ({ ...prev, [id]: tab }));

  const getQualitativeRating = (score: number) => {
    if (score >= 80) return { text: 'Great Fit', color: 'text-emerald-300' };
    if (score >= 65) return { text: 'Good Option', color: 'text-cyan-300' };
    return { text: 'Risky Choice', color: 'text-amber-300' };
  };

  const getMetricWord = (score: number) => {
    if (score >= 78) return { text: 'Strong', color: 'text-emerald-300' };
    if (score >= 52) return { text: 'Medium', color: 'text-amber-300' };
    return { text: 'Weak', color: 'text-rose-300' };
  };

  const getFarmerStressLabel = (status: StressTestResult['survivalStatus']) => {
    if (status === 'Resilient') return 'Holds Up Well';
    if (status === 'Strained') return 'Needs Extra Mulch';
    return 'High Risk of Crop Loss';
  };

  return (
    <section
      id="strategies"
      aria-label="3 Crop Rotation Strategies Comparison"
      className="scroll-mt-20 space-y-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-emerald-400">
            04. {isFarmer ? 'Your 3 Simple Crop Plans' : 'Stage B · Multi-Strategy Agronomic Synthesis'}
          </p>
          <h2 className="text-xl font-semibold text-slate-100 mt-0.5">
            {isFarmer
              ? 'Compare 3 Easy Planting Plans for Your Field'
              : '3-Year Crop Rotation Strategies & Bare-Soil Coverage Matrix'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" aria-hidden="true" />
            Planting
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" aria-hidden="true" />
            Growing
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" aria-hidden="true" />
            Harvest
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-500 inline-block" aria-hidden="true" />
            Cover Crop
          </span>
          <span className="flex items-center gap-1.5 text-rose-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" aria-hidden="true" />
            Bare Soil
          </span>
          {!isFarmer && (
            <>
              <span aria-hidden="true">·</span>
              <span>{aiSourceLabel}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-stretch">
        {strategies.map((strategy) => {
          const stress = stressResults[strategy.id];
          const displayScore = stress ? stress.adjustedSuitabilityScore : strategy.suitabilityScore;
          const activeTab = getTab(strategy.id);
          const monthIdx = selectedMonths[strategy.id] ?? 2;
          const activeMonth: MonthlyCropPlan | undefined = strategy.monthlyCalendar[monthIdx] ?? strategy.monthlyCalendar[0];

          const accentColor =
            strategy.badgeColor === 'emerald'
              ? 'text-emerald-300 border-emerald-700/60'
              : strategy.badgeColor === 'cyan'
                ? 'text-cyan-300 border-cyan-700/60'
                : 'text-amber-300 border-amber-700/60';

          const impactRows = [
            { label: isFarmer ? 'Soil Strength' : 'Soil Health Score', value: strategy.impactMetrics.soilHealthScore },
            { label: isFarmer ? 'Water Saved' : 'Water Conservation', value: strategy.impactMetrics.waterConservationScore },
            { label: isFarmer ? 'Stops Wash-Away' : 'Erosion Reduction', value: strategy.impactMetrics.erosionReductionScore },
            { label: isFarmer ? 'Natural Soil Food' : 'Nitrogen Balance', value: strategy.impactMetrics.nitrogenBalanceScore },
            { label: isFarmer ? 'Reliable Food & Cash' : 'Market Resilience', value: strategy.impactMetrics.marketResilienceScore },
          ];

          const rating = getQualitativeRating(displayScore);

          return (
            <article
              key={strategy.id}
              data-testid={`strategy-card-${strategy.id}`}
              className={`bg-[#0e1513] border rounded-xl p-5 flex flex-col justify-between gap-5 ${
                strategy.badgeColor === 'emerald'
                  ? 'border-emerald-700/60'
                  : 'border-[#1f2e29]'
              }`}
            >
              {/* Top Section */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-100 leading-snug">
                      {strategy.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {strategy.tagline}
                    </p>
                  </div>

                  {isFarmer ? (
                    <div className={`shrink-0 text-right border rounded-lg px-2.5 py-1.5 bg-[#121c19] ${accentColor}`}>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">
                        Rating
                      </div>
                      <div className={`text-sm font-semibold leading-tight ${rating.color}`}>
                        {rating.text}
                      </div>
                    </div>
                  ) : (
                    <div className={`shrink-0 text-right border rounded-lg px-2.5 py-1.5 bg-[#121c19] ${accentColor}`}>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Suitability
                      </div>
                      <div className="text-xl font-mono font-bold tabular-nums leading-tight">
                        {displayScore}
                        <span className="text-xs font-normal text-slate-400">/100</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Climate Stress Delta Banner */}
                {stress && isShockActive && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${
                      stress.survivalStatus === 'Critical Risk'
                        ? 'bg-rose-950/35 border-rose-800/70 text-rose-200'
                        : stress.survivalStatus === 'Strained'
                          ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                          : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                    }`}
                  >
                    {stress.survivalStatus === 'Resilient' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <ShieldAlert
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          stress.survivalStatus === 'Critical Risk' ? 'text-rose-400' : 'text-amber-400'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                    <div className="space-y-0.5">
                      {isFarmer ? (
                        <>
                          <div className="font-semibold">
                            {getFarmerStressLabel(stress.survivalStatus)}
                          </div>
                          <p className="text-[11px] opacity-90">
                            {stress.survivalStatus === 'Resilient'
                              ? 'This plan keeps enough green cover and roots to protect your harvest in harsh weather.'
                              : stress.survivalStatus === 'Strained'
                                ? 'Crops will feel the heat or dry spell — keep extra mulch between rows.'
                                : 'High chance of dry soil or crop loss under tough weather.'}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="font-mono font-semibold tabular-nums">
                            {stress.survivalStatus} · Yield Retention {stress.yieldRetentionPct}% ({stress.scoreDelta >= 0 ? '+' : ''}{stress.scoreDelta} pts)
                          </div>
                          <p className="text-[11px] opacity-90">{stress.stressWarning}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-300 leading-relaxed">
                  {strategy.whySuggested}
                </p>

                {/* 12-Month Visual Crop Rotation Timeline Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>{isFarmer ? '12-Month Planting Calendar' : '12-Month Rotation Calendar'}</span>
                    <span>{isFarmer ? 'Tap a month' : 'Click month for details'}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1">
                    {strategy.monthlyCalendar.map((item, idx) => {
                      const st = STAGE_STYLES[item.stage] ?? STAGE_STYLES.Growing;
                      const isSelected = monthIdx === idx;
                      return (
                        <button
                          key={`${strategy.id}-${item.month}`}
                          type="button"
                          onClick={() => setSelectedMonths((prev) => ({ ...prev, [strategy.id]: idx }))}
                          title={`${item.month}: ${item.cropName} (${item.stage})`}
                          className={`flex flex-col items-center rounded py-1.5 px-0.5 border transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                            isSelected
                              ? 'ring-1 ring-white scale-[1.03] border-white bg-[#192823]'
                              : 'border-[#21312c] bg-[#111a17] hover:border-slate-500'
                          }`}
                        >
                          <span className="text-[10px] font-mono text-slate-300 leading-none">
                            {item.month.slice(0, 1)}
                          </span>
                          <span className={`mt-1 w-full h-2.5 rounded-xs ${st.bg}`} />
                        </button>
                      );
                    })}
                  </div>

                  {activeMonth && (
                    <div className="bg-[#121c19] border border-[#1f2e29] rounded-lg px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-semibold text-emerald-300 mr-1.5">
                          {activeMonth.month}:
                        </span>
                        <span className="text-slate-100 font-medium">{activeMonth.cropName}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                        <span>{activeMonth.stage}</span>
                        {!isFarmer && (
                          <>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span>NDVI {activeMonth.ndviTarget.toFixed(2)}</span>
                          </>
                        )}
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>{activeMonth.waterDemand} water</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5-Axis Impact Comparison Bars */}
                <div className="space-y-2 pt-1">
                  {impactRows.map((row) => {
                    const wordRating = getMetricWord(row.value);
                    return (
                      <div key={row.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">{row.label}</span>
                          {isFarmer ? (
                            <span className={`font-semibold ${wordRating.color}`}>
                              {wordRating.text}
                            </span>
                          ) : (
                            <span className="font-mono text-slate-200 font-semibold tabular-nums">
                              {row.value}/100
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 w-full bg-[#18231f] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              strategy.badgeColor === 'emerald'
                                ? 'bg-emerald-400'
                                : strategy.badgeColor === 'cyan'
                                  ? 'bg-cyan-400'
                                  : 'bg-amber-400'
                            }`}
                            style={{ width: `${row.value}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expandable Deep-Dive Tabs */}
              <div className="border-t border-[#1b2924] pt-4 space-y-3">
                <div role="tablist" aria-label={`${strategy.name} deep dive`} className="grid grid-cols-3 gap-1 p-1 bg-[#121c19] rounded-lg border border-[#1f2e29]">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'nasa'}
                    onClick={() => setTab(strategy.id, 'nasa')}
                    className={`px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap truncate ${
                      activeTab === 'nasa'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-600/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isFarmer ? 'Why It Helps' : 'NASA Evidence'}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'agronomy'}
                    onClick={() => setTab(strategy.id, 'agronomy')}
                    className={`px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap truncate ${
                      activeTab === 'agronomy'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-600/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isFarmer ? 'Soil & Pests' : 'pH & Altitude'}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'gaps'}
                    onClick={() => setTab(strategy.id, 'gaps')}
                    className={`px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap truncate ${
                      activeTab === 'gaps'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-600/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isFarmer ? 'Things to Check' : 'Extension Review'}
                  </button>
                </div>

                {activeTab === 'nasa' && (
                  <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                    {strategy.nasaEvidenceUsed.map((ev, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-mono text-emerald-400 text-[11px] mt-0.5">0{i + 1}.</span>
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {activeTab === 'agronomy' && (
                  <dl className="space-y-2 text-xs text-slate-300 leading-relaxed">
                    <div>
                      <dt className="font-semibold text-emerald-300">
                        {isFarmer ? 'Soil Match' : 'pH Compatibility'}
                      </dt>
                      <dd className="text-slate-300">{strategy.soilAndAgronomicMechanics.phCompatibility}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-emerald-300">
                        {isFarmer ? 'Natural Plant Food' : 'Nitrogen Cycling'}
                      </dt>
                      <dd className="text-slate-300">{strategy.soilAndAgronomicMechanics.nitrogenCycling}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-emerald-300">
                        {isFarmer ? 'Water & Wash-Away' : 'Erosion & Infiltration'}
                      </dt>
                      <dd className="text-slate-300">{strategy.soilAndAgronomicMechanics.erosionAndInfiltration}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-emerald-300">Pest Cycle Disruption</dt>
                      <dd className="text-slate-300">{strategy.soilAndAgronomicMechanics.pestCycleDisruption}</dd>
                    </div>
                  </dl>
                )}

                {activeTab === 'gaps' && (
                  <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                    <div className="flex items-start gap-1.5 text-amber-300 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        {isFarmer
                          ? 'Check these locally before planting:'
                          : 'Review with your local agricultural extension officer:'}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {strategy.informationGapsAndRisks.map((gap, i) => (
                        <li key={i} className="flex items-start gap-2 text-slate-300">
                          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
