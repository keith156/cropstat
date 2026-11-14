import React from 'react';
import { CloudDrizzle, RotateCcw, ThermometerSun } from 'lucide-react';
import type { LanguageMode, RotationStrategy, StressTestResult } from '../types/agro';

interface ClimateStressTesterProps {
  tempDeltaC: number;
  rainDeltaPct: number;
  strategies: RotationStrategy[];
  stressResults: Record<string, StressTestResult>;
  languageMode: LanguageMode;
  onChangeTempDelta: (val: number) => void;
  onChangeRainDelta: (val: number) => void;
  onReset: () => void;
}

export const ClimateStressTester: React.FC<ClimateStressTesterProps> = ({
  tempDeltaC,
  rainDeltaPct,
  strategies,
  stressResults,
  languageMode,
  onChangeTempDelta,
  onChangeRainDelta,
  onReset,
}) => {
  if (strategies.length === 0) return null;

  const isFarmer = languageMode === 'farmer';
  const isModified = tempDeltaC !== 0 || rainDeltaPct !== 0;

  return (
    <section
      id="stress-test"
      aria-label="Climate Shock Stress-Test Sliders"
      className="lg:sticky lg:bottom-3 z-30 bg-[#0b1210]/95 backdrop-blur-sm border border-emerald-800/60 rounded-xl p-4 shadow-lg"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title + Live Sliders */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 flex-1">
          <div className="shrink-0">
            <p className="text-[11px] font-mono text-amber-300 uppercase tracking-wider">
              {isFarmer ? 'Future Weather Stress-Test' : 'Live Climate Shock Simulator'}
            </p>
            <h3 className="text-sm font-semibold text-slate-100">
              {isFarmer ? 'Test How Rotations Survive Heat & Drought' : 'Temperature & Rainfall Anomaly Sensitivity'}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-xl">
            {/* Temperature Anomaly Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="stress-temp-slider" className="text-slate-300 flex items-center gap-1.5">
                  <ThermometerSun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  <span>Heat Shift</span>
                </label>
                <span className="font-mono font-semibold text-amber-300 tabular-nums">
                  +{tempDeltaC.toFixed(1)}°C
                </span>
              </div>
              <input
                id="stress-temp-slider"
                type="range"
                min={0}
                max={4.0}
                step={0.2}
                value={tempDeltaC}
                onChange={(e) => onChangeTempDelta(Number(e.target.value))}
                className="terra-slider w-full"
              />
            </div>

            {/* Rainfall Shift Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="stress-rain-slider" className="text-slate-300 flex items-center gap-1.5">
                  <CloudDrizzle className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                  <span>Rainfall Shift</span>
                </label>
                <span className="font-mono font-semibold text-cyan-300 tabular-nums">
                  {rainDeltaPct >= 0 ? `+${rainDeltaPct}%` : `${rainDeltaPct}%`}
                </span>
              </div>
              <input
                id="stress-rain-slider"
                type="range"
                min={-40}
                max={30}
                step={5}
                value={rainDeltaPct}
                onChange={(e) => onChangeRainDelta(Number(e.target.value))}
                className="terra-slider w-full"
              />
            </div>
          </div>
        </div>

        {/* Live 3-Strategy Survival Readout + Reset */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
            {strategies.map((strat, idx) => {
              const res = stressResults[strat.id];
              const score = res ? res.adjustedSuitabilityScore : strat.suitabilityScore;
              const shortTitle = idx === 0 ? 'Baseline' : idx === 1 ? 'Regenerative' : 'Hybrid';
              const statusColor =
                res?.survivalStatus === 'Critical Risk'
                  ? 'text-rose-400'
                  : res?.survivalStatus === 'Strained'
                    ? 'text-amber-300'
                    : 'text-emerald-300';

              return (
                <div
                  key={strat.id}
                  className="px-2.5 py-1.5 rounded-lg bg-[#121c19] border border-[#22322d]"
                >
                  <span className="text-slate-400 mr-1.5">{shortTitle}:</span>
                  <span className={`font-bold ${statusColor}`}>{score}</span>
                  {res && isModified && (
                    <span className="text-slate-400 ml-1">({res.yieldRetentionPct}%)</span>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onReset}
            disabled={!isModified}
            className="px-3 py-1.5 rounded-lg border border-[#253630] bg-[#121c19] text-xs font-medium text-slate-300 hover:text-white hover:border-emerald-600 disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>
    </section>
  );
};
