import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  CalibrationAnswer,
  CalibrationQuestion,
  FarmContext,
  NasaTelemetryPayload,
  RotationStrategy,
} from './src/types/agro';
import {
  buildDeterministicCalibrationQuestions,
  buildDeterministicStrategies,
} from './src/utils/agroCalculations';

const PORT = 3000;

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithModelFallback<T>(
  ai: GoogleGenAI,
  contents: string,
  systemInstruction: string,
  responseSchema: Record<string, unknown>,
): Promise<{ data: T; modelUsed: string }> {
  const model = 'gemini-4-hydrogen';
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini request timeout')), 26000),
  );

  const response = await Promise.race([
    ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    }),
    timeoutPromise,
  ]);

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error(`Empty response from ${model}`);
  }
  const parsed = JSON.parse(rawText) as T;
  return { data: parsed, modelUsed: model };
}

const CALIBRATION_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      satelliteTrigger: { type: Type.STRING },
      question: { type: Type.STRING },
      whyWeAsk: { type: Type.STRING },
      quickOptions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: ['id', 'satelliteTrigger', 'question', 'whyWeAsk', 'quickOptions'],
  },
};

const STRATEGIES_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      name: { type: Type.STRING },
      tagline: { type: Type.STRING },
      badgeColor: { type: Type.STRING },
      suitabilityScore: { type: Type.NUMBER },
      monthlyCalendar: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            month: { type: Type.STRING },
            cropName: { type: Type.STRING },
            stage: { type: Type.STRING },
            ndviTarget: { type: Type.NUMBER },
            waterDemand: { type: Type.STRING },
          },
          required: ['month', 'cropName', 'stage', 'ndviTarget', 'waterDemand'],
        },
      },
      whySuggested: { type: Type.STRING },
      nasaEvidenceUsed: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      soilAndAgronomicMechanics: {
        type: Type.OBJECT,
        properties: {
          phCompatibility: { type: Type.STRING },
          nitrogenCycling: { type: Type.STRING },
          erosionAndInfiltration: { type: Type.STRING },
          pestCycleDisruption: { type: Type.STRING },
        },
        required: ['phCompatibility', 'nitrogenCycling', 'erosionAndInfiltration', 'pestCycleDisruption'],
      },
      impactMetrics: {
        type: Type.OBJECT,
        properties: {
          soilHealthScore: { type: Type.NUMBER },
          waterConservationScore: { type: Type.NUMBER },
          erosionReductionScore: { type: Type.NUMBER },
          nitrogenBalanceScore: { type: Type.NUMBER },
          marketResilienceScore: { type: Type.NUMBER },
        },
        required: [
          'soilHealthScore',
          'waterConservationScore',
          'erosionReductionScore',
          'nitrogenBalanceScore',
          'marketResilienceScore',
        ],
      },
      informationGapsAndRisks: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: [
      'id',
      'name',
      'tagline',
      'badgeColor',
      'suitabilityScore',
      'monthlyCalendar',
      'whySuggested',
      'nasaEvidenceUsed',
      'soilAndAgronomicMechanics',
      'impactMetrics',
      'informationGapsAndRisks',
    ],
  },
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    const ai = createGeminiClient();
    res.json({
      ok: true,
      geminiConfigured: ai !== null,
    });
  });

  app.post('/api/ai/calibrate', async (req, res) => {
    const { farmContext, nasaTelemetry } = req.body as {
      farmContext?: FarmContext;
      nasaTelemetry?: NasaTelemetryPayload;
    };

    if (!farmContext || !nasaTelemetry) {
      res.status(400).json({ error: 'Missing farmContext or nasaTelemetry' });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      const questions = buildDeterministicCalibrationQuestions(farmContext, nasaTelemetry);
      res.json({ questions, source: 'fallback', modelUsed: 'agro-deterministic' });
      return;
    }

    try {
      const prompt = JSON.stringify({
        farmContext,
        telemetrySummary: {
          smapRootMoistureAvg: nasaTelemetry.smapRootMoistureAvg,
          smapDryMonths: nasaTelemetry.smapDryMonths,
          ecostressPeakTempC: nasaTelemetry.ecostressPeakTempC,
          ecostressEsiAvg: nasaTelemetry.ecostressEsiAvg,
          gpmAnnualRainfallMm: nasaTelemetry.gpmAnnualRainfallMm,
          gpmSeasonality: nasaTelemetry.gpmSeasonality,
          gpmFrostRiskLevel: nasaTelemetry.gpmFrostRiskLevel,
          srtmAltitudeM: nasaTelemetry.srtmAltitudeM,
          topographicErosionScore: nasaTelemetry.topographicErosionScore,
          bareSoilDangerMonths: nasaTelemetry.bareSoilDangerMonths,
          graceGroundwaterTrend: nasaTelemetry.graceGroundwaterTrend,
        },
      });

      const systemInstruction = `You are a NASA Earth Observation Data Scientist & Practical Agronomist.
Analyze the tension between the farmer's ground-truth inputs (soil pH, altitude, texture, current crops, priorities) and the NASA satellite telemetry.
Return EXACTLY 3 hyper-specific diagnostic calibration questions to uncover things satellites cannot see (crop residue habits, local lime/manure access, subsurface hardpans, or local market buyers).
Keep questions respectful, plain-spoken, and actionable. Each quickOptions array must have 3-4 short clickable answer choices.`;

      const result = await generateWithModelFallback<CalibrationQuestion[]>(
        ai,
        prompt,
        systemInstruction,
        CALIBRATION_SCHEMA,
      );

      if (!Array.isArray(result.data) || result.data.length !== 3) {
        throw new Error('Unexpected question array length');
      }

      res.json({ questions: result.data, source: 'gemini', modelUsed: result.modelUsed });
    } catch {
      const questions = buildDeterministicCalibrationQuestions(farmContext, nasaTelemetry);
      res.json({ questions, source: 'fallback', modelUsed: 'agro-deterministic' });
    }
  });

  app.post('/api/ai/strategies', async (req, res) => {
    const { farmContext, nasaTelemetry, calibrationAnswers } = req.body as {
      farmContext?: FarmContext;
      nasaTelemetry?: NasaTelemetryPayload;
      calibrationAnswers?: CalibrationAnswer[];
    };

    if (!farmContext || !nasaTelemetry) {
      res.status(400).json({ error: 'Missing farmContext or nasaTelemetry' });
      return;
    }

    const answers = calibrationAnswers ?? [];
    const ai = createGeminiClient();
    if (!ai) {
      const strategies = buildDeterministicStrategies(farmContext, nasaTelemetry, answers);
      res.json({ strategies, source: 'fallback', modelUsed: 'agro-deterministic' });
      return;
    }

    try {
      const prompt = JSON.stringify({
        farmContext,
        calibrationAnswers: answers,
        monthlyTelemetry: nasaTelemetry.monthly.map((m) => ({
          month: m.month,
          rainMm: m.gpmRainfallMm,
          smapRootPct: m.smapRootMoisturePct,
          tMaxC: m.t2mMax,
          ndvi: m.ndviCover,
          bareDanger: m.isBareSoilDanger,
        })),
        summaryTelemetry: {
          smapRootMoistureAvg: nasaTelemetry.smapRootMoistureAvg,
          ecostressPeakTempC: nasaTelemetry.ecostressPeakTempC,
          ecostressEsiAvg: nasaTelemetry.ecostressEsiAvg,
          gpmAnnualRainfallMm: nasaTelemetry.gpmAnnualRainfallMm,
          gpmSeasonality: nasaTelemetry.gpmSeasonality,
          srtmAltitudeM: nasaTelemetry.srtmAltitudeM,
          topographicErosionScore: nasaTelemetry.topographicErosionScore,
          graceGroundwaterTrend: nasaTelemetry.graceGroundwaterTrend,
        },
      });

      const systemInstruction = `You are a Principal Agronomic Systems Architect & NASA Earth Observation Specialist.
Generate EXACTLY 3 Detailed Crop Rotation Strategies in order:
1) "Baseline Continuation (Current System)" — badgeColor: "amber" — honest 3-year projection keeping current crops.
2) "Soil-Regenerative & Water-Shield Rotation" — badgeColor: "emerald" — eliminates bare-soil erosion windows (<0.30 NDVI) using pH-matched nitrogen-fixing legumes & cover crops.
3) "Climate-Adaptive Cash & Resilience Hybrid" — badgeColor: "cyan" — balances strong local cash/food market value with drought-tolerant varieties and pest-cycle disruption.

Rules:
- Each monthlyCalendar MUST have exactly 12 entries from "Jan" to "Dec".
- stage MUST be one of: "Planting", "Growing", "Harvest", "Cover Crop", "Bare Soil".
- waterDemand MUST be one of: "Low", "Medium", "High".
- ndviTarget MUST be between 0.15 and 0.90.
- nasaEvidenceUsed must explicitly cite SMAP, ECOSTRESS, GPM, MODIS/Landsat, and SRTM numbers from the input.
- All scores in impactMetrics and suitabilityScore must be integers 0 to 100.`;

      const result = await generateWithModelFallback<RotationStrategy[]>(
        ai,
        prompt,
        systemInstruction,
        STRATEGIES_SCHEMA,
      );

      if (!Array.isArray(result.data) || result.data.length !== 3) {
        throw new Error('Unexpected strategy array length');
      }

      // Normalize badgeColors and ensure 12 months
      const normalized = result.data.map((s, idx) => ({
        ...s,
        badgeColor: (idx === 0 ? 'amber' : idx === 1 ? 'emerald' : 'cyan') as 'amber' | 'emerald' | 'cyan',
        monthlyCalendar: s.monthlyCalendar.slice(0, 12),
      }));

      res.json({ strategies: normalized, source: 'gemini', modelUsed: result.modelUsed });
    } catch {
      const strategies = buildDeterministicStrategies(farmContext, nasaTelemetry, answers);
      res.json({ strategies, source: 'fallback', modelUsed: 'agro-deterministic' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TerraShift server running on http://localhost:${PORT}`);
  });
}

startServer();
