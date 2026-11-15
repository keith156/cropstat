import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeterministicCalibrationQuestions,
  buildDeterministicStrategies,
  computeFrostRisk,
  computeNdviAndBareSoilWindows,
  computePhWarnings,
  computeTopographicErosionScore,
  evaluateClimateStressTest,
  parseAndValidateCoordinates,
} from './agroCalculations';
import type { FarmContext, NasaTelemetryPayload } from '../types/agro';

function createMockRawMonths() {
  // Bimodal rainfall with sharp dry-to-wet transition in Mar (idx 2) and Sep (idx 8)
  const rains = [35, 42, 135, 195, 150, 48, 30, 52, 128, 175, 145, 58];
  const moistures = [42, 38, 52, 74, 76, 58, 40, 39, 55, 72, 75, 55];
  return rains.map((rain, idx) => ({
    monthIndex: idx,
    t2m: 22.5,
    t2mMax: 29.0 + (idx === 1 || idx === 7 ? 3.5 : 0),
    t2mMin: 15.0,
    gpmRainfallMm: rain,
    smapRootMoisturePct: moistures[idx],
    smapSurfaceWetnessPct: moistures[idx] - 5,
    evland: 3.4,
    solarSwDwn: 5.4,
    esiRatio: rain > 100 ? 0.65 : 1.35,
  }));
}

function createSampleFarm(): FarmContext {
  return {
    locationName: 'Lake Victoria Basin / Wakiso-Kampala, Uganda',
    lat: 0.3476,
    lon: 32.5825,
    altitude: 1200,
    soilPh: 5.4,
    soilTexture: 'Clay',
    currentCrops: ['Maize', 'Beans'],
    priorities: ['Fix Nitrogen', 'Stop Slope Erosion', 'High Cash Income'],
  };
}

function createSampleTelemetry(farm: FarmContext): NasaTelemetryPayload {
  const monthly = computeNdviAndBareSoilWindows(createMockRawMonths(), farm.currentCrops);
  const bareSoilDangerMonths = monthly.filter((m) => m.isBareSoilDanger).map((m) => m.month);
  return {
    lat: farm.lat,
    lon: farm.lon,
    fetchedAt: '2026-11-14T00:00:00Z',
    monthly,
    smapRootMoistureAvg: 56,
    smapSurfaceWetnessAvg: 51,
    smapMoistureAnomalyPct: -4,
    smapDryMonths: ['Jan', 'Feb', 'Jul', 'Aug'],
    ecostressPeakTempC: 32.5,
    ecostressEsiAvg: 0.96,
    ecostressHeatStressDays: 34,
    gpmAnnualRainfallMm: 1238,
    gpmSeasonality: 'Bimodal',
    gpmFrostRiskLevel: computeFrostRisk(15.0, farm.altitude),
    srtmAltitudeM: farm.altitude,
    topographicErosionScore: computeTopographicErosionScore(farm.altitude, 195, farm.soilTexture, bareSoilDangerMonths.length),
    soilGridsPh: 5.4,
    soilGridsTexture: 'Clay',
    soilGridsClayPct: 44,
    soilGridsSandPct: 28,
    soilGridsSocGKg: 21,
    graceGroundwaterTrend: 'Stable seasonal recharge (+0.4 cm/yr)',
    bareSoilDangerMonths,
    dataSources: {
      nasaPower: 'cached',
      srtmElevation: 'cached',
      soilGrids: 'cached',
    },
  };
}

test('computePhWarnings triggers critical/caution warnings at acidic and alkaline bounds', () => {
  const veryAcid = computePhWarnings(4.7);
  assert.equal(veryAcid.severity, 'critical');
  assert.match(veryAcid.label, /Toxicity/i);

  const moderateAcid = computePhWarnings(5.4);
  assert.equal(moderateAcid.severity, 'caution');

  const optimal = computePhWarnings(6.4);
  assert.equal(optimal.severity, 'optimal');

  const highAlk = computePhWarnings(8.1);
  assert.equal(highAlk.severity, 'critical');
  assert.match(highAlk.label, /Lock-Up/i);
});

test('computeNdviAndBareSoilWindows flags bare-soil danger during rain onset on annual crops', () => {
  const monthly = computeNdviAndBareSoilWindows(createMockRawMonths(), ['Maize', 'Beans']);
  assert.equal(monthly.length, 12);
  const dangerMonths = monthly.filter((m) => m.isBareSoilDanger);
  assert.ok(dangerMonths.length >= 1, 'Expected at least 1 bare-soil danger month during rain onset');
  for (const dm of dangerMonths) {
    assert.ok(dm.ndviCover < 0.32, 'Danger month NDVI should be low');
    assert.ok(dm.bareSoilRiskReason && dm.bareSoilRiskReason.length > 10);
  }
});

test('computeTopographicErosionScore scales sensibly between lowland and highland slopes', () => {
  const lowScore = computeTopographicErosionScore(90, 65, 'Loamy', 0);
  const highScore = computeTopographicErosionScore(1900, 220, 'Sandy', 3);
  assert.ok(highScore > lowScore + 30);
  assert.ok(lowScore >= 8 && highScore <= 98);
});

test('evaluateClimateStressTest degrades baseline monoculture faster than regenerative strategy', () => {
  const farm = createSampleFarm();
  const telemetry = createSampleTelemetry(farm);
  const questions = buildDeterministicCalibrationQuestions(farm, telemetry);
  const answers = questions.map((q) => ({
    questionId: q.id,
    question: q.question,
    answer: q.quickOptions[0],
  }));
  const strategies = buildDeterministicStrategies(farm, telemetry, answers);
  assert.equal(strategies.length, 3);

  const baseline = strategies[0];
  const regenerative = strategies[1];

  const baselineNoShock = evaluateClimateStressTest(baseline, telemetry, 0, 0);
  assert.equal(baselineNoShock.adjustedSuitabilityScore, baseline.suitabilityScore);

  const baselineShock = evaluateClimateStressTest(baseline, telemetry, 3.0, -30);
  const regenShock = evaluateClimateStressTest(regenerative, telemetry, 3.0, -30);

  assert.ok(baselineShock.scoreDelta < 0, 'Heat + drought shock should reduce suitability score');
  assert.ok(regenShock.adjustedSuitabilityScore > baselineShock.adjustedSuitabilityScore, 'Regenerative strategy should retain higher suitability under shock');
  assert.ok(regenShock.yieldRetentionPct > baselineShock.yieldRetentionPct, 'Regenerative strategy should retain higher yield % under shock');
});

test('deterministic fallback strategies produce complete 12-month calendars and NASA citations', () => {
  const farm = createSampleFarm();
  const telemetry = createSampleTelemetry(farm);
  const questions = buildDeterministicCalibrationQuestions(farm, telemetry);
  assert.equal(questions.length, 3);
  for (const q of questions) {
    assert.ok(q.satelliteTrigger.length > 5);
    assert.ok(q.quickOptions.length >= 3);
  }

  const strategies = buildDeterministicStrategies(farm, telemetry, []);
  assert.equal(strategies.length, 3);
  for (const strat of strategies) {
    assert.equal(strat.monthlyCalendar.length, 12);
    assert.ok(strat.nasaEvidenceUsed.length >= 3);
    assert.ok(strat.informationGapsAndRisks.length >= 2);
  }
});

test('parseAndValidateCoordinates handles valid decimals, comma-separated paste, and out-of-bounds errors', () => {
  const valid = parseAndValidateCoordinates('0.34764', '32.58254');
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.lat, 0.3476);
    assert.equal(valid.lon, 32.5825);
  }

  const pasted = parseAndValidateCoordinates('36.7783, -119.4179', '');
  assert.equal(pasted.ok, true);
  if (pasted.ok) {
    assert.equal(pasted.lat, 36.7783);
    assert.equal(pasted.lon, -119.4179);
  }

  const badLat = parseAndValidateCoordinates('95', '32');
  assert.equal(badLat.ok, false);

  const badLon = parseAndValidateCoordinates('12', '-190');
  assert.equal(badLon.ok, false);

  const nonNum = parseAndValidateCoordinates('abc', '32');
  assert.equal(nonNum.ok, false);
});
