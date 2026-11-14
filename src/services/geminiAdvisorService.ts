import type {
  CalibrationAnswer,
  CalibrationQuestion,
  FarmContext,
  NasaTelemetryPayload,
  RotationStrategy,
} from '../types/agro';
import {
  buildDeterministicCalibrationQuestions,
  buildDeterministicStrategies,
} from '../utils/agroCalculations';

export interface AiServiceMeta {
  source: 'gemini' | 'fallback';
  modelUsed: string;
}

export async function checkAiHealth(): Promise<{ ok: boolean; geminiConfigured: boolean }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { ok: false, geminiConfigured: false };
    return (await res.json()) as { ok: boolean; geminiConfigured: boolean };
  } catch {
    return { ok: false, geminiConfigured: false };
  }
}

export async function generateCalibrationQuestions(
  farmContext: FarmContext,
  nasaTelemetry: NasaTelemetryPayload,
): Promise<{ questions: CalibrationQuestion[] } & AiServiceMeta> {
  try {
    const res = await fetch('/api/ai/calibrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmContext, nasaTelemetry }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      questions: CalibrationQuestion[];
      source: 'gemini' | 'fallback';
      modelUsed: string;
    };
    return data;
  } catch {
    return {
      questions: buildDeterministicCalibrationQuestions(farmContext, nasaTelemetry),
      source: 'fallback',
      modelUsed: 'agro-deterministic',
    };
  }
}

export async function generateRotationStrategies(
  farmContext: FarmContext,
  nasaTelemetry: NasaTelemetryPayload,
  calibrationAnswers: CalibrationAnswer[],
): Promise<{ strategies: RotationStrategy[] } & AiServiceMeta> {
  try {
    const res = await fetch('/api/ai/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmContext, nasaTelemetry, calibrationAnswers }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      strategies: RotationStrategy[];
      source: 'gemini' | 'fallback';
      modelUsed: string;
    };
    return data;
  } catch {
    return {
      strategies: buildDeterministicStrategies(farmContext, nasaTelemetry, calibrationAnswers),
      source: 'fallback',
      modelUsed: 'agro-deterministic',
    };
  }
}
