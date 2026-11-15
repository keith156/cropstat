import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { AlertTriangle, CheckCircle2, Compass, Layers, MapPin, Plus, SlidersHorizontal, Sparkles } from 'lucide-react';
import {
  CROP_OPTIONS,
  PRIORITY_OPTIONS,
  REGIONAL_PRESETS,
  SOIL_TEXTURE_OPTIONS,
} from '../data/presets';
import type { FarmContext, LanguageMode, NasaTelemetryPayload, RegionalPreset, SoilTexture } from '../types/agro';
import { computePhWarnings, parseAndValidateCoordinates } from '../utils/agroCalculations';

interface FarmMapAndInputsProps {
  farm: FarmContext;
  telemetry: NasaTelemetryPayload | null;
  isLoadingTelemetry: boolean;
  isLoadingCalibration: boolean;
  languageMode: LanguageMode;
  onSelectPreset: (preset: RegionalPreset) => void;
  onSelectCoordinates: (lat: number, lon: number, customLabel?: string) => void;
  onUpdateFarm: (patch: Partial<FarmContext>) => void;
  onRunCalibration: () => void;
}

const fieldPinIcon = L.divIcon({
  className: 'cropshift-map-pin',
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#10b981;border:3px solid #080c0b;box-shadow:0 0 0 2px rgba(16,185,129,0.55);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapInteractionLayer({
  lat,
  lon,
  altitude,
  targetZoom,
  onSelectCoordinates,
}: {
  lat: number;
  lon: number;
  altitude: number;
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
        <span className="font-mono text-[11px]">
          {lat.toFixed(4)}°, {lon.toFixed(4)}° · {altitude}m
        </span>
      </Tooltip>
    </Marker>
  );
}

export const FarmMapAndInputs: React.FC<FarmMapAndInputsProps> = ({
  farm,
  telemetry,
  isLoadingTelemetry,
  isLoadingCalibration,
  languageMode,
  onSelectPreset,
  onSelectCoordinates,
  onUpdateFarm,
  onRunCalibration,
}) => {
  const [customCrop, setCustomCrop] = useState('');
  const [latInput, setLatInput] = useState(farm.lat.toFixed(4));
  const [lonInput, setLonInput] = useState(farm.lon.toFixed(4));
  const [coordError, setCoordError] = useState<string | null>(null);
  const [mapZoomHint, setMapZoomHint] = useState<number | null>(null);

  // Sync coordinate text inputs when preset, map click, or pin drag changes farm coords
  useEffect(() => {
    setLatInput(farm.lat.toFixed(4));
    setLonInput(farm.lon.toFixed(4));
    setCoordError(null);
  }, [farm.lat, farm.lon]);

  const phWarning = useMemo(() => computePhWarnings(farm.soilPh), [farm.soilPh]);

  const phPercent = ((farm.soilPh - 4.0) / (8.5 - 4.0)) * 100;

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

  const allCropsList = useMemo(() => {
    const extras = farm.currentCrops.filter((c) => !CROP_OPTIONS.includes(c));
    return [...CROP_OPTIONS, ...extras];
  }, [farm.currentCrops]);

  return (
    <section
      id="map-and-soil"
      aria-label="Field Location and Ground-Truth Parameters"
      className="scroll-mt-20 bg-[#0e1513] border border-[#1f2e29] rounded-xl p-5 flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b2924] pb-4">
        <div>
          <p className="text-xs font-mono text-emerald-400 tracking-wide">
            01. {languageMode === 'farmer' ? 'Select Your Field & Soil Conditions' : 'Geospatial Target & Ground-Truth Parameters'}
          </p>
          <h2 className="text-lg font-semibold text-slate-100 mt-0.5">
            {farm.locationName}
          </h2>
        </div>
        <div className="text-xs font-mono text-slate-400 tabular-nums">
          <span>{farm.lat.toFixed(4)}°</span>
          <span className="mx-1.5" aria-hidden="true">/</span>
          <span>{farm.lon.toFixed(4)}°</span>
        </div>
      </div>

      {/* Quick Regional Presets */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            Quick Regional Presets
          </span>
          <span className="text-xs text-slate-500">Or click anywhere on the map</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
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
                className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-colors whitespace-nowrap truncate focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                  isActive
                    ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-200 font-semibold'
                    : 'bg-[#121c19] border-[#21312c] text-slate-300 hover:border-emerald-700/70 hover:text-white'
                }`}
                title={preset.name}
              >
                {preset.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Direct Lat/Lon Coordinates */}
      <div className="space-y-2">
        <form onSubmit={handleCoordinateJump} className="flex flex-wrap sm:flex-nowrap items-end gap-2">
          <div className="flex-1 min-w-[100px]">
            <label htmlFor="lat-input" className="block text-[11px] font-mono text-slate-400 mb-1">
              Latitude
            </label>
            <input
              id="lat-input"
              type="text"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              placeholder="0.3476"
              className="w-full bg-[#121c19] border border-[#22322d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex-1 min-w-[100px]">
            <label htmlFor="lon-input" className="block text-[11px] font-mono text-slate-400 mb-1">
              Longitude
            </label>
            <input
              id="lon-input"
              type="text"
              value={lonInput}
              onChange={(e) => setLonInput(e.target.value)}
              placeholder="32.5825"
              className="w-full bg-[#121c19] border border-[#22322d] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-[#16231f] border border-[#293d37] text-xs font-medium text-cyan-300 hover:bg-[#1c2d28] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Go to Pin
          </button>
        </form>

        {coordError && (
          <p role="alert" className="text-[11px] text-rose-300 font-medium">
            {coordError}
          </p>
        )}
      </div>

      {/* Interactive Leaflet Map */}
      <div className="relative rounded-lg overflow-hidden border border-[#22322d] h-56 w-full">
        <MapContainer
          center={[farm.lat, farm.lon]}
          zoom={7}
          scrollWheelZoom={true}
          className="h-full w-full z-0"
        >
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <MapInteractionLayer
            lat={farm.lat}
            lon={farm.lon}
            altitude={farm.altitude}
            targetZoom={mapZoomHint}
            onSelectCoordinates={(lat, lon, label) => {
              setMapZoomHint(null);
              onSelectCoordinates(lat, lon, label);
            }}
          />
        </MapContainer>
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[400] bg-[#080c0b]/90 border border-[#22322d] px-2.5 py-1 rounded text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-emerald-400" aria-hidden="true" />
          <span>{isLoadingTelemetry ? 'Fetching NASA POWER + SRTM...' : 'Click map or drag pin to exact plot'}</span>
        </div>
      </div>

      {/* Altitude & Soil pH Sliders */}
      <div className="grid grid-cols-1 gap-5 pt-1">
        {/* Altitude Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="altitude-slider" className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
              {languageMode === 'farmer' ? 'Field Elevation (Altitude)' : 'SRTM 30m Elevation (m ASL)'}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="altitude-number"
                type="number"
                min={0}
                max={3500}
                step={10}
                value={farm.altitude}
                aria-label="Altitude in meters"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isFinite(val)) {
                    onUpdateFarm({ altitude: Math.max(0, Math.min(3500, val)) });
                  }
                }}
                className="w-20 bg-[#121c19] border border-[#253630] rounded px-2 py-1 text-right text-xs font-mono text-slate-100 tabular-nums focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs font-mono text-slate-400">m</span>
            </div>
          </div>
          <input
            id="altitude-slider"
            type="range"
            min={0}
            max={3500}
            step={10}
            value={farm.altitude}
            onChange={(e) => onUpdateFarm({ altitude: Number(e.target.value) })}
            className="terra-slider w-full"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-500">
            <span>0m Lowland</span>
            <span>
              {telemetry ? `SRTM Auto: ${telemetry.srtmAltitudeM}m` : '1,500m Mid'}
            </span>
            <span>3,500m Alpine</span>
          </div>
        </div>

        {/* Soil pH Control with Color-Coded Spectrum Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="ph-slider" className="text-xs font-medium text-slate-200">
              {languageMode === 'farmer' ? 'Soil Acidity / Alkalinity (pH)' : 'Topsoil pH (H₂O · SoilGrids 250m)'}
            </label>
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
              {telemetry && (
                <span className="text-slate-500">
                  Est: {telemetry.soilGridsPh.toFixed(1)}
                </span>
              )}
              <span className="px-2 py-0.5 rounded bg-[#14201c] border border-[#263832] text-emerald-300 font-semibold">
                pH {farm.soilPh.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="relative pt-1">
            <div
              className="h-2 w-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 28%, #10b981 42%, #10b981 68%, #06b6d4 84%, #3b82f6 100%)',
              }}
              aria-hidden="true"
            />
            <div
              className="absolute top-0 w-2.5 h-4 -ml-1.25 rounded-sm bg-white border border-slate-950 pointer-events-none"
              style={{ left: `${phPercent}%` }}
              aria-hidden="true"
            />
          </div>

          <input
            id="ph-slider"
            type="range"
            min={4.0}
            max={8.5}
            step={0.1}
            value={farm.soilPh}
            onChange={(e) => onUpdateFarm({ soilPh: Number(e.target.value) })}
            className="terra-slider w-full"
          />

          {/* Live Nutrient Lock-Up Warning */}
          <div
            role="status"
            aria-live="polite"
            className={`rounded-lg border px-3 py-2.5 text-xs ${
              phWarning.severity === 'critical'
                ? 'bg-rose-950/35 border-rose-800/70 text-rose-200'
                : phWarning.severity === 'caution'
                  ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                  : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              {phWarning.severity === 'optimal' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle
                  className={`w-3.5 h-3.5 shrink-0 ${
                    phWarning.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
                  }`}
                  aria-hidden="true"
                />
              )}
              <span>{phWarning.label}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed opacity-90">{phWarning.detail}</p>
          </div>
        </div>

        {/* Soil Texture Selector */}
        <div>
          <span className="block text-xs font-medium text-slate-200 mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            Soil Texture Class
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
            {SOIL_TEXTURE_OPTIONS.map((texture: SoilTexture) => {
              const active = farm.soilTexture === texture;
              return (
                <button
                  key={texture}
                  type="button"
                  onClick={() => onUpdateFarm({ soilTexture: texture })}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                      : 'bg-[#121c19] border-[#21312c] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {texture}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Crops Planted */}
        <div>
          <span className="block text-xs font-medium text-slate-200 mb-2">
            Current Crops on This Field
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
                  className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors whitespace-nowrap ${
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
          <form onSubmit={handleAddCustomCrop} className="mt-2 flex gap-2">
            <input
              type="text"
              value={customCrop}
              onChange={(e) => setCustomCrop(e.target.value)}
              placeholder="Add other crop (e.g. Millet, Kale)"
              aria-label="Add custom crop"
              className="flex-1 bg-[#121c19] border border-[#22322d] rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-[#16231f] border border-[#293d37] text-xs font-medium text-emerald-300 hover:bg-[#1c2d28] flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add
            </button>
          </form>
        </div>

        {/* Farmer Priority Weight Chips */}
        <div>
          <span className="block text-xs font-medium text-slate-200 mb-2">
            Farmer Rotation Priorities
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
                  className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors whitespace-nowrap ${
                    selected
                      ? 'bg-cyan-500/20 border-cyan-400/80 text-cyan-200 font-medium'
                      : 'bg-[#121c19] border-[#22322d] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  {priority}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="pt-2 border-t border-[#1b2924]">
        <button
          type="button"
          onClick={onRunCalibration}
          disabled={!telemetry || isLoadingTelemetry || isLoadingCalibration}
          className="w-full py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900/50 disabled:text-slate-400 text-slate-950 font-semibold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span>
            {isLoadingCalibration
              ? 'Synthesizing NASA Telemetry...'
              : 'Analyze Field & Calibrate with NASA Data'}
          </span>
        </button>
      </div>
    </section>
  );
};
