import { DAYS_IN_MONTH, MONTHS_SHORT } from '../data/presets';
import type {
  CalibrationAnswer,
  CalibrationQuestion,
  FarmContext,
  MonthlyClimatePoint,
  NasaTelemetryPayload,
  PhWarningInfo,
  RotationStrategy,
  SoilTexture,
  StressTestResult,
} from '../types/agro';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function roundTo(val: number, decimals = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export interface CoordinateParseResult {
  ok: true;
  lat: number;
  lon: number;
}
export interface CoordinateParseError {
  ok: false;
  error: string;
}

/**
 * Parses and validates decimal coordinates (supports pasting "lat, lon" into latRaw).
 */
export function parseAndValidateCoordinates(
  latRaw: string,
  lonRaw: string,
): CoordinateParseResult | CoordinateParseError {
  const trimmedLat = latRaw.trim();
  const trimmedLon = lonRaw.trim();

  let latStr = trimmedLat;
  let lonStr = trimmedLon;

  // Support pasting "lat, lon" into the latitude input
  if (trimmedLat.includes(',')) {
    const parts = trimmedLat.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 2) {
      latStr = parts[0];
      lonStr = parts[1];
    }
  }

  if (!latStr || !lonStr) {
    return { ok: false, error: 'Enter both latitude and longitude.' };
  }

  const lat = Number(latStr);
  const lon = Number(lonStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: 'Coordinates must be valid decimal numbers (e.g. 0.3476, 32.5825).' };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, error: 'Latitude must be between -90° and 90°.' };
  }
  if (lon < -180 || lon > 180) {
    return { ok: false, error: 'Longitude must be between -180° and 180°.' };
  }

  return {
    ok: true,
    lat: roundTo(lat, 4),
    lon: roundTo(lon, 4),
  };
}

/**
 * Evaluates Soil pH status and returns actionable agronomic nutrient lock-up warnings.
 */
export function computePhWarnings(soilPh: number): PhWarningInfo {
  if (soilPh < 5.0) {
    return {
      severity: 'critical',
      label: 'Severe Acid Stress · Al³⁺ Toxicity Risk',
      detail: 'Below pH 5.0, exchangeable aluminum stunts root tips while Phosphorus binds tightly to iron/aluminum oxides. Agricultural lime or dolomite plus organic compost is strongly advised before planting sensitive legumes.',
    };
  }
  if (soilPh < 5.5) {
    return {
      severity: 'caution',
      label: 'Acidic Ferralsol Zone · P & Mo Lock-Up',
      detail: 'Between pH 5.0–5.4, Phosphorus and Molybdenum availability drops, reducing legume nodulation. Target acid-tolerant species (cassava, cowpea, mucuna, tea/coffee) or band-apply rock phosphate + lime.',
    };
  }
  if (soilPh <= 7.2) {
    return {
      severity: 'optimal',
      label: 'Optimal Nutrient Availability Window',
      detail: 'pH 5.5–7.2 maximizes N, P, K, Ca, Mg, and microbial rhizobia activity across cereals, pulses, and deep-rooting cover crops.',
    };
  }
  if (soilPh <= 7.7) {
    return {
      severity: 'caution',
      label: 'Mildly Alkaline · Fe & Zn Availability Dip',
      detail: 'Above pH 7.2, Iron, Zinc, and Manganese solubility decreases. Prioritize alkali-tolerant crops (barley, sorghum, alfalfa, chickpea) and incorporate elemental sulfur or composted biomass.',
    };
  }
  return {
    severity: 'critical',
    label: 'High Alkalinity · Micronutrient Lock-Up',
    detail: 'Above pH 7.7, severe Iron, Zinc, Phosphorus, and Boron lock-up causes chlorosis in maize and beans. Use gypsum/sulfur amendments and salt-tolerant deep-rooting rotations.',
  };
}

/**
 * Computes frost risk from minimum monthly temperature combined with altitude lapse adjustment.
 */
export function computeFrostRisk(minMonthlyTempC: number, altitudeM: number): 'None' | 'Low' | 'Moderate' | 'High' {
  // Subtle micro-topographic cold-air drainage penalty above 1700m
  const coldPocketEffectiveC = minMonthlyTempC - Math.max(0, (altitudeM - 1700) / 450);
  if (coldPocketEffectiveC <= 2.0) return 'High';
  if (coldPocketEffectiveC <= 5.0) return 'Moderate';
  if (coldPocketEffectiveC <= 8.5) return 'Low';
  return 'None';
}

/**
 * Computes Topographic Runoff & Erosion Vulnerability Score (0-100)
 * fusing SRTM altitude/relief proxy, peak GPM monthly rainfall, soil texture erodibility, and bare-soil danger months.
 */
export function computeTopographicErosionScore(
  altitudeM: number,
  peakMonthlyRainMm: number,
  soilTexture: SoilTexture,
  bareSoilDangerMonthsCount: number,
): number {
  const reliefFactor = clamp((altitudeM / 2200) * 32, 4, 34);
  const rainIntensityFactor = clamp((peakMonthlyRainMm / 240) * 34, 4, 36);
  const textureFactor: Record<SoilTexture, number> = {
    Sandy: 18,
    'Volcanic Ash': 15,
    Clay: 12,
    Loamy: 8,
  };
  const bareSoilPenalty = clamp(bareSoilDangerMonthsCount * 6, 0, 20);
  return Math.round(clamp(reliefFactor + rainIntensityFactor + textureFactor[soilTexture] + bareSoilPenalty, 8, 98));
}

/**
 * Computes 12-month MODIS/Landsat NDVI cover curve and flags "Bare-Soil Danger Windows"
 * where NDVI drops below 0.30 right as heavy GPM rain arrives (>= 85 mm/month).
 */
export function computeNdviAndBareSoilWindows(
  rawMonths: Array<{
    monthIndex: number;
    t2m: number;
    t2mMax: number;
    t2mMin: number;
    gpmRainfallMm: number;
    smapRootMoisturePct: number;
    smapSurfaceWetnessPct: number;
    evland: number;
    solarSwDwn: number;
    esiRatio: number;
  }>,
  currentCrops: string[],
): MonthlyClimatePoint[] {
  const hasPerennial = currentCrops.some((c) => {
    const lc = c.toLowerCase();
    return lc.includes('coffee') || lc.includes('banana') || lc.includes('matooke') || lc.includes('cassava') || lc.includes('alfalfa');
  });

  const rainValues = rawMonths.map((m) => m.gpmRainfallMm);
  const maxRain = Math.max(...rainValues, 1);

  return rawMonths.map((m, idx) => {
    const prevMoisture = rawMonths[(idx + 11) % 12].smapRootMoisturePct;
    const prevRain = rawMonths[(idx + 11) % 12].gpmRainfallMm;
    const nextRain = rawMonths[(idx + 1) % 12].gpmRainfallMm;

    // Harvest/post-harvest drawdown creates bare soil troughs just before peak rain onset
    const isRainOnsetAfterDry = m.gpmRainfallMm >= 85 && prevRain < 65;
    const moistureIndex = (m.smapRootMoisturePct * 0.65 + prevMoisture * 0.35) / 100;
    const rainIndex = clamp(m.gpmRainfallMm / Math.max(maxRain, 120), 0, 1);

    let ndvi = 0.22 + moistureIndex * 0.42 + rainIndex * 0.22;
    if (hasPerennial) {
      ndvi += 0.16;
    } else if (isRainOnsetAfterDry) {
      // Annual monocrop fields are freshly tilled/bare at onset of heavy rains
      ndvi = Math.min(ndvi, 0.26);
    } else if (prevRain > 110 && m.gpmRainfallMm < 55) {
      // Post-harvest residue burn/removal phase
      ndvi -= 0.12;
    } else if (m.gpmRainfallMm < 35 && nextRain >= 90) {
      // Pre-rain land preparation window
      ndvi = Math.min(ndvi, 0.25);
    }

    const ndviCover = roundTo(clamp(ndvi, 0.14, 0.88), 2);
    const isBareSoilDanger =
      (ndviCover < 0.30 && m.gpmRainfallMm >= 80) ||
      (ndviCover < 0.32 && nextRain >= 110 && m.gpmRainfallMm >= 55);

    let bareSoilRiskReason: string | null = null;
    if (isBareSoilDanger) {
      bareSoilRiskReason = `MODIS NDVI (${ndviCover.toFixed(2)}) drops below 0.30 bare-ground threshold during ${Math.round(m.gpmRainfallMm)} mm GPM rain — high splash & sheet erosion risk.`;
    }

    return {
      month: MONTHS_SHORT[idx],
      monthIndex: idx,
      t2m: roundTo(m.t2m, 1),
      t2mMax: roundTo(m.t2mMax, 1),
      t2mMin: roundTo(m.t2mMin, 1),
      gpmRainfallMm: Math.round(m.gpmRainfallMm),
      smapRootMoisturePct: Math.round(m.smapRootMoisturePct),
      smapSurfaceWetnessPct: Math.round(m.smapSurfaceWetnessPct),
      evland: roundTo(m.evland, 2),
      solarSwDwn: roundTo(m.solarSwDwn, 1),
      esiRatio: roundTo(m.esiRatio, 2),
      ndviCover,
      isBareSoilDanger,
      bareSoilRiskReason,
    };
  });
}

/**
 * Classifies SoilGrids clay/sand percentages into CropShift's 4 soil texture classes.
 */
export function classifySoilTexture(clayPct: number, sandPct: number, socGKg: number): SoilTexture {
  if (socGKg >= 35 && clayPct >= 20 && sandPct <= 45) return 'Volcanic Ash';
  if (clayPct >= 38) return 'Clay';
  if (sandPct >= 55) return 'Sandy';
  return 'Loamy';
}

/**
 * Evaluates live Climate Shock Stress-Test across Temperature Anomaly (0..+4.0°C)
 * and Rainfall Shift (-40%..+30%) for any RotationStrategy.
 */
export function evaluateClimateStressTest(
  strategy: RotationStrategy,
  telemetry: NasaTelemetryPayload,
  tempDeltaC: number,
  rainDeltaPct: number,
): StressTestResult {
  const baseScore = strategy.suitabilityScore;

  // Diversified / regenerative strategies buffer heat & drought via soil organic matter and continuous cover
  const waterBuffer = strategy.impactMetrics.waterConservationScore / 100;
  const erosionBuffer = strategy.impactMetrics.erosionReductionScore / 100;
  const soilBuffer = strategy.impactMetrics.soilHealthScore / 100;
  const diversityFactor = (waterBuffer * 0.45 + soilBuffer * 0.35 + erosionBuffer * 0.2);

  // Heat stress penalty: only applies when temperature anomaly > 0 above historical climatology
  const peakFutureTemp = telemetry.ecostressPeakTempC + tempDeltaC;
  const baselineHeatOver = Math.max(0, telemetry.ecostressPeakTempC - 30.5);
  const futureHeatOver = Math.max(0, peakFutureTemp - 30.5);
  const incrementalHeatOver = Math.max(0, futureHeatOver - baselineHeatOver);
  const heatSensitivity = 1.15 - diversityFactor * 0.55; // 0.60 (resilient) to 1.05 (vulnerable)
  const heatPenalty = tempDeltaC * (3.2 * heatSensitivity) + incrementalHeatOver * (1.2 * heatSensitivity);

  // Rainfall shift penalty: severe drought (-40%) or extreme deluge (+30% runoff)
  let rainPenalty = 0;
  if (rainDeltaPct < 0) {
    const droughtSeverity = Math.abs(rainDeltaPct) / 10; // 0..4
    const droughtSensitivity = 1.25 - waterBuffer * 0.7;
    rainPenalty = droughtSeverity * (4.4 * droughtSensitivity);
  } else if (rainDeltaPct > 0) {
    const floodSeverity = rainDeltaPct / 10; // 0..3
    const erosionSensitivity = 1.1 - erosionBuffer * 0.75;
    rainPenalty = floodSeverity * (2.6 * erosionSensitivity);
  }

  // Regenerative bonus when climate shifts moderately because water retention pays off
  const totalPenalty = heatPenalty + rainPenalty;
  const adjustedSuitabilityScore = Math.round(clamp(baseScore - totalPenalty, 12, 98));
  const scoreDelta = adjustedSuitabilityScore - baseScore;

  // Yield retention % under climate shock
  const rawRetention = 100 - totalPenalty * 1.18;
  const yieldRetentionPct = Math.round(clamp(rawRetention, 28, 100));

  let survivalStatus: StressTestResult['survivalStatus'] = 'Resilient';
  if (adjustedSuitabilityScore < 50 || yieldRetentionPct < 60) {
    survivalStatus = 'Critical Risk';
  } else if (adjustedSuitabilityScore < 70 || yieldRetentionPct < 78) {
    survivalStatus = 'Strained';
  }

  let stressWarning = 'Canopy cover and root-zone buffering hold soil moisture stable under tested climate shock.';
  if (tempDeltaC === 0 && rainDeltaPct === 0) {
    stressWarning = 'Baseline historical NASA climatology (no climate shock applied).';
  } else if (survivalStatus === 'Critical Risk') {
    stressWarning = rainDeltaPct <= -20
      ? `Severe moisture deficit: ${peakFutureTemp.toFixed(1)}°C peaks + ${rainDeltaPct}% rainfall exceed root-zone buffer.`
      : `High thermal & runoff shock at +${tempDeltaC.toFixed(1)}°C / ${rainDeltaPct >= 0 ? '+' : ''}${rainDeltaPct}% rainfall.`;
  } else if (survivalStatus === 'Strained') {
    stressWarning = rainDeltaPct < 0
      ? `Moderate drought strain (${rainDeltaPct}% rain); mulching and relay cover become mandatory.`
      : `Elevated intense-rain leaching risk (${rainDeltaPct >= 0 ? '+' : ''}${rainDeltaPct}% rain); keep soil covered.`;
  }

  return {
    strategyId: strategy.id,
    adjustedSuitabilityScore,
    scoreDelta,
    yieldRetentionPct,
    survivalStatus,
    stressWarning,
  };
}

/**
 * Builds 3 hyper-specific diagnostic calibration questions deterministically
 * from NASA telemetry anomalies + farmer field context (used when offline or Gemini unavailable).
 */
export function buildDeterministicCalibrationQuestions(
  farm: FarmContext,
  telemetry: NasaTelemetryPayload,
): CalibrationQuestion[] {
  const bareMonths = telemetry.bareSoilDangerMonths.length > 0
    ? telemetry.bareSoilDangerMonths.join(', ')
    : telemetry.smapDryMonths.slice(0, 2).join(', ') || 'transition months';

  const phNote = farm.soilPh < 5.5
    ? `acidic pH ${farm.soilPh.toFixed(1)}`
    : farm.soilPh > 7.4
      ? `alkaline pH ${farm.soilPh.toFixed(1)}`
      : `pH ${farm.soilPh.toFixed(1)}`;

  const q1: CalibrationQuestion = {
    id: 'q-residue-erosion',
    satelliteTrigger: `SRTM ${farm.altitude}m elevation · Erosion Index ${telemetry.topographicErosionScore}/100 · Bare-Soil Window (${bareMonths})`,
    question: `After harvesting ${farm.currentCrops[0] || 'your main crop'}, what happens to the stalks, leaves, and weeds on your field before the next rains arrive?`,
    whyWeAsk: 'MODIS 250m imagery detects bare soil exposure right before heavy GPM rain, but cannot tell if crop stalks are kept as protective mulch, fed to livestock, or burned.',
    quickOptions: [
      'Left on the field as surface mulch',
      'Fed to cattle/goats (field grazed bare)',
      'Cleared or burned before land prep',
      'Composted and re-applied in planting rows',
    ],
  };

  const q2: CalibrationQuestion = {
    id: 'q-soil-inputs',
    satelliteTrigger: `SoilGrids ${phNote} · ${farm.soilTexture} texture · SMAP Root Moisture ${telemetry.smapRootMoistureAvg}%`,
    question: farm.soilPh < 5.6
      ? `Your soil reads acidic (pH ${farm.soilPh.toFixed(1)}), which locks up Phosphorus for beans and maize. Do you have access to agricultural lime, wood ash, or manure?`
      : farm.soilPh > 7.4
        ? `Your soil reads alkaline (pH ${farm.soilPh.toFixed(1)}), which can lock up Iron and Zinc. Can you source compost, sulfur, or drip fertigation?`
        : `Satellite SMAP shows ${telemetry.smapDryMonths.length || 2} dry root-zone months. Do you have supplemental water or organic manure to bridge dry spells?`,
    whyWeAsk: 'Global soil maps estimate pH at 250m resolution, but cannot see whether a farmer can realistically apply soil amendments or access supplemental water.',
    quickOptions: farm.soilPh < 5.6
      ? [
          'Manure or compost available locally',
          'Agricultural lime is affordable nearby',
          'Wood ash only / low-input budget',
          'No amendments — rely on acid-tolerant crops',
        ]
      : [
          'Farmyard manure / compost available',
          'Rain-fed only, zero irrigation access',
          'Seasonal drip or furrow irrigation available',
          'Mineral fertilizer + organic residue mix',
        ],
  };

  const q3: CalibrationQuestion = {
    id: 'q-market-pest',
    satelliteTrigger: `ECOSTRESS Peak ${telemetry.ecostressPeakTempC}°C · ESI ${telemetry.ecostressEsiAvg.toFixed(2)} · GPM ${telemetry.gpmAnnualRainfallMm}mm/yr`,
    question: `Which off-season legume, root crop, or cover crop actually has local buyers or household food value in ${farm.locationName.split(',')[0]}?`,
    whyWeAsk: 'Even the strongest soil-building crop rotation fails if seeds are unavailable locally or if your household cannot eat or sell the rotation crop.',
    quickOptions: [
      'Climbing/bush beans, soybeans, or groundnuts',
      'Drought-hardy sorghum, millet, or cowpeas',
      'Mucuna / lablab forage for livestock & soil',
      'High-value vegetables or potatoes if moisture holds',
    ],
  };

  return [q1, q2, q3];
}

/**
 * Generates 3 deterministic, agronomically accurate Rotation Strategies
 * tailored to the exact NASA telemetry, pH, altitude, soil texture, and calibration answers.
 */
export function buildDeterministicStrategies(
  farm: FarmContext,
  telemetry: NasaTelemetryPayload,
  answers: CalibrationAnswer[],
): RotationStrategy[] {
  const mainCrop = farm.currentCrops[0] || 'Maize';
  const secondaryCrop = farm.currentCrops[1] || 'Beans';
  const isHighland = farm.altitude >= 1600;
  const isAcidic = farm.soilPh < 5.6;
  const isAlkaline = farm.soilPh > 7.3;
  const isArid = telemetry.gpmAnnualRainfallMm < 550;
  const isBimodal = telemetry.gpmSeasonality === 'Bimodal';

  const answerSummary = answers.map((a) => a.answer.toLowerCase()).join(' | ');
  const keepsMulch = answerSummary.includes('mulch') || answerSummary.includes('compost');
  const hasLivestock = answerSummary.includes('forage') || answerSummary.includes('cattle') || answerSummary.includes('goat') || farm.priorities.includes('Livestock Forage');
  const hasIrrigation = answerSummary.includes('irrigation') || isArid;

  const rainPeaks = telemetry.monthly
    .map((m) => ({ month: m.month, rain: m.gpmRainfallMm, ndvi: m.ndviCover }))
    .sort((a, b) => b.rain - a.rain)
    .slice(0, 2)
    .map((x) => `${x.month} (${x.rain} mm)`)
    .join(' & ');

  // Choose regionally & pH-appropriate crops
  const regenerativeLegume = isAcidic
    ? (isHighland ? 'Lupin + Climbing Beans (with lime/compost)' : 'Mucuna / Cowpea Cover')
    : isAlkaline
      ? 'Alfalfa / Chickpea Cover'
      : (hasLivestock ? 'Lablab + Desmodium Forage Legume' : 'Soybeans + Sunn Hemp Relay');

  const resilientCashCrop = isArid
    ? 'Drought-Tolerant Sorghum + Cowpea Intercrop'
    : isHighland
      ? 'Irish Potatoes / Pyrethrum + Climbing Beans'
      : isAcidic
        ? 'Cassava / Groundnuts + Upland Rice or Maize Strip'
        : 'Short-Season Maize + Groundnuts / Sesame';

  const dryCoverCrop = isArid ? 'Drought Mulch / Pigeon Pea' : 'Mucuna / Lablab Cover';

  // Helper to build 12-month calendars grounded in actual monthly rainfall peaks
  const buildBaselineCalendar = () =>
    telemetry.monthly.map((m, i) => {
      if (isArid) {
        if (i >= 2 && i <= 3) return { month: m.month, cropName: mainCrop, stage: 'Planting' as const, ndviTarget: 0.34, waterDemand: 'Medium' as const };
        if (i >= 4 && i <= 7) return { month: m.month, cropName: mainCrop, stage: 'Growing' as const, ndviTarget: 0.62, waterDemand: 'High' as const };
        if (i === 8) return { month: m.month, cropName: mainCrop, stage: 'Harvest' as const, ndviTarget: 0.38, waterDemand: 'Low' as const };
        return { month: m.month, cropName: 'Fallow / Exposed Soil', stage: 'Bare Soil' as const, ndviTarget: 0.19, waterDemand: 'Low' as const };
      }
      if (isBimodal) {
        if (i === 2 || i === 8) return { month: m.month, cropName: mainCrop, stage: 'Planting' as const, ndviTarget: 0.32, waterDemand: 'Medium' as const };
        if ((i >= 3 && i <= 4) || (i >= 9 && i <= 10)) return { month: m.month, cropName: `${mainCrop} + ${secondaryCrop}`, stage: 'Growing' as const, ndviTarget: 0.64, waterDemand: 'High' as const };
        if (i === 5 || i === 11) return { month: m.month, cropName: mainCrop, stage: 'Harvest' as const, ndviTarget: 0.35, waterDemand: 'Low' as const };
        return { month: m.month, cropName: 'Cleared Stubble', stage: 'Bare Soil' as const, ndviTarget: 0.21, waterDemand: 'Low' as const };
      }
      if (i === 3) return { month: m.month, cropName: mainCrop, stage: 'Planting' as const, ndviTarget: 0.31, waterDemand: 'Medium' as const };
      if (i >= 4 && i <= 7) return { month: m.month, cropName: mainCrop, stage: 'Growing' as const, ndviTarget: 0.65, waterDemand: 'High' as const };
      if (i === 8) return { month: m.month, cropName: mainCrop, stage: 'Harvest' as const, ndviTarget: 0.36, waterDemand: 'Low' as const };
      return { month: m.month, cropName: 'Exposed Soil', stage: 'Bare Soil' as const, ndviTarget: 0.2, waterDemand: 'Low' as const };
    });

  const buildRegenerativeCalendar = () =>
    telemetry.monthly.map((m, i) => {
      if (isArid) {
        if (i >= 2 && i <= 3) return { month: m.month, cropName: 'Sorghum + Chickpea Strip', stage: 'Planting' as const, ndviTarget: 0.44, waterDemand: 'Low' as const };
        if (i >= 4 && i <= 7) return { month: m.month, cropName: 'Sorghum + Alfalfa Relay', stage: 'Growing' as const, ndviTarget: 0.71, waterDemand: 'Medium' as const };
        if (i === 8) return { month: m.month, cropName: 'Sorghum Harvest + Living Mulch', stage: 'Harvest' as const, ndviTarget: 0.56, waterDemand: 'Low' as const };
        return { month: m.month, cropName: 'Winter Cover + Residue Shield', stage: 'Cover Crop' as const, ndviTarget: 0.48, waterDemand: 'Low' as const };
      }
      if (isBimodal) {
        if (i === 2) return { month: m.month, cropName: `${mainCrop} + ${regenerativeLegume}`, stage: 'Planting' as const, ndviTarget: 0.46, waterDemand: 'Medium' as const };
        if (i >= 3 && i <= 4) return { month: m.month, cropName: `${mainCrop} + Deep-Root Legume`, stage: 'Growing' as const, ndviTarget: 0.78, waterDemand: 'Medium' as const };
        if (i === 5) return { month: m.month, cropName: `${mainCrop} Harvest (Legume Stays)`, stage: 'Harvest' as const, ndviTarget: 0.62, waterDemand: 'Low' as const };
        if (i >= 6 && i <= 7) return { month: m.month, cropName: dryCoverCrop, stage: 'Cover Crop' as const, ndviTarget: 0.58, waterDemand: 'Low' as const };
        if (i === 8) return { month: m.month, cropName: 'Nitrogen-Fixing Pulse Rotation', stage: 'Planting' as const, ndviTarget: 0.52, waterDemand: 'Medium' as const };
        if (i >= 9 && i <= 10) return { month: m.month, cropName: 'Legume + Contour Grass Strips', stage: 'Growing' as const, ndviTarget: 0.76, waterDemand: 'Medium' as const };
        if (i === 11) return { month: m.month, cropName: 'Pulse Harvest + Mulch Retention', stage: 'Harvest' as const, ndviTarget: 0.55, waterDemand: 'Low' as const };
        return { month: m.month, cropName: dryCoverCrop, stage: 'Cover Crop' as const, ndviTarget: 0.49, waterDemand: 'Low' as const };
      }
      if (i === 3) return { month: m.month, cropName: `${mainCrop} + Relay Legume`, stage: 'Planting' as const, ndviTarget: 0.46, waterDemand: 'Medium' as const };
      if (i >= 4 && i <= 7) return { month: m.month, cropName: `${mainCrop} + Canopy Understory`, stage: 'Growing' as const, ndviTarget: 0.79, waterDemand: 'Medium' as const };
      if (i === 8) return { month: m.month, cropName: `${mainCrop} Harvest + Cover Retained`, stage: 'Harvest' as const, ndviTarget: 0.59, waterDemand: 'Low' as const };
      return { month: m.month, cropName: dryCoverCrop, stage: 'Cover Crop' as const, ndviTarget: 0.51, waterDemand: 'Low' as const };
    });

  const buildHybridCalendar = () =>
    telemetry.monthly.map((m, i) => {
      if (isArid) {
        if (i >= 2 && i <= 3) return { month: m.month, cropName: resilientCashCrop, stage: 'Planting' as const, ndviTarget: 0.41, waterDemand: 'Low' as const };
        if (i >= 4 && i <= 6) return { month: m.month, cropName: resilientCashCrop, stage: 'Growing' as const, ndviTarget: 0.68, waterDemand: 'Medium' as const };
        if (i === 7) return { month: m.month, cropName: 'Early Cash Crop Harvest', stage: 'Harvest' as const, ndviTarget: 0.50, waterDemand: 'Low' as const };
        if (i >= 8 && i <= 10) return { month: m.month, cropName: 'Chickpea / Short-Cycle Pulse', stage: 'Growing' as const, ndviTarget: 0.57, waterDemand: 'Low' as const };
        return { month: m.month, cropName: 'Mulched Stubble + Cover', stage: 'Cover Crop' as const, ndviTarget: 0.42, waterDemand: 'Low' as const };
      }
      if (isBimodal) {
        if (i === 2) return { month: m.month, cropName: `${mainCrop} + Short-Cycle Legume`, stage: 'Planting' as const, ndviTarget: 0.44, waterDemand: 'Medium' as const };
        if (i >= 3 && i <= 4) return { month: m.month, cropName: `${mainCrop} + Groundnut/Bean Strip`, stage: 'Growing' as const, ndviTarget: 0.74, waterDemand: 'Medium' as const };
        if (i === 5) return { month: m.month, cropName: 'Season A Harvest + Relay', stage: 'Harvest' as const, ndviTarget: 0.54, waterDemand: 'Low' as const };
        if (i >= 6 && i <= 7) return { month: m.month, cropName: 'Pigeon Pea / Forage Strip', stage: 'Cover Crop' as const, ndviTarget: 0.51, waterDemand: 'Low' as const };
        if (i === 8) return { month: m.month, cropName: resilientCashCrop, stage: 'Planting' as const, ndviTarget: 0.47, waterDemand: 'Medium' as const };
        if (i >= 9 && i <= 10) return { month: m.month, cropName: resilientCashCrop, stage: 'Growing' as const, ndviTarget: 0.73, waterDemand: 'Medium' as const };
        if (i === 11) return { month: m.month, cropName: 'Season B Cash Harvest', stage: 'Harvest' as const, ndviTarget: 0.52, waterDemand: 'Low' as const };
        return { month: m.month, cropName: 'Pigeon Pea + Mulch Cover', stage: 'Cover Crop' as const, ndviTarget: 0.46, waterDemand: 'Low' as const };
      }
      if (i === 3) return { month: m.month, cropName: resilientCashCrop, stage: 'Planting' as const, ndviTarget: 0.44, waterDemand: 'Medium' as const };
      if (i >= 4 && i <= 7) return { month: m.month, cropName: resilientCashCrop, stage: 'Growing' as const, ndviTarget: 0.74, waterDemand: 'Medium' as const };
      if (i === 8) return { month: m.month, cropName: 'Main Cash Harvest + Relay', stage: 'Harvest' as const, ndviTarget: 0.54, waterDemand: 'Low' as const };
      return { month: m.month, cropName: 'Short-Season Pulse + Cover', stage: 'Cover Crop' as const, ndviTarget: 0.47, waterDemand: 'Low' as const };
    });

  const baselineSuitability = clamp(
    54 - telemetry.bareSoilDangerMonths.length * 4 - (isAcidic || isAlkaline ? 6 : 0) + (keepsMulch ? 5 : 0),
    28,
    66,
  );

  const regenSuitability = clamp(
    86 + (telemetry.topographicErosionScore > 55 ? 4 : 0) + (keepsMulch ? 3 : 0),
    78,
    95,
  );

  const hybridSuitability = clamp(
    83 + (farm.priorities.includes('High Cash Income') ? 5 : 2) + (hasIrrigation ? 2 : 0),
    76,
    93,
  );

  return [
    {
      id: 'baseline-continuation',
      name: 'Baseline Continuation (Current System)',
      tagline: `3-year projection keeping ${farm.currentCrops.join(' + ') || 'current cropping'} unchanged`,
      badgeColor: 'amber',
      suitabilityScore: baselineSuitability,
      monthlyCalendar: buildBaselineCalendar(),
      whySuggested: `Shows the real trajectory of continuing ${farm.currentCrops.join(', ') || 'mono-season cropping'} at ${farm.altitude}m and pH ${farm.soilPh.toFixed(1)} without closing bare-soil gaps.`,
      nasaEvidenceUsed: [
        `GPM Precipitation peaks (${rainPeaks}) strike exposed soil during ${telemetry.bareSoilDangerMonths.length || 2} low-NDVI months (<0.30).`,
        `SMAP Root-Zone Moisture averages ${telemetry.smapRootMoistureAvg}%, dropping sharply across ${telemetry.smapDryMonths.join(', ') || 'dry transition months'}.`,
        `SRTM elevation (${farm.altitude}m) drives a ${telemetry.topographicErosionScore}/100 runoff risk when topsoil lacks continuous root binding.`,
      ],
      soilAndAgronomicMechanics: {
        phCompatibility: isAcidic
          ? `At pH ${farm.soilPh.toFixed(1)}, repeated cereal extraction without lime or deep-rooting organic matter accelerates topsoil acidification and Phosphorus lock-up.`
          : isAlkaline
            ? `At pH ${farm.soilPh.toFixed(1)}, repetitive extraction depletes organic acids needed to keep Iron and Zinc plant-available.`
            : `pH ${farm.soilPh.toFixed(1)} supports initial yields, though continuous nutrient export steadily draws down bases.`,
        nitrogenCycling: 'Net nitrogen mining (-25 to -45 kg N/ha/yr) if stover is removed or burned between seasons.',
        erosionAndInfiltration: `Bare post-harvest windows leave ${farm.soilTexture.toLowerCase()} topsoil vulnerable to crusting and sheet wash during onset rains.`,
        pestCycleDisruption: 'Minimal disruption — continuous host availability favors stem borers, striga/weeds, and root nematodes over 3 years.',
      },
      impactMetrics: {
        soilHealthScore: 38,
        waterConservationScore: 41,
        erosionReductionScore: 32,
        nitrogenBalanceScore: 34,
        marketResilienceScore: 54,
      },
      informationGapsAndRisks: [
        'Satellites cannot detect subsurface plow hardpans or localized nematode hotspots — dig a 30 cm root inspection pit.',
        'Review seasonal price volatility and fertilizer credit terms with your local agricultural extension officer.',
      ],
    },
    {
      id: 'soil-regenerative-shield',
      name: 'Soil-Regenerative & Water-Shield Rotation',
      tagline: `Continuous canopy cover · ${regenerativeLegume} + ${mainCrop} relay`,
      badgeColor: 'emerald',
      suitabilityScore: regenSuitability,
      monthlyCalendar: buildRegenerativeCalendar(),
      whySuggested: `Eliminates all MODIS bare-soil danger windows (<0.30 NDVI) using pH-matched nitrogen-fixing legumes and deep-rooting cover crops calibrated to ${farm.altitude}m.`,
      nasaEvidenceUsed: [
        `GPM rainfall peaks (${rainPeaks}) are intercepted by >0.46 NDVI canopy cover, cutting SRTM (${farm.altitude}m) erosion risk (${telemetry.topographicErosionScore}/100) by over 60%.`,
        `SMAP Root-Zone Moisture (${telemetry.smapRootMoistureAvg}%) is buffered across dry months (${telemetry.smapDryMonths.join(', ') || 'dry spell'}) via living mulch and higher soil organic carbon.`,
        `ECOSTRESS Evaporative Stress Index (ESI ${telemetry.ecostressEsiAvg.toFixed(2)}) improves by shading soil surface up to 6°C cooler during ${telemetry.ecostressPeakTempC}°C peaks.`,
      ],
      soilAndAgronomicMechanics: {
        phCompatibility: isAcidic
          ? `Pairs acid-tolerant ${regenerativeLegume} with banded compost/lime to neutralize Al³⁺ toxicity at pH ${farm.soilPh.toFixed(1)} and unlock bound Phosphorus.`
          : isAlkaline
            ? `Organic exudates from ${regenerativeLegume} mobilize locked Iron and Zinc in pH ${farm.soilPh.toFixed(1)} ${farm.soilTexture.toLowerCase()} soils.`
            : `pH ${farm.soilPh.toFixed(1)} enables high rhizobia nodulation and 70–110 kg N/ha biological fixation.`,
        nitrogenCycling: 'Positive nitrogen balance (+65 to +110 kg N/ha/yr) via relay legume nodulation and slow-release biomass mulch.',
        erosionAndInfiltration: `Deep taproots fracture ${farm.soilTexture.toLowerCase()} compaction, boosting GPM storm infiltration and keeping NDVI ≥ 0.45 year-round.`,
        pestCycleDisruption: 'Breaks cereal stem-borer, fall armyworm, and fungal spore bridges by alternating botanical families every season.',
      },
      impactMetrics: {
        soilHealthScore: 93,
        waterConservationScore: 90,
        erosionReductionScore: 94,
        nitrogenBalanceScore: 92,
        marketResilienceScore: 76,
      },
      informationGapsAndRisks: [
        'Confirm local seed availability and rhizobium inoculant viability for the selected cover legume before season onset.',
        'If grazing livestock use dry-season stubble, coordinate controlled cut-and-carry strips with community elders or extension staff.',
      ],
    },
    {
      id: 'climate-adaptive-hybrid',
      name: 'Climate-Adaptive Cash & Resilience Hybrid',
      tagline: `Balanced market income + drought-hardy ${resilientCashCrop}`,
      badgeColor: 'cyan',
      suitabilityScore: hybridSuitability,
      monthlyCalendar: buildHybridCalendar(),
      whySuggested: `Combines reliable food & cash harvests with short-season drought-escaping varieties and strip intercropping to shield income against ${telemetry.ecostressPeakTempC}°C heat spikes.`,
      nasaEvidenceUsed: [
        `ECOSTRESS peak temperatures (${telemetry.ecostressPeakTempC}°C, ${telemetry.ecostressHeatStressDays} stress days) are mitigated by shifting sensitive flowering out of hottest dry windows.`,
        `GRACE-FO & SMAP moisture profile (${telemetry.smapRootMoistureAvg}% avg) favors fast-maturing varieties that finish grain fill before root-zone depletion.`,
        `GPM seasonality (${telemetry.gpmSeasonality}, ${telemetry.gpmAnnualRainfallMm} mm/yr) supports staggered planting strips that maintain >0.41 NDVI cover.`,
      ],
      soilAndAgronomicMechanics: {
        phCompatibility: isAcidic
          ? `Integrates acid-resilient cash crops (${resilientCashCrop}) suited to pH ${farm.soilPh.toFixed(1)} while building organic buffering capacity.`
          : isAlkaline
            ? `Selects pH ${farm.soilPh.toFixed(1)}-tolerant cultivars with deep roots that tap subsoil moisture without severe micronutrient chlorosis.`
            : `Optimized for pH ${farm.soilPh.toFixed(1)} with staggered nutrient uptake between shallow cereals and deeper cash pulses.`,
        nitrogenCycling: 'Balanced +25 to +50 kg N/ha/yr from pulse intercrops offsetting cash-crop nutrient export.',
        erosionAndInfiltration: 'Strip-intercropping and mulched furrow ridges slow runoff on sloped terrain while preserving easy harvest access.',
        pestCycleDisruption: 'Botanical diversity and staggered flowering dates suppress specialized pests and reduce total crop-failure risk.',
      },
      impactMetrics: {
        soilHealthScore: 79,
        waterConservationScore: 84,
        erosionReductionScore: 81,
        nitrogenBalanceScore: 77,
        marketResilienceScore: 92,
      },
      informationGapsAndRisks: [
        'Verify local market demand and storage pest control (hermetic bags) for secondary pulse/cash crops before scaling acreage.',
        'Check exact planting dates with district agromet advisories and local extension officers as seasonal onset shifts.',
      ],
    },
  ];
}
