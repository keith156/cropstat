import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  MapPin,
  Plus,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Sun,
} from 'lucide-react';
import {
  CROP_OPTIONS,
  PRIORITY_OPTIONS,
  REGIONAL_PRESETS,
  SOIL_TEXTURE_OPTIONS,
} from '../data/presets';
import type {
  CalibrationQuestion,
  CropStage,
  FarmContext,
  MonthlyCropPlan,
  NasaTelemetryPayload,
  RegionalPreset,
  RotationStrategy,
  SoilTexture,
  StressTestResult,
} from '../types/agro';
import { computePhWarnings, parseAndValidateCoordinates } from '../utils/agroCalculations';

interface FarmerSimpleFlowProps {
  farm: FarmContext;
  telemetry: NasaTelemetryPayload | null;
  isLoadingTelemetry: boolean;
  calibrationQuestions: CalibrationQuestion[];
  calibrationAnswers: Record<string, string>;
  isLoadingCalibration: boolean;
  strategies: RotationStrategy[];
  isGeneratingStrategies: boolean;
  stressResults: Record<string, StressTestResult>;
  tempDeltaC: number;
  rainDeltaPct: number;
  activeStep: 1 | 2 | 3;
  onSetStep: (step: 1 | 2 | 3) => void;
  onSelectPreset: (preset: RegionalPreset) => void;
  onSelectCoordinates: (lat: number, lon: number, customLabel?: string) => void;
  onUpdateFarm: (patch: Partial<FarmContext>) => void;
  onRunCalibration: () => void;
  onChangeAnswer: (questionId: string, value: string) => void;
  onSubmitCalibration: () => void;
  onChangeStressScenario: (tempDeltaC: number, rainDeltaPct: number) => void;
}

const fieldPinIcon = L.divIcon({
  className: 'cropshift-map-pin',
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#10b981;border:3px solid #080c0b;box-shadow:0 0 0 2px rgba(16,185,129,0.55);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FarmerMapLayer({
  lat,
  lon,
  targetZoom,
  onSelectCoordinates,
}: {
  lat: number;
  lon: number;
  targetZoom: number | null;
  onSelectCoordinates: (lat: number, lon: number, customLabel?: string) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const zoom = targetZoom ?? (map.getZoom() < 5 ? 7 : map.getZoom());
    map.setView([lat, lon], zoom, { animate: true });
  }, [lat, lon, targetZoom, map]);

  useMapEvents({
    click(e) {
      onSelectCoordinates(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)));
    },
  });

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const pos = marker.getLatLng();
          onSelectCoordinates(Number(pos.lat.toFixed(4)), Number(pos.lng.toFixed(4)));
        }
      },
    }),
    [onSelectCoordinates],
  );

  return (
    <Marker
      ref={markerRef}
      position={[lat, lon]}
      icon={fieldPinIcon}
      draggable={true}
      eventHandlers={eventHandlers}
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
        <span className="text-xs font-medium">Your Farm Pin</span>
      </Tooltip>
    </Marker>
  );
}

const STAGE_BADGE: Record<CropStage, { dot: string; label: string; text: string }> = {
  Planting: { dot: 'bg-sky-400', label: 'Plant', text: 'text-sky-300' },
  Growing: { dot: 'bg-emerald-400', label: 'Grow', text: 'text-emerald-300' },
  Harvest: { dot: 'bg-amber-400', label: 'Harvest', text: 'text-amber-300' },
  'Cover Crop': { dot: 'bg-teal-400', label: 'Cover Soil', text: 'text-teal-300' },
  'Bare Soil': { dot: 'bg-rose-400', label: 'Bare Dirt', text: 'text-rose-300' },
};

interface GroupedPhase {
  range: string;
  cropName: string;
  stage: CropStage;
}

function groupCalendarIntoPhases(calendar: MonthlyCropPlan[]): GroupedPhase[] {
  const groups: Array<{ startMonth: string; endMonth: string; cropName: string; stage: CropStage }> = [];

  for (const item of calendar) {
    const last = groups[groups.length - 1];
    if (last && last.stage === item.stage && last.cropName === item.cropName) {
      last.endMonth = item.month;
    } else {
      groups.push({
        startMonth: item.month,
        endMonth: item.month,
        cropName: item.cropName,
        stage: item.stage,
      });
    }
  }

  return groups.map((g) => ({
    range: g.startMonth === g.endMonth ? g.startMonth : `${g.startMonth}–${g.endMonth}`,
    cropName: g.cropName,
    stage: g.stage,
  }));
}

const TEXTURE_LABELS: Record<SoilTexture, string> = {
  Clay: 'Sticky Clay',
  Loamy: 'Rich Loam',
  Sandy: 'Loose Sandy',
  'Volcanic Ash': 'Dark Volcanic',
};

const PRIORITY_LABELS: Record<string, string> = {
  'Conserve Water': 'Save Water',
  'Fix Nitrogen': 'Build Rich Soil',
  'Stop Slope Erosion': 'Stop Wash-Away',
  'Break Pest Cycles': 'Keep Pests Away',
  'High Cash Income': 'Good Cash Income',
  'Livestock Forage': 'Livestock Feed',
};

export const FarmerSimpleFlow: React.FC<FarmerSimpleFlowProps> = ({
  farm,
  telemetry,
  isLoadingTelemetry,
  calibrationQuestions,
  calibrationAnswers,
  isLoadingCalibration,
  strategies,
  isGeneratingStrategies,
  stressResults,
  tempDeltaC,
  rainDeltaPct,
  activeStep,
  onSetStep,
  onSelectPreset,
  onSelectCoordinates,
  onUpdateFarm,
  onRunCalibration,
  onChangeAnswer,
  onSubmitCalibration,
  onChangeStressScenario,
}) => {
  const [customCrop, setCustomCrop] = useState('');
  const [latInput, setLatInput] = useState(farm.lat.toFixed(4));
  const [lonInput, setLonInput] = useState(farm.lon.toFixed(4));
  const [coordError, setCoordError] = useState<string | null>(null);
  const [mapZoomHint, setMapZoomHint] = useState<number | null>(null);
  const [showSoilAdjust, setShowSoilAdjust] = useState(false);
  const [expandedStrategyIds, setExpandedStrategyIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLatInput(farm.lat.toFixed(4));
    setLonInput(farm.lon.toFixed(4));
    setCoordError(null);
  }, [farm.lat, farm.lon]);

  const phWarning = useMemo(() => computePhWarnings(farm.soilPh, 'farmer'), [farm.soilPh]);

  const elevationLabel =
    farm.altitude < 600
      ? 'Flat Lowland'
      : farm.altitude < 1500
        ? 'Mid Hills'
        : farm.altitude < 2300
          ? 'Highland Slope'
          : 'High Mountains';

  const sourLabel =
    farm.soilPh < 5.0
      ? 'Very Sour'
      : farm.soilPh < 5.5
        ? 'Slightly Sour'
        : farm.soilPh <= 7.2
          ? 'Balanced Soil'
          : farm.soilPh <= 7.7
            ? 'Slightly Chalky'
            : 'Very Chalky';

  const allCropsList = useMemo(() => {
    const extras = farm.currentCrops.filter((c) => !CROP_OPTIONS.includes(c));
    return [...CROP_OPTIONS, ...extras];
  }, [farm.currentCrops]);

  const handleCoordinateJump = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseAndValidateCoordinates(latInput, lonInput);
    if (!parsed.ok) {
      setCoordError(parsed.error);
      return;
    }
    setCoordError(null);
    setMapZoomHint(12);
    onSelectCoordinates(parsed.lat, parsed.lon);
  };

  const toggleCrop = (crop: string) => {
    const exists = farm.currentCrops.includes(crop);
    const next = exists
      ? farm.currentCrops.filter((c) => c !== crop)
      : [...farm.currentCrops, crop];
    onUpdateFarm({ currentCrops: next.length > 0 ? next : [crop] });
  };

  const handleAddCustomCrop = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customCrop.trim();
    if (!cleaned) return;
    if (!farm.currentCrops.includes(cleaned)) {
      onUpdateFarm({ currentCrops: [...farm.currentCrops, cleaned] });
    }
    setCustomCrop('');
  };

  const togglePriority = (priority: string) => {
    const exists = farm.priorities.includes(priority);
    const next = exists
      ? farm.priorities.filter((p) => p !== priority)
      : [...farm.priorities, priority];
    onUpdateFarm({ priorities: next.length > 0 ? next : [priority] });
  };

  const allAnswered =
    calibrationQuestions.length > 0 &&
    calibrationQuestions.every((q) => (calibrationAnswers[q.id] ?? '').trim().length > 0);

  const weatherSummary = useMemo(() => {
    if (!telemetry) return null;
    const rainText =
      telemetry.gpmSeasonality === 'Bimodal'
        ? 'Two rainy seasons a year'
        : telemetry.gpmSeasonality === 'Unimodal'
          ? 'One main rainy season'
          : 'Low rainfall area';

    const soilWatchText =
      telemetry.bareSoilDangerMonths.length > 0
        ? `Heavy rain hits bare dirt in ${telemetry.bareSoilDangerMonths.join(', ')}`
        : 'Soil stays well protected';

    const dryText =
      telemetry.smapDryMonths.length > 0
        ? `Dry months: ${telemetry.smapDryMonths.join(', ')}`
        : 'Soil holds water most of the year';

    return { rainText, soilWatchText, dryText };
  }, [telemetry]);

  const activeScenario =
    tempDeltaC === 0 && rainDeltaPct === 0
      ? 'normal'
      : rainDeltaPct < 0
        ? 'drought'
        : 'storm';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Simple 3-Step Progress Bar */}
      <nav aria-label="Simple Farm Steps" className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { step: 1 as const, label: '1. Your Farm', enabled: true },
          { step: 2 as const, label: '2. Quick Questions', enabled: calibrationQuestions.length > 0 },
          { step: 3 as const, label: '3. Simple Crop Plans', enabled: strategies.length > 0 },
        ].map((item) => {
          const isCurrent = activeStep === item.step;
          return (
            <button
              key={item.step}
              type="button"
              disabled={!item.enabled}
              onClick={() => item.enabled && onSetStep(item.step)}
              className={`px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors text-center ${
                isCurrent
                  ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200 font-semibold'
                  : item.enabled
                    ? 'bg-[#0e1513] border-[#1f2e29] text-slate-300 hover:border-emerald-700 cursor-pointer'
                    : 'bg-[#0b110f] border-[#17221e] text-slate-600 cursor-not-allowed'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* STEP 1: YOUR FARM */}
      {activeStep === 1 && (
        <section
          id="map-and-soil"
          aria-label="Step 1: Your Farm"
          className="bg-[#0e1513] border border-[#1f2e29] rounded-2xl p-6 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b2924] pb-4">
            <div>
              <p className="text-xs font-medium text-emerald-400">Step 1 of 3</p>
              <h2 className="text-xl font-semibold text-slate-100 mt-0.5">
                Where Is Your Farm &amp; What Do You Grow?
              </h2>
            </div>
            <span className="text-xs text-slate-400">{farm.locationName}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Location, Coordinates, and Map */}
            <div className="lg:col-span-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    Sample Farm Regions
                  </span>
                  <span className="text-xs text-slate-500">Or tap the map</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {REGIONAL_PRESETS.map((preset) => {
                    const isActive =
                      Math.abs(farm.lat - preset.lat) < 0.02 &&
                      Math.abs(farm.lon - preset.lon) < 0.02;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setMapZoomHint(7);
                          onSelectPreset(preset);
                        }}
                        className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors truncate cursor-pointer ${
                          isActive
                            ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-200 font-semibold'
                            : 'bg-[#121c19] border-[#21312c] text-slate-300 hover:border-emerald-700/70 hover:text-white'
                        }`}
                      >
                        {preset.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Coordinates */}
              <div className="space-y-1.5">
                <form onSubmit={handleCoordinateJump} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor="lat-input" className="block text-[11px] text-slate-400 mb-1">
                      Latitude
                    </label>
                    <input
                      id="lat-input"
                      type="text"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      placeholder="0.3476"
                      className="w-full bg-[#121c19] border border-[#22322d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="lon-input" className="block text-[11px] text-slate-400 mb-1">
                      Longitude
                    </label>
                    <input
                      id="lon-input"
                      type="text"
                      value={lonInput}
                      onChange={(e) => setLonInput(e.target.value)}
                      placeholder="32.5825"
                      className="w-full bg-[#121c19] border border-[#22322d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-[#16231f] border border-[#293d37] text-xs font-medium text-cyan-300 hover:bg-[#1c2d28] whitespace-nowrap cursor-pointer"
                  >
                    Go to Pin
                  </button>
                </form>
                {coordError && (
                  <p role="alert" className="text-xs text-rose-300">
                    {coordError}
                  </p>
                )}
              </div>

              {/* Map */}
              <div className="relative rounded-xl overflow-hidden border border-[#22322d] h-56 w-full">
                <MapContainer
                  center={[farm.lat, farm.lon]}
                  zoom={7}
                  scrollWheelZoom={true}
                  className="h-full w-full z-0"
                >
                  <TileLayer
                    attribution="Tiles &copy; Esri"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                  <FarmerMapLayer
                    lat={farm.lat}
                    lon={farm.lon}
                    targetZoom={mapZoomHint}
                    onSelectCoordinates={(lat, lon, label) => {
                      setMapZoomHint(null);
                      onSelectCoordinates(lat, lon, label);
                    }}
                  />
                </MapContainer>
                <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[400] bg-[#080c0b]/90 border border-[#22322d] px-2.5 py-1 rounded text-[11px] text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                  <span>
                    {isLoadingTelemetry
                      ? 'Checking weather & soil...'
                      : 'Tap map or drag pin to your farm'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Simple Crops, Goals, and Clean 1-Box Weather Summary */}
            <div className="lg:col-span-6 space-y-5">
              {/* Current Crops */}
              <div>
                <span className="block text-sm font-medium text-slate-100 mb-2">
                  What Crops Do You Grow Now?
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {allCropsList.map((crop) => {
                    const selected = farm.currentCrops.includes(crop);
                    return (
                      <button
                        key={crop}
                        type="button"
                        onClick={() => toggleCrop(crop)}
                        aria-pressed={selected}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                          selected
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
                            : 'bg-[#121c19] border-[#22322d] text-slate-300 hover:border-emerald-700'
                        }`}
                      >
                        {crop}
                      </button>
                    );
                  })}
                </div>
                <form onSubmit={handleAddCustomCrop} className="mt-2.5 flex gap-2">
                  <input
                    type="text"
                    value={customCrop}
                    onChange={(e) => setCustomCrop(e.target.value)}
                    placeholder="Add another crop (e.g. Millet, Kale)"
                    aria-label="Add custom crop"
                    className="flex-1 bg-[#121c19] border border-[#22322d] rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-[#16231f] border border-[#293d37] text-xs font-medium text-emerald-300 hover:bg-[#1c2d28] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Add
                  </button>
                </form>
              </div>

              {/* Simple Goals */}
              <div>
                <span className="block text-sm font-medium text-slate-100 mb-2">
                  What Matters Most to You?
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITY_OPTIONS.map((priority) => {
                    const selected = farm.priorities.includes(priority);
                    return (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => togglePriority(priority)}
                        aria-pressed={selected}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                          selected
                            ? 'bg-cyan-500/20 border-cyan-400/80 text-cyan-200 font-medium'
                            : 'bg-[#121c19] border-[#22322d] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        {PRIORITY_LABELS[priority] ?? priority}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clean 1-Card Field & Weather Check (Zero Statistics) */}
              <div
                id="telemetry"
                className="bg-[#111a17] border border-[#22322d] rounded-xl p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <CloudRain className="w-3.5 h-3.5" aria-hidden="true" />
                    Quick Look at Your Land
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSoilAdjust((prev) => !prev)}
                    className="text-xs text-slate-300 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
                    <span>{showSoilAdjust ? 'Hide soil options' : 'Adjust land or soil'}</span>
                  </button>
                </div>

                {isLoadingTelemetry || !weatherSummary ? (
                  <p className="text-xs text-slate-400">Checking rain and soil for your farm...</p>
                ) : (
                  <div className="text-xs text-slate-300 space-y-1 leading-relaxed">
                    <p>
                      <strong className="text-slate-100">Weather:</strong> {weatherSummary.rainText} · {weatherSummary.dryText}.
                    </p>
                    <p>
                      <strong className="text-slate-100">Soil Watch-Out:</strong> {weatherSummary.soilWatchText}.
                    </p>
                    <p className="text-slate-400">
                      Land: {elevationLabel} · {sourLabel} · {TEXTURE_LABELS[farm.soilTexture]}
                    </p>
                  </div>
                )}

                {/* Optional expandable simple soil adjusters */}
                {showSoilAdjust && (
                  <div className="pt-3 border-t border-[#1e2d28] space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <label htmlFor="farmer-alt-slider" className="text-slate-300">Land Height</label>
                        <span className="text-cyan-300 font-medium">{elevationLabel}</span>
                      </div>
                      <input
                        id="farmer-alt-slider"
                        type="range"
                        min={0}
                        max={3500}
                        step={50}
                        value={farm.altitude}
                        onChange={(e) => onUpdateFarm({ altitude: Number(e.target.value) })}
                        className="terra-slider w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <label htmlFor="farmer-ph-slider" className="text-slate-300">Soil Sourness</label>
                        <span className="text-emerald-300 font-medium">{sourLabel}</span>
                      </div>
                      <input
                        id="farmer-ph-slider"
                        type="range"
                        min={4.0}
                        max={8.5}
                        step={0.1}
                        value={farm.soilPh}
                        onChange={(e) => onUpdateFarm({ soilPh: Number(e.target.value) })}
                        className="terra-slider w-full"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">{phWarning.detail}</p>
                    </div>

                    <div>
                      <span className="block text-xs text-slate-300 mb-1.5">Soil Feel</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {SOIL_TEXTURE_OPTIONS.map((texture) => (
                          <button
                            key={texture}
                            type="button"
                            onClick={() => onUpdateFarm({ soilTexture: texture })}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                              farm.soilTexture === texture
                                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-medium'
                                : 'bg-[#0d1512] border-[#21312c] text-slate-300'
                            }`}
                          >
                            {TEXTURE_LABELS[texture]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#1b2924] flex justify-end">
            <button
              type="button"
              onClick={onRunCalibration}
              disabled={!telemetry || isLoadingTelemetry || isLoadingCalibration}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-950 disabled:text-slate-500 text-slate-950 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>
                {isLoadingCalibration ? 'Preparing Questions...' : 'Next: Answer 3 Simple Questions'}
              </span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 2: 3 SIMPLE QUESTIONS */}
      {activeStep === 2 && (
        <section
          id="calibration"
          aria-label="Step 2: 3 Simple Questions"
          className="bg-[#0e1513] border border-emerald-800/60 rounded-2xl p-6 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b2924] pb-4">
            <div>
              <p className="text-xs font-medium text-emerald-400">Step 2 of 3</p>
              <h2 className="text-xl font-semibold text-slate-100 mt-0.5">
                Answer 3 Quick Questions About Your Land
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Tap the option closest to what happens on your farm, or type your own short answer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSetStep(1)}
              className="px-3 py-1.5 rounded-lg border border-[#22322d] bg-[#121c19] text-xs text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back to My Farm
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {calibrationQuestions.map((q, index) => {
              const currentAnswer = calibrationAnswers[q.id] ?? '';
              return (
                <div
                  key={q.id}
                  className="bg-[#111a17] border border-[#22322d] rounded-xl p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-emerald-400">
                      Question {index + 1} of {calibrationQuestions.length}
                    </span>
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
                            className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
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

                    <input
                      id={`custom-${q.id}`}
                      type="text"
                      value={currentAnswer}
                      onChange={(e) => onChangeAnswer(q.id, e.target.value)}
                      placeholder="Or write your own short answer..."
                      aria-label={`Custom answer for question ${index + 1}`}
                      className="w-full bg-[#0a100e] border border-[#243630] rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              {allAnswered
                ? 'All 3 answered — ready to show your crop plans!'
                : 'Pick or write an answer for all 3 questions to continue.'}
            </p>
            <button
              type="button"
              onClick={onSubmitCalibration}
              disabled={!allAnswered || isGeneratingStrategies}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-950/60 disabled:text-slate-500 text-slate-950 font-semibold text-sm transition-colors flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>
                {isGeneratingStrategies ? 'Making Your Simple Crop Plans...' : 'See My Simple Crop Plans'}
              </span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: SIMPLIFIED CROP PLANS */}
      {activeStep === 3 && (
        <section
          id="strategies"
          aria-label="Step 3: Simple Crop Plans"
          className="space-y-5"
        >
          <div className="bg-[#0e1513] border border-[#1f2e29] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-emerald-400">Step 3 of 3 · {farm.locationName}</p>
              <h2 className="text-xl font-semibold text-slate-100 mt-0.5">
                Your 3 Simple Planting Plans
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSetStep(2)}
                className="px-3 py-1.5 rounded-lg border border-[#22322d] bg-[#121c19] text-xs text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                Change Answers
              </button>
              <button
                type="button"
                onClick={() => onSetStep(1)}
                className="px-3 py-1.5 rounded-lg border border-[#22322d] bg-[#121c19] text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Pick Another Farm
              </button>
            </div>
          </div>

          {/* Simple 3-Button Weather Test (Replaces Sliders & Sticky Bar) */}
          <div
            id="stress-test"
            className="bg-[#0e1513] border border-[#1f2e29] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          >
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              Check how these plans handle bad weather:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'normal', label: 'Normal Weather', temp: 0, rain: 0 },
                { id: 'drought', label: 'Hot & Dry Year', temp: 2.6, rain: -30 },
                { id: 'storm', label: 'Heavy Rain Year', temp: 0.8, rain: 25 },
              ].map((opt) => {
                const isSelected = activeScenario === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeStressScenario(opt.temp, opt.rain)}
                    aria-pressed={isSelected}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-[#121c19] border-[#22322d] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 Clean, Uncluttered Planting Plan Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {strategies.map((strategy) => {
              const stress = stressResults[strategy.id];
              const isExpanded = !!expandedStrategyIds[strategy.id];
              const phases = groupCalendarIntoPhases(strategy.monthlyCalendar);

              const badgeLabel =
                strategy.badgeColor === 'emerald'
                  ? 'Best for Soil & Water'
                  : strategy.badgeColor === 'cyan'
                    ? 'Good Cash & Hardy'
                    : 'Your Current Way';

              const badgeStyle =
                strategy.badgeColor === 'emerald'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-600/60'
                  : strategy.badgeColor === 'cyan'
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-600/60'
                    : 'bg-amber-500/15 text-amber-300 border-amber-600/60';

              return (
                <article
                  key={strategy.id}
                  data-testid={`strategy-card-${strategy.id}`}
                  className={`bg-[#0e1513] border rounded-2xl p-5 space-y-4 ${
                    strategy.badgeColor === 'emerald'
                      ? 'border-emerald-600/70'
                      : 'border-[#1f2e29]'
                  }`}
                >
                  <div className="space-y-2">
                    <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${badgeStyle}`}>
                      {badgeLabel}
                    </span>
                    <h3 className="text-base font-semibold text-slate-100 leading-snug">
                      {strategy.name}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {strategy.whySuggested}
                    </p>
                  </div>

                  {/* Weather Check Result Pill (only shown when testing bad weather) */}
                  {activeScenario !== 'normal' && stress && (
                    <div
                      className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
                        stress.survivalStatus === 'Critical Risk'
                          ? 'bg-rose-950/35 border-rose-800/70 text-rose-200'
                          : stress.survivalStatus === 'Strained'
                            ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                            : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                      }`}
                    >
                      {stress.survivalStatus === 'Resilient' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                      )}
                      <span className="font-medium">
                        {stress.survivalStatus === 'Resilient'
                          ? 'Holds up well in tough weather'
                          : stress.survivalStatus === 'Strained'
                            ? 'Needs extra mulch to hold moisture'
                            : 'High risk of losing harvest'}
                      </span>
                    </div>
                  )}

                  {/* Simple Year-Round Planting Guide */}
                  <div className="bg-[#111a17] border border-[#202f2a] rounded-xl p-3.5 space-y-2.5">
                    <p className="text-xs font-semibold text-slate-200">What to Do Through the Year</p>
                    <ul className="space-y-2">
                      {phases.map((phase, i) => {
                        const st = STAGE_BADGE[phase.stage] ?? STAGE_BADGE.Growing;
                        return (
                          <li key={`${strategy.id}-phase-${i}`} className="flex items-start gap-2.5 text-xs">
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${st.dot}`} aria-hidden="true" />
                            <div className="leading-snug">
                              <span className="font-semibold text-slate-100 mr-1.5">{phase.range}:</span>
                              <span className="text-slate-300">{phase.cropName}</span>
                              <span className={`ml-1.5 text-[11px] ${st.text}`}>({st.label})</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Plain Benefits */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-emerald-300">Why This Helps</p>
                    <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                      {strategy.nasaEvidenceUsed.slice(0, 3).map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Expandable Extra Details */}
                  <div className="border-t border-[#1b2924] pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedStrategyIds((prev) => ({
                          ...prev,
                          [strategy.id]: !prev[strategy.id],
                        }))
                      }
                      className="w-full flex items-center justify-between text-xs font-medium text-slate-300 hover:text-emerald-300 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide soil & checklist' : 'See soil care & things to check'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-2.5 text-xs text-slate-300 leading-relaxed">
                        <div>
                          <span className="font-semibold text-emerald-300 block">Soil &amp; Fertility:</span>
                          <span>{strategy.soilAndAgronomicMechanics.nitrogenCycling}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-emerald-300 block">Pests:</span>
                          <span>{strategy.soilAndAgronomicMechanics.pestCycleDisruption}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-amber-300 block">Check Locally:</span>
                          <ul className="list-disc pl-4 space-y-1 mt-1">
                            {strategy.informationGapsAndRisks.map((gap, i) => (
                              <li key={i}>{gap}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
