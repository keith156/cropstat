import type { RegionalPreset, SoilTexture } from '../types/agro';

export const REGIONAL_PRESETS: RegionalPreset[] = [
  {
    id: 'wakiso-uganda',
    name: 'Lake Victoria Basin / Wakiso-Kampala, Uganda',
    shortLabel: 'Wakiso, Uganda',
    regionLabel: 'Equatorial Bimodal Ferralsol',
    lat: 0.3476,
    lon: 32.5825,
    defaultAltitude: 1200,
    defaultPh: 5.4,
    defaultTexture: 'Clay',
    defaultCrops: ['Maize', 'Beans'],
    defaultPriorities: ['Fix Nitrogen', 'Stop Slope Erosion', 'High Cash Income'],
    agroSummary: 'Bimodal rainy seasons (Mar–May, Sep–Nov), acidic Ferralsols risking Al toxicity below pH 5.5, post-harvest bare soil vulnerability before second rains.',
  },
  {
    id: 'elgon-uganda',
    name: 'Mt. Elgon / Kapchorwa Highlands, Uganda',
    shortLabel: 'Mt. Elgon, Uganda',
    regionLabel: 'Highland Volcanic Slope',
    lat: 1.333,
    lon: 34.45,
    defaultAltitude: 1850,
    defaultPh: 6.1,
    defaultTexture: 'Volcanic Ash',
    defaultCrops: ['Coffee', 'Maize', 'Beans'],
    defaultPriorities: ['Stop Slope Erosion', 'Conserve Water', 'Break Pest Cycles'],
    agroSummary: 'Steep volcanic highlands with high convective rainfall intensity, severe gully erosion risk when maize stover is cleared before peak rains.',
  },
  {
    id: 'central-valley-usa',
    name: 'Central Valley, California, USA',
    shortLabel: 'Central Valley, USA',
    regionLabel: 'Arid Irrigated Alluvial',
    lat: 36.7783,
    lon: -119.4179,
    defaultAltitude: 90,
    defaultPh: 7.4,
    defaultTexture: 'Loamy',
    defaultCrops: ['Wheat', 'Maize'],
    defaultPriorities: ['Conserve Water', 'High Cash Income', 'Fix Nitrogen'],
    agroSummary: 'Mediterranean summer-dry climate with GRACE-FO groundwater depletion pressure, alkaline micronutrient lock-up above pH 7.5, and high summer evaporative stress.',
  },
  {
    id: 'machakos-kenya',
    name: 'Semi-Arid Machakos, Kenya',
    shortLabel: 'Machakos, Kenya',
    regionLabel: 'Semi-Arid Mid-Altitude',
    lat: -1.5177,
    lon: 37.2634,
    defaultAltitude: 1500,
    defaultPh: 6.3,
    defaultTexture: 'Sandy',
    defaultCrops: ['Sorghum', 'Maize', 'Beans'],
    defaultPriorities: ['Conserve Water', 'Fix Nitrogen', 'Livestock Forage'],
    agroSummary: 'Short unpredictable bimodal rains with prolonged dry spells, high surface runoff on crusted sandy-loam soils, high payoff from legume cover and tied ridges.',
  },
];

export const CROP_OPTIONS: string[] = [
  'Maize',
  'Beans',
  'Coffee',
  'Cassava',
  'Banana/Matooke',
  'Sorghum',
  'Soybeans',
  'Groundnuts',
  'Wheat',
  'Irish Potatoes',
];

export const PRIORITY_OPTIONS: string[] = [
  'Conserve Water',
  'Fix Nitrogen',
  'Stop Slope Erosion',
  'Break Pest Cycles',
  'High Cash Income',
  'Livestock Forage',
];

export const SOIL_TEXTURE_OPTIONS: SoilTexture[] = [
  'Clay',
  'Loamy',
  'Sandy',
  'Volcanic Ash',
];

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
