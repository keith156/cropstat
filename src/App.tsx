import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, RefreshCw, Satellite, Sprout } from 'lucide-react';
import { REGIONAL_PRESETS } from './data/presets';
import { checkAiHealth, generateCalibrationQuestions, generateRotationStrategies } from './services/geminiAdvisorService';
import { fetchNasaTelemetry, recomputeTelemetryWithGroundTruth } from './services/nasaTelemetryService';
import type {
  CalibrationAnswer,
  CalibrationQuestion,
  FarmContext,
  LanguageMode,
  NasaTelemetryPayload,
  RegionalPreset,
  RotationStrategy,
  StressTestResult,
} from './types/agro';
import { evaluateClimateStressTest } from './utils/agroCalculations';
import { FarmMapAndInputs } from './components/FarmMapAndInputs';
import { NasaTelemetryDashboard } from './components/NasaTelemetryDashboard';
import { CalibrationQuestionsModal } from './components/CalibrationQuestionsModal';
import { RotationComparisonMatrix } from './components/RotationComparisonMatrix';
import { ClimateStressTester } from './components/ClimateStressTester';
import { FarmerSimpleFlow } from './components/FarmerSimpleFlow';

const INITIAL_PRESET = REGIONAL_PRESETS[0];

export default function App() {
  const [languageMode, setLanguageMode] = useState<LanguageMode>('farmer');
  const [farm, setFarm] = useState<FarmContext>({
    locationName: INITIAL_PRESET.name,
    lat: INITIAL_PRESET.lat,
    lon: INITIAL_PRESET.lon,
    altitude: INITIAL_PRESET.defaultAltitude,
    soilPh: INITIAL_PRESET.defaultPh,
    soilTexture: INITIAL_PRESET.defaultTexture,
    currentCrops: INITIAL_PRESET.defaultCrops,
    priorities: INITIAL_PRESET.defaultPriorities,
  });

  // Base fetched satellite telemetry (raw monthly POWER + SRTM + SoilGrids)
  const [baseTelemetry, setBaseTelemetry] = useState<NasaTelemetryPayload | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(true);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(false);

  // Stage A: Calibration Questions
  const [calibrationQuestions, setCalibrationQuestions] = useState<CalibrationQuestion[]>([]);
  const [calibrationAnswers, setCalibrationAnswers] = useState<Record<string, string>>({});
  const [isLoadingCalibration, setIsLoadingCalibration] = useState<boolean>(false);
  const [calibrationSourceLabel, setCalibrationSourceLabel] = useState<string>('');

  // Stage B: 3 Rotation Strategies + Stress Test Sliders
  const [strategies, setStrategies] = useState<RotationStrategy[]>([]);
  const [isGeneratingStrategies, setIsGeneratingStrategies] = useState<boolean>(false);
  const [strategySourceLabel, setStrategySourceLabel] = useState<string>('');
  const [tempDeltaC, setTempDeltaC] = useState<number>(0);
  const [rainDeltaPct, setRainDeltaPct] = useState<number>(0);
  const [farmerStep, setFarmerStep] = useState<1 | 2 | 3>(1);

  const calibrationRef = useRef<HTMLDivElement | null>(null);
  const strategiesRef = useRef<HTMLDivElement | null>(null);

  // Check backend AI availability once on mount
  useEffect(() => {
    checkAiHealth().then((res) => setGeminiConfigured(res.geminiConfigured));
  }, []);

  // Fetch NASA POWER + SRTM + SoilGrids whenever coordinates change
  const loadLocationTelemetry = useCallback(
    async (
      lat: number,
      lon: number,
      crops: string[],
      presetDefaults?: RegionalPreset,
    ) => {
      setIsLoadingTelemetry(true);
      try {
        const payload = await fetchNasaTelemetry({
          lat,
          lon,
          currentCrops: crops,
          overrideAltitude: presetDefaults?.defaultAltitude,
          overridePh: presetDefaults?.defaultPh,
          overrideTexture: presetDefaults?.defaultTexture,
        });
        setBaseTelemetry(payload);

        // Auto-populate Altitude, Soil pH, and Texture from SRTM + SoilGrids when clicking arbitrary map pins
        if (!presetDefaults) {
          setFarm((prev) => ({
            ...prev,
            altitude: payload.srtmAltitudeM,
            soilPh: payload.soilGridsPh,
            soilTexture: payload.soilGridsTexture,
          }));
        }
      } finally {
        setIsLoadingTelemetry(false);
      }
    },
    [],
  );

  // Initial load for Wakiso, Uganda preset
  useEffect(() => {
    loadLocationTelemetry(
      INITIAL_PRESET.lat,
      INITIAL_PRESET.lon,
      INITIAL_PRESET.defaultCrops,
      INITIAL_PRESET,
    );
  }, [loadLocationTelemetry]);

  // Live recomputed telemetry whenever farmer adjusts Altitude, Soil pH, Texture, or Crops
  const effectiveTelemetry = useMemo<NasaTelemetryPayload | null>(() => {
    if (!baseTelemetry) return null;
    return recomputeTelemetryWithGroundTruth(
      baseTelemetry,
      farm.altitude,
      farm.soilPh,
      farm.soilTexture,
      farm.currentCrops,
    );
  }, [baseTelemetry, farm.altitude, farm.soilPh, farm.soilTexture, farm.currentCrops]);

  const handleSelectPreset = (preset: RegionalPreset) => {
    setFarm({
      locationName: preset.name,
      lat: preset.lat,
      lon: preset.lon,
      altitude: preset.defaultAltitude,
      soilPh: preset.defaultPh,
      soilTexture: preset.defaultTexture,
      currentCrops: preset.defaultCrops,
      priorities: preset.defaultPriorities,
    });
    setCalibrationQuestions([]);
    setCalibrationAnswers({});
    setStrategies([]);
    setTempDeltaC(0);
    setRainDeltaPct(0);
    setFarmerStep(1);
    loadLocationTelemetry(preset.lat, preset.lon, preset.defaultCrops, preset);
  };

  const handleSelectCoordinates = (lat: number, lon: number, customLabel?: string) => {
    setFarm((prev) => ({
      ...prev,
      locationName: customLabel || `Custom Field (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`,
      lat,
      lon,
    }));
    setCalibrationQuestions([]);
    setCalibrationAnswers({});
    setStrategies([]);
    setTempDeltaC(0);
    setRainDeltaPct(0);
    setFarmerStep(1);
    loadLocationTelemetry(lat, lon, farm.currentCrops);
  };

  const handleUpdateFarm = (patch: Partial<FarmContext>) => {
    setFarm((prev) => ({ ...prev, ...patch }));
  };

  const handleRunCalibration = async () => {
    if (!effectiveTelemetry) return;
    setIsLoadingCalibration(true);
    setStrategies([]);
    try {
      const res = await generateCalibrationQuestions(farm, effectiveTelemetry, languageMode);
      setCalibrationQuestions(res.questions);
      // Pre-seed empty or retain matching keys
      const nextAnswers: Record<string, string> = {};
      for (const q of res.questions) {
        nextAnswers[q.id] = '';
      }
      setCalibrationAnswers(nextAnswers);
      setCalibrationSourceLabel(
        res.source === 'gemini'
          ? `Gemini AI (${res.modelUsed})`
          : 'Agronomic Calibration Engine',
      );
      setFarmerStep(2);
      setTimeout(() => {
        calibrationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    } finally {
      setIsLoadingCalibration(false);
    }
  };

  const handleSubmitCalibration = async () => {
    if (!effectiveTelemetry || calibrationQuestions.length === 0) return;
    setIsGeneratingStrategies(true);
    try {
      const formattedAnswers: CalibrationAnswer[] = calibrationQuestions.map((q) => ({
        questionId: q.id,
        question: q.question,
        answer: (calibrationAnswers[q.id] ?? '').trim() || q.quickOptions[0],
      }));
      const res = await generateRotationStrategies(farm, effectiveTelemetry, formattedAnswers, languageMode);
      setStrategies(res.strategies);
      setStrategySourceLabel(
        res.source === 'gemini'
          ? `Gemini AI (${res.modelUsed})`
          : 'Agronomic Synthesis Engine',
      );
      setTempDeltaC(0);
      setRainDeltaPct(0);
      setFarmerStep(3);
      setTimeout(() => {
        strategiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    } finally {
      setIsGeneratingStrategies(false);
    }
  };

  const stressResults = useMemo<Record<string, StressTestResult>>(() => {
    if (!effectiveTelemetry || strategies.length === 0) return {};
    const out: Record<string, StressTestResult> = {};
    for (const strat of strategies) {
      out[strat.id] = evaluateClimateStressTest(strat, effectiveTelemetry, tempDeltaC, rainDeltaPct);
    }
    return out;
  }, [effectiveTelemetry, strategies, tempDeltaC, rainDeltaPct]);

  const isShockActive = tempDeltaC !== 0 || rainDeltaPct !== 0;

  return (
    <div className="min-h-screen bg-[#080c0b] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="border-b border-[#1b2924] bg-[#0a100e]/95 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0"
          >
            Crop Stat
          </a>

          {languageMode === 'farmer' ? (
            <nav aria-label="Workspace Sections" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
              <button
                type="button"
                onClick={() => setFarmerStep(1)}
                className={`hover:text-emerald-300 transition-colors whitespace-nowrap cursor-pointer ${farmerStep === 1 ? 'text-emerald-300 font-semibold' : ''}`}
              >
                Your Farm
              </button>
              <button
                type="button"
                disabled={calibrationQuestions.length === 0}
                onClick={() => setFarmerStep(2)}
                className={`hover:text-emerald-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer ${farmerStep === 2 ? 'text-emerald-300 font-semibold' : ''}`}
              >
                Questions
              </button>
              <button
                type="button"
                disabled={strategies.length === 0}
                onClick={() => setFarmerStep(3)}
                className={`hover:text-emerald-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer ${farmerStep === 3 ? 'text-emerald-300 font-semibold' : ''}`}
              >
                Crop Plans
              </button>
            </nav>
          ) : (
            <nav aria-label="Workspace Sections" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
              <a href="#map-and-soil" className="hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0">
                Map &amp; Soil
              </a>
              <a href="#telemetry" className="hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0">
                Telemetry
              </a>
              <a href="#calibration" className="hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0">
                Calibration
              </a>
              <a href="#strategies" className="hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0">
                Strategies
              </a>
            </nav>
          )}

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleRunCalibration}
              disabled={!effectiveTelemetry || isLoadingTelemetry || isLoadingCalibration}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-950 disabled:text-slate-500 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoadingCalibration
                ? (languageMode === 'farmer' ? 'Checking...' : 'Analyzing...')
                : (languageMode === 'farmer' ? 'Check My Field' : 'Analyze Field')}
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Mode & Mission Telemetry Ribbon */}
      <div id="top" className="border-b border-[#16221e] bg-[#0b1210]">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h1 className="text-base sm:text-lg font-semibold text-slate-100">
              {languageMode === 'farmer'
                ? 'Simple Crop & Soil Helper for Your Field'
                : 'NASA Earth Observation & Soil Resilience Co-Pilot'}
            </h1>
            <p className="text-xs text-slate-400">
              {languageMode === 'farmer'
                ? 'Answer 3 quick questions about your farm to get easy planting plans — no confusing statistics.'
                : 'Fusing NASA POWER (SMAP/GPM/ECOSTRESS), SRTM 30m DEM, ISRIC SoilGrids 250m & MODIS NDVI trajectories.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Farmer vs Scientist Mode Toggle */}
            <div
              role="group"
              aria-label="Language Mode Switch"
              className="flex flex-wrap items-center gap-1 p-1 bg-[#111a17] border border-[#22322d] rounded-lg max-w-full"
            >
              <button
                type="button"
                onClick={() => {
                  setLanguageMode('farmer');
                  if (strategies.length > 0) setFarmerStep(3);
                  else if (calibrationQuestions.length > 0) setFarmerStep(2);
                  else setFarmerStep(1);
                }}
                aria-pressed={languageMode === 'farmer'}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  languageMode === 'farmer'
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sprout className="w-3.5 h-3.5" aria-hidden="true" />
                Farmer Plain-Language
              </button>
              <button
                type="button"
                onClick={() => setLanguageMode('scientist')}
                aria-pressed={languageMode === 'scientist'}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  languageMode === 'scientist'
                    ? 'bg-cyan-400 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Satellite className="w-3.5 h-3.5" aria-hidden="true" />
                NASA Scientist Telemetry
              </button>
            </div>

            <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
              <Globe2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>
                {languageMode === 'farmer' ? (
                  <strong className="text-slate-200 font-sans">Field Helper Ready</strong>
                ) : (
                  <>
                    Co-Pilot:{' '}
                    <strong className="text-slate-200">
                      {geminiConfigured ? 'Gemini Connected' : 'Agro-Engine Ready'}
                    </strong>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => loadLocationTelemetry(farm.lat, farm.lon, farm.currentCrops)}
                disabled={isLoadingTelemetry}
                title={languageMode === 'farmer' ? 'Refresh field weather and soil info' : 'Refresh live NASA POWER & SRTM telemetry'}
                aria-label="Refresh satellite telemetry"
                className="p-1.5 rounded-md border border-[#22322d] bg-[#111a17] text-slate-300 hover:text-emerald-300 hover:border-emerald-700 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTelemetry ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Simple 3-Step Flow for Farmers vs Full Telemetry Grid for Scientists */}
      <main className="max-w-[1440px] w-full mx-auto px-5 sm:px-6 py-6 space-y-8 flex-1">
        {languageMode === 'farmer' ? (
          <FarmerSimpleFlow
            farm={farm}
            telemetry={effectiveTelemetry}
            isLoadingTelemetry={isLoadingTelemetry}
            calibrationQuestions={calibrationQuestions}
            calibrationAnswers={calibrationAnswers}
            isLoadingCalibration={isLoadingCalibration}
            strategies={strategies}
            isGeneratingStrategies={isGeneratingStrategies}
            stressResults={stressResults}
            tempDeltaC={tempDeltaC}
            rainDeltaPct={rainDeltaPct}
            activeStep={farmerStep}
            onSetStep={setFarmerStep}
            onSelectPreset={handleSelectPreset}
            onSelectCoordinates={handleSelectCoordinates}
            onUpdateFarm={handleUpdateFarm}
            onRunCalibration={handleRunCalibration}
            onChangeAnswer={(qId, val) =>
              setCalibrationAnswers((prev) => ({ ...prev, [qId]: val }))
            }
            onSubmitCalibration={handleSubmitCalibration}
            onChangeStressScenario={(nextTemp, nextRain) => {
              setTempDeltaC(nextTemp);
              setRainDeltaPct(nextRain);
            }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Map & Ground-Truth Builder */}
              <div className="lg:col-span-4 min-w-0">
                <FarmMapAndInputs
                  farm={farm}
                  telemetry={effectiveTelemetry}
                  isLoadingTelemetry={isLoadingTelemetry}
                  isLoadingCalibration={isLoadingCalibration}
                  languageMode={languageMode}
                  onSelectPreset={handleSelectPreset}
                  onSelectCoordinates={handleSelectCoordinates}
                  onUpdateFarm={handleUpdateFarm}
                  onRunCalibration={handleRunCalibration}
                />
              </div>

              {/* Right Column: NASA Telemetry & Bare-Soil Dashboard */}
              <div className="lg:col-span-8 min-w-0 space-y-6">
                <NasaTelemetryDashboard
                  telemetry={effectiveTelemetry}
                  isLoading={isLoadingTelemetry}
                  languageMode={languageMode}
                />

                {/* Prompt banner when calibration hasn't been triggered yet */}
                {calibrationQuestions.length === 0 && effectiveTelemetry && !isLoadingTelemetry && (
                  <div className="bg-[#0e1513] border border-[#1f2e29] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1 max-w-xl">
                      <h3 className="text-sm font-semibold text-slate-100">
                        Ready to Bridge Satellite Telemetry with Your Field Reality
                      </h3>
                      <p className="text-xs text-slate-400">
                        Click &ldquo;Analyze Field &amp; Calibrate with NASA Data&rdquo; to answer 3 hyper-specific diagnostic questions and generate 3 tailored crop rotation strategies.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunCalibration}
                      disabled={isLoadingCalibration}
                      className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isLoadingCalibration ? 'Calibrating...' : 'Start 3-Question Calibration'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Satellite-to-Ground Calibration Questions */}
            <div ref={calibrationRef}>
              <CalibrationQuestionsModal
                questions={calibrationQuestions}
                answers={calibrationAnswers}
                aiSourceLabel={calibrationSourceLabel}
                isGeneratingStrategies={isGeneratingStrategies}
                languageMode={languageMode}
                onChangeAnswer={(qId, val) =>
                  setCalibrationAnswers((prev) => ({ ...prev, [qId]: val }))
                }
                onSubmitAnswers={handleSubmitCalibration}
              />
            </div>

            {/* Step 4: Side-by-Side 3-Strategy Matrix + Live Climate Stress Tester */}
            <div ref={strategiesRef} className="space-y-5">
              <RotationComparisonMatrix
                strategies={strategies}
                stressResults={stressResults}
                isShockActive={isShockActive}
                aiSourceLabel={strategySourceLabel}
                languageMode={languageMode}
              />

              <ClimateStressTester
                tempDeltaC={tempDeltaC}
                rainDeltaPct={rainDeltaPct}
                strategies={strategies}
                stressResults={stressResults}
                languageMode={languageMode}
                onChangeTempDelta={setTempDeltaC}
                onChangeRainDelta={setRainDeltaPct}
                onReset={() => {
                  setTempDeltaC(0);
                  setRainDeltaPct(0);
                }}
              />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-[#16221e] bg-[#0a100e] mt-10">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {languageMode === 'farmer'
              ? 'Crop Stat · Simple Farm Planning Helper'
              : 'Crop Stat Agronomic Decision-Support Co-Pilot'}
          </span>
          <span>
            {languageMode === 'farmer'
              ? 'Local weather, rain & soil advice tailored to your field'
              : 'Data: NASA POWER · SMAP · GPM · ECOSTRESS · MODIS · SRTM · ISRIC SoilGrids'}
          </span>
        </div>
      </footer>
    </div>
  );
}
