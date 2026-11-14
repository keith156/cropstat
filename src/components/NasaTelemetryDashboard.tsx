import React, { useState } from 'react';
import { CloudRain, Droplets, Flame, Layers, Mountain, ShieldAlert } from 'lucide-react';
import type { LanguageMode, MonthlyClimatePoint, NasaTelemetryPayload } from '../types/agro';

interface NasaTelemetryDashboardProps {
  telemetry: NasaTelemetryPayload | null;
  isLoading: boolean;
  languageMode: LanguageMode;
}

export const NasaTelemetryDashboard: React.FC<NasaTelemetryDashboardProps> = ({
  telemetry,
  isLoading,
  languageMode,
}) => {
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

  if (isLoading || !telemetry) {
    return (
      <section
        id="telemetry"
        aria-label="NASA Earth Observation Telemetry Loading"
        className="bg-[#0e1513] border border-[#1f2e29] rounded-xl p-6 space-y-5"
      >
        <div className="h-6 w-64 bg-[#17231f] rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-[#121c19] border border-[#1f2e29] rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-[#121c19] border border-[#1f2e29] rounded-lg animate-pulse" />
      </section>
    );
  }

  const isFarmer = languageMode === 'farmer';
  const maxRain = Math.max(...telemetry.monthly.map((m) => m.gpmRainfallMm), 160);
  const inspectedMonth: MonthlyClimatePoint =
    hoveredMonthIdx !== null ? telemetry.monthly[hoveredMonthIdx] : telemetry.monthly[2];

  // SVG Chart Geometry
  const chartW = 760;
  const chartH = 260;
  const padL = 44;
  const padR = 44;
  const padT = 22;
  const padB = 34;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const colW = plotW / 12;

  const getX = (idx: number) => padL + colW * idx + colW / 2;
  const getRainY = (mm: number) => padT + plotH - (mm / maxRain) * plotH;
  const getPctY = (pct: number) => padT + plotH - (pct / 100) * plotH;
  const getNdviY = (ndvi: number) => padT + plotH - ndvi * plotH;

  const smapPath = telemetry.monthly
    .map((m, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getPctY(m.smapRootMoisturePct).toFixed(1)}`)
    .join(' ');

  const ndviLinePath = telemetry.monthly
    .map((m, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getNdviY(m.ndviCover).toFixed(1)}`)
    .join(' ');

  const ndviAreaPath = `${ndviLinePath} L ${getX(11).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  return (
    <section
      id="telemetry"
      aria-label="NASA Earth Observation Telemetry"
      className="scroll-mt-20 space-y-5"
    >
      {/* Header + Data Source Status */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-emerald-400">
            02. {isFarmer ? 'Satellite Weather, Soil Water & Erosion Scan' : 'Multi-Mission NASA Earth Observation Fusion'}
          </p>
          <h2 className="text-xl font-semibold text-slate-100 mt-0.5">
            {isFarmer ? 'What Satellites See Above Your Field' : 'SMAP · ECOSTRESS · GPM · MODIS · SRTM Telemetry'}
          </h2>
        </div>

        <div className="text-xs font-mono text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            NASA POWER:{' '}
            <strong className={telemetry.dataSources.nasaPower === 'live' ? 'text-emerald-400' : 'text-amber-300'}>
              {telemetry.dataSources.nasaPower === 'live' ? 'Live' : 'Regional Cache'}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            SRTM:{' '}
            <strong className={telemetry.dataSources.srtmElevation === 'live' ? 'text-emerald-400' : 'text-amber-300'}>
              {telemetry.dataSources.srtmElevation === 'live' ? 'Live' : 'Regional Cache'}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            SoilGrids:{' '}
            <strong className={telemetry.dataSources.soilGrids === 'live' ? 'text-emerald-400' : 'text-amber-300'}>
              {telemetry.dataSources.soilGrids === 'live' ? 'Live' : 'Regional Cache'}
            </strong>
          </span>
        </div>
      </div>

      {/* 4 Mission Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Card 1: SMAP Soil Moisture */}
        <article className="bg-[#0e1513] border border-[#1f2e29] rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-slate-400 font-medium">
                {isFarmer ? 'Deep Soil Water Reserve' : 'SMAP Root-Zone Moisture'}
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-mono font-bold text-slate-50 tabular-nums">
                  {telemetry.smapRootMoistureAvg}%
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ({telemetry.smapMoistureAnomalyPct >= 0 ? '+' : ''}{telemetry.smapMoistureAnomalyPct}% vs norm)
                </span>
              </div>
            </div>
            <Droplets className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>Surface: {telemetry.smapSurfaceWetnessAvg}%</span>
              <span>Root: {telemetry.smapRootMoistureAvg}%</span>
            </div>
            <div className="h-1.5 w-full bg-[#192521] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full"
                style={{ width: `${telemetry.smapRootMoistureAvg}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {telemetry.smapDryMonths.length > 0
                ? `Dry months (<45%): ${telemetry.smapDryMonths.join(', ')}`
                : 'Root-zone moisture stays >45% year-round'}
            </p>
          </div>
        </article>

        {/* Card 2: ECOSTRESS Heat & Evaporative Stress */}
        <article className="bg-[#0e1513] border border-[#1f2e29] rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-slate-400 font-medium">
                {isFarmer ? 'Crop Heat & Thirst Stress' : 'ECOSTRESS Heat & ESI'}
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-mono font-bold text-slate-50 tabular-nums">
                  {telemetry.ecostressPeakTempC.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-slate-400">°C peak</span>
              </div>
            </div>
            <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          </div>

          <div className="space-y-1 text-[11px] text-slate-300">
            <div className="flex items-center justify-between gap-2 font-mono whitespace-nowrap">
              <span className="text-slate-400">
                {isFarmer ? 'Thirst Ratio:' : 'Mean ESI:'}
              </span>
              <span className={telemetry.ecostressEsiAvg > 1.15 ? 'text-amber-300 font-semibold' : 'text-emerald-300 font-semibold'}>
                {telemetry.ecostressEsiAvg.toFixed(2)} {telemetry.ecostressEsiAvg > 1.15 ? 'High ET' : 'Balanced'}
              </span>
            </div>
            <p className="text-slate-400">
              ~{telemetry.ecostressHeatStressDays} canopy heat-stress days (&gt;30°C) per year
            </p>
          </div>
        </article>

        {/* Card 3: GPM Rainfall & Frost */}
        <article className="bg-[#0e1513] border border-[#1f2e29] rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-slate-400 font-medium">
                {isFarmer ? 'Annual Rain & Cold Risk' : 'GPM Precipitation & Frost'}
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-mono font-bold text-slate-50 tabular-nums">
                  {telemetry.gpmAnnualRainfallMm.toLocaleString()}
                </span>
                <span className="text-xs font-mono text-slate-400">mm/yr</span>
              </div>
            </div>
            <CloudRain className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" aria-hidden="true" />
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Pattern:</span>
              <span className="text-cyan-300 font-medium">{telemetry.gpmSeasonality}</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Frost Risk:</span>
              <span
                className={
                  telemetry.gpmFrostRiskLevel === 'High' || telemetry.gpmFrostRiskLevel === 'Moderate'
                    ? 'text-amber-300 font-semibold'
                    : 'text-emerald-300'
                }
              >
                {telemetry.gpmFrostRiskLevel}
              </span>
            </div>
          </div>
        </article>

        {/* Card 4: SRTM Elevation & Erosion Risk */}
        <article className="bg-[#0e1513] border border-[#1f2e29] rounded-xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-slate-400 font-medium">
                {isFarmer ? 'Topsoil Wash-Away Risk' : 'SRTM Slope & Erosion Index'}
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-mono font-bold text-slate-50 tabular-nums">
                  {telemetry.topographicErosionScore}
                </span>
                <span className="text-xs font-mono text-slate-400">/ 100 risk</span>
              </div>
            </div>
            <Mountain className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Altitude:</span>
              <span className="text-slate-200 tabular-nums">{telemetry.srtmAltitudeM} m ASL</span>
            </div>
            <p className="text-slate-400 truncate" title={telemetry.graceGroundwaterTrend}>
              {telemetry.graceGroundwaterTrend}
            </p>
          </div>
        </article>
      </div>

      {/* Interactive 12-Month Climate & Bare-Soil Vulnerability Chart */}
      <div className="bg-[#0e1513] border border-[#1f2e29] rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {isFarmer
                ? '12-Month Rain, Soil Moisture & Bare-Ground Danger Windows'
                : 'Annual GPM Rainfall vs. SMAP Root Moisture vs. MODIS NDVI Cover'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isFarmer
                ? 'Red shaded months show when heavy rain hits bare soil after harvest (NDVI < 0.30), washing away fertile topsoil.'
                : 'Red bands highlight Bare-Soil Danger Windows (MODIS NDVI < 0.30 coinciding with GPM onset rainfall >= 80 mm/mo).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-cyan-500/70 inline-block rounded-xs" aria-hidden="true" />
              GPM Rain (mm)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block" aria-hidden="true" />
              SMAP Moisture (%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-400 inline-block" aria-hidden="true" />
              MODIS NDVI (0–1)
            </span>
            <span className="flex items-center gap-1.5 text-rose-300">
              <span className="w-2.5 h-2.5 bg-rose-500/35 border border-rose-500 inline-block rounded-xs" aria-hidden="true" />
              Bare-Soil Risk
            </span>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full min-w-[600px] h-auto select-none"
            role="img"
            aria-label="12-month GPM rainfall, SMAP soil moisture, and MODIS NDVI chart"
          >
            {/* Horizontal gridlines */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = getPctY(pct);
              return (
                <g key={pct}>
                  <line
                    x1={padL}
                    x2={chartW - padR}
                    y1={y}
                    y2={y}
                    stroke="#1c2a25"
                    strokeWidth="1"
                  />
                  <text
                    x={padL - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="#788e86"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {Math.round((pct / 100) * maxRain)}
                  </text>
                  <text
                    x={chartW - padR + 8}
                    y={y + 3}
                    textAnchor="start"
                    fill="#788e86"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Axis Labels */}
            <text x={padL} y={12} fill="#67e8f9" fontSize="9" fontFamily="JetBrains Mono, monospace">
              mm/mo
            </text>
            <text x={chartW - padR} y={12} textAnchor="end" fill="#6ee7b7" fontSize="9" fontFamily="JetBrains Mono, monospace">
              Moisture % / NDVI
            </text>

            {/* 0.30 NDVI Bare-Soil Danger Threshold Reference */}
            <line
              x1={padL}
              x2={chartW - padR}
              y1={getNdviY(0.30)}
              y2={getNdviY(0.30)}
              stroke="#fb7185"
              strokeDasharray="4 4"
              strokeWidth="1"
              opacity={0.75}
            />
            <rect
              x={padL + 4}
              y={getNdviY(0.30) - 16}
              width={186}
              height={14}
              rx={3}
              fill="#0e1513"
              opacity={0.9}
            />
            <text
              x={padL + 8}
              y={getNdviY(0.30) - 6}
              fill="#fda4af"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              NDVI 0.30 bare-soil threshold
            </text>

            {/* Month columns: Bare-Soil Danger Zone + Rain Bars */}
            {telemetry.monthly.map((m, idx) => {
              const colLeft = padL + idx * colW;
              const barW = colW * 0.48;
              const barX = colLeft + (colW - barW) / 2;
              const rainY = getRainY(m.gpmRainfallMm);
              const barH = padT + plotH - rainY;
              const isHovered = hoveredMonthIdx === idx;

              return (
                <g key={m.month}>
                  {m.isBareSoilDanger && (
                    <g>
                      <rect
                        x={colLeft + 2}
                        y={padT}
                        width={colW - 4}
                        height={plotH}
                        fill="rgba(239, 68, 68, 0.16)"
                        stroke="rgba(239, 68, 68, 0.45)"
                        strokeWidth="1"
                        rx="3"
                      />
                      <text
                        x={colLeft + colW / 2}
                        y={padT + 11}
                        textAnchor="middle"
                        fill="#fca5a5"
                        fontSize="8"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="600"
                      >
                        RISK
                      </text>
                    </g>
                  )}

                  {isHovered && (
                    <rect
                      x={colLeft + 1}
                      y={padT}
                      width={colW - 2}
                      height={plotH}
                      fill="rgba(255,255,255,0.04)"
                    />
                  )}

                  <rect
                    x={barX}
                    y={rainY}
                    width={barW}
                    height={Math.max(2, barH)}
                    fill={m.isBareSoilDanger ? '#fb7185' : '#0891b2'}
                    opacity={isHovered ? 0.95 : 0.68}
                    rx="2"
                  />

                  <text
                    x={colLeft + colW / 2}
                    y={chartH - 12}
                    textAnchor="middle"
                    fill={isHovered ? '#ecfdf5' : m.isBareSoilDanger ? '#fda4af' : '#94a3b8'}
                    fontSize="11"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={isHovered ? '600' : '400'}
                  >
                    {m.month}
                  </text>
                </g>
              );
            })}

            {/* MODIS NDVI Area + Curve */}
            <path d={ndviAreaPath} fill="rgba(245, 158, 11, 0.12)" />
            <path d={ndviLinePath} fill="none" stroke="#f59e0b" strokeWidth="2.2" />

            {/* SMAP Root-Zone Soil Moisture Curve */}
            <path d={smapPath} fill="none" stroke="#34d399" strokeWidth="2.2" />

            {/* Data point markers & invisible hover targets */}
            {telemetry.monthly.map((m, idx) => {
              const cx = getX(idx);
              const colLeft = padL + idx * colW;
              return (
                <g key={`pt-${m.month}`}>
                  <circle cx={cx} cy={getPctY(m.smapRootMoisturePct)} r={hoveredMonthIdx === idx ? 4.5 : 3} fill="#34d399" />
                  <circle cx={cx} cy={getNdviY(m.ndviCover)} r={hoveredMonthIdx === idx ? 4.5 : 3} fill="#f59e0b" />
                  <rect
                    x={colLeft}
                    y={padT}
                    width={colW}
                    height={plotH + padB}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoveredMonthIdx(idx)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Live Month Crosshair Readout */}
        <div className="mt-3 pt-3 border-t border-[#1b2924] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums">
            <span className="text-emerald-300 font-semibold">{inspectedMonth.month} Readout:</span>
            <span className="text-cyan-300">GPM Rain: {inspectedMonth.gpmRainfallMm} mm</span>
            <span className="text-emerald-300">SMAP Root: {inspectedMonth.smapRootMoisturePct}%</span>
            <span className="text-amber-300">NDVI Cover: {inspectedMonth.ndviCover.toFixed(2)}</span>
            <span className="text-slate-300">Max/Min: {inspectedMonth.t2mMax}° / {inspectedMonth.t2mMin}°C</span>
          </div>

          {inspectedMonth.isBareSoilDanger && inspectedMonth.bareSoilRiskReason ? (
            <span className="text-rose-300 flex items-center gap-1.5 text-xs">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {inspectedMonth.bareSoilRiskReason}
            </span>
          ) : (
            <span className="text-slate-400 text-xs">
              {telemetry.bareSoilDangerMonths.length > 0
                ? `Flagged Bare-Soil Danger Months: ${telemetry.bareSoilDangerMonths.join(', ')}`
                : 'No bare-soil erosion spikes detected under current cover.'}
            </span>
          )}
        </div>
      </div>

      {/* Resolution Harmonization Inspector */}
      <div className="bg-[#0e1513] border border-[#1f2e29] rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
          <Layers className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{isFarmer ? 'How Satellite Scales Combine With Your Field:' : 'Multi-Resolution Spatial Harmonization Stack:'}</span>
        </div>
        <div className="text-xs font-mono text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-slate-300">GRACE-FO (~300km aquifer)</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-300">SMAP (9km root moisture)</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-300">MODIS (250m NDVI)</span>
          <span aria-hidden="true">·</span>
          <span className="text-cyan-300">ECOSTRESS (70m canopy heat)</span>
          <span aria-hidden="true">·</span>
          <span className="text-slate-200">SRTM (30m elevation)</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-400 font-semibold">Farmer Ground-Truth (1m pH & crops)</span>
        </div>
      </div>
    </section>
  );
};
