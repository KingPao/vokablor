import { OpenAICompatibleProvider } from './openai-compatible-base.js';
import type { EvaluateSpeechParams, EvaluateSpeechResult } from './types.js';

/**
 * Shared free-tier fallback (research.md #6): NVIDIA's hosted NIM inference API, used by
 * learners who have not configured their own provider. Rate-limited per-learner by
 * middleware/rate-limit.ts, never by this class.
 */
export class NvidiaFreeProvider extends OpenAICompatibleProvider {
  constructor(baseUrl: string, apiKey: string, model: string) {
    super(baseUrl, apiKey, model);
  }

  /**
   * The free-tier text NIM models used here have no audio-transcription capability.
   * Per Principle III, an unsupported capability must surface as an explicit
   * "could not evaluate" outcome, never a fabricated correction.
   */
  async evaluateSpeech(_params: EvaluateSpeechParams): Promise<EvaluateSpeechResult> {
    return {
      transcript: null,
      result: 'could_not_evaluate',
      correctionDetail: null,
      confidence: null,
    };
  }
}

export function createNvidiaFreeProvider(): NvidiaFreeProvider {
  const baseUrl = process.env.NVIDIA_FREE_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
  const apiKey = process.env.NVIDIA_FREE_API_KEY ?? '';
  const model = process.env.NVIDIA_FREE_MODEL ?? 'meta/llama-3.1-8b-instruct';
  return new NvidiaFreeProvider(baseUrl, apiKey, model);
}
