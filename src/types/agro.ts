export type SoilTexture = 'Clay' | 'Loamy' | 'Sandy' | 'Volcanic Ash';

export type LanguageMode = 'farmer' | 'scientist';

export type DataSourceMode = 'live' | 'cached';

export type CropStage = 'Planting' | 'Growing' | 'Harvest' | 'Cover Crop' | 'Bare Soil';

export type WaterDemand = 'Low' | 'Medium' | 'High';

export interface RegionalPreset {
  id: string;
  name: string;
  shortLabel: string;
  regionLabel: string;
  lat: number;
  lon: number;
  defaultAltitude: number;
  defaultPh: number;
  defaultTexture: SoilTexture;
  defaultCrops: string[];
  defaultPriorities: string[];
  agroSummary: string;
}

export interface FarmContext {
  locationName: string;
  lat: number;
  lon: number;
  altitude: number;
  soilPh: number;
  soilTexture: SoilTexture;
  currentCrops: string[];
  priorities: string[];
}

export interface MonthlyClimatePoint {
  month: string;
  monthIndex: number; // 0..11
  t2m: number; // °C mean
  t2mMax: number; // °C max
  t2mMin: number; // °C min
  gpmRainfallMm: number; // monthly mm
  smapRootMoisturePct: number; // 0..100 %
  smapSurfaceWetnessPct: number; // 0..100 %
  evland: number; // mm/day latent heat flux proxy or ET mm/day
  solarSwDwn: number; // MJ/m2/day or kWh/m2/day
  esiRatio: number; // Evaporative Stress Index ratio (0..2)
  ndviCover: number; // 0.0..1.0 MODIS/Landsat vegetation vigor
  isBareSoilDanger: boolean;
  bareSoilRiskReason: string | null;
}

export interface NasaTelemetryPayload {
  lat: number;
  lon: number;
  fetchedAt: string;
  monthly: MonthlyClimatePoint[];
  smapRootMoistureAvg: number;
  smapSurfaceWetnessAvg: number;
  smapMoistureAnomalyPct: number;
  smapDryMonths: string[];
  ecostressPeakTempC: number;
  ecostressEsiAvg: number;
  ecostressHeatStressDays: number;
  gpmAnnualRainfallMm: number;
  gpmSeasonality: 'Bimodal' | 'Unimodal' | 'Arid / Irrigated';
  gpmFrostRiskLevel: 'None' | 'Low' | 'Moderate' | 'High';
  srtmAltitudeM: number;
  topographicErosionScore: number;
  soilGridsPh: number;
  soilGridsTexture: SoilTexture;
  soilGridsClayPct: number;
  soilGridsSandPct: number;
  soilGridsSocGKg: number;
  graceGroundwaterTrend: string;
  bareSoilDangerMonths: string[];
  dataSources: {
    nasaPower: DataSourceMode;
    srtmElevation: DataSourceMode;
    soilGrids: DataSourceMode;
  };
}

export interface CalibrationQuestion {
  id: string;
  satelliteTrigger: string;
  question: string;
  whyWeAsk: string;
  quickOptions: string[];
}

export interface CalibrationAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface MonthlyCropPlan {
  month: string;
  cropName: string;
  stage: CropStage;
  ndviTarget: number;
  waterDemand: WaterDemand;
}

export interface AgronomicMechanics {
  phCompatibility: string;
  nitrogenCycling: string;
  erosionAndInfiltration: string;
  pestCycleDisruption: string;
}

export interface StrategyImpactMetrics {
  soilHealthScore: number;
  waterConservationScore: number;
  erosionReductionScore: number;
  nitrogenBalanceScore: number;
  marketResilienceScore: number;
}

export interface RotationStrategy {
  id: string;
  name: string;
  tagline: string;
  badgeColor: 'amber' | 'emerald' | 'cyan';
  suitabilityScore: number;
  monthlyCalendar: MonthlyCropPlan[];
  whySuggested: string;
  nasaEvidenceUsed: string[];
  soilAndAgronomicMechanics: AgronomicMechanics;
  impactMetrics: StrategyImpactMetrics;
  informationGapsAndRisks: string[];
}

export interface StressTestResult {
  strategyId: string;
  adjustedSuitabilityScore: number;
  scoreDelta: number;
  yieldRetentionPct: number;
  survivalStatus: 'Resilient' | 'Strained' | 'Critical Risk';
  stressWarning: string;
}

export interface PhWarningInfo {
  severity: 'critical' | 'caution' | 'optimal';
  label: string;
  detail: string;
}
