import type {
  CalibrationAnswer,
  CalibrationQuestion,
  FarmContext,
  LanguageMode,
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
  languageMode: LanguageMode = 'scientist',
): Promise<{ questions: CalibrationQuestion[] } & AiServiceMeta> {
  try {
    const res = await fetch('/api/ai/calibrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmContext, nasaTelemetry, languageMode }),
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
      questions: buildDeterministicCalibrationQuestions(farmContext, nasaTelemetry, languageMode),
      source: 'fallback',
      modelUsed: 'agro-deterministic',
    };
  }
}

export async function generateRotationStrategies(
  farmContext: FarmContext,
  nasaTelemetry: NasaTelemetryPayload,
  calibrationAnswers: CalibrationAnswer[],
  languageMode: LanguageMode = 'scientist',
): Promise<{ strategies: RotationStrategy[] } & AiServiceMeta> {
  try {
    const res = await fetch('/api/ai/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmContext, nasaTelemetry, calibrationAnswers, languageMode }),
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
      strategies: buildDeterministicStrategies(farmContext, nasaTelemetry, calibrationAnswers, languageMode),
      source: 'fallback',
      modelUsed: 'agro-deterministic',
    };
  }
}
