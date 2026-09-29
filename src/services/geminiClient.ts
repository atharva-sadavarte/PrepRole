import {GEMINI_API_KEY} from '../config/env';

/**
 * Robust prioritized models for high-throughput, multimodal audio, and text analysis.
 * Primary: gemini-3.5-flash-lite (high RPM, lightning-fast multimodal audio & structured JSON)
 * Fallback 1: gemini-3.6-flash
 * Fallback 2: gemini-3.1-flash-lite
 */
export const GEMINI_FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
];

interface GeminiCallOptions {
  preferredModel?: string;
  timeoutMs?: number;
}

/**
 * Calls Gemini generateContent with automatic multi-model fallback on rate limits (429)
 * or temporary server unavailability (503/500).
 */
export async function callGeminiApi(
  payload: any,
  options?: GeminiCallOptions,
): Promise<any> {
  const preferred = options?.preferredModel;
  const models = preferred
    ? [preferred, ...GEMINI_FALLBACK_MODELS.filter(m => m !== preferred)]
    : GEMINI_FALLBACK_MODELS;

  let lastError: any = null;

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const controller = new AbortController();
      const timeoutMs = options?.timeoutMs || 25000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        return await response.json();
      }

      const errorBody = await response.text();
      console.warn(
        `[GeminiClient] Model ${model} returned HTTP ${response.status}:`,
        errorBody.slice(0, 160),
      );
      lastError = new Error(`HTTP ${response.status} from ${model}`);

      // If rate limited or unavailable, continue immediately to next fallback model
      if (
        response.status === 429 ||
        response.status === 503 ||
        response.status === 500 ||
        response.status === 404
      ) {
        continue;
      }
    } catch (err: any) {
      console.warn(`[GeminiClient] Fetch error with ${model}:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini AI model options were exhausted.');
}
