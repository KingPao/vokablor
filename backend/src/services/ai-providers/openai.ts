import { OpenAICompatibleProvider } from './openai-compatible-base.js';
import { AIProviderError } from './types.js';
import type { EvaluateSpeechParams, EvaluateSpeechResult } from './types.js';

/** Learner-configured OpenAI provider (research.md #5); BYO API key, never the shared quota. */
export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string, model: string) {
    super('https://api.openai.com/v1', apiKey, model);
  }

  async evaluateSpeech({
    audio,
    mimeType,
    targetTerm,
    targetTranslation,
    context,
  }: EvaluateSpeechParams): Promise<EvaluateSpeechResult> {
    const transcript = await this.transcribe(audio, mimeType);
    if (!transcript) {
      return { transcript: null, result: 'could_not_evaluate', correctionDetail: null, confidence: null };
    }

    const judgment = await this.generateText({
      context,
      prompt: [
        `Target word/phrase in ${context.languageCode}: "${targetTerm}" (${targetTranslation}).`,
        `Learner said: "${transcript}".`,
        'Judge whether the learner said the target correctly. Respond with strict JSON:',
        '{"result": "correct"|"corrected"|"could_not_evaluate", "correctionDetail": string|null, "confidence": number}',
        'Use "could_not_evaluate" if the transcript is unrelated/unusable rather than guessing.',
      ].join(' '),
    });

    try {
      const parsed = JSON.parse(judgment) as {
        result: EvaluateSpeechResult['result'];
        correctionDetail: string | null;
        confidence: number;
      };
      return { transcript, result: parsed.result, correctionDetail: parsed.correctionDetail, confidence: parsed.confidence };
    } catch {
      return { transcript, result: 'could_not_evaluate', correctionDetail: null, confidence: null };
    }
  }

  private async transcribe(audio: Buffer, mimeType: string): Promise<string | null> {
    const form = new FormData();
    form.append('file', new Blob([audio], { type: mimeType }), 'attempt.webm');
    form.append('model', 'whisper-1');

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!response.ok) {
      throw new AIProviderError(`Transcription request failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as { text?: string };
    return body.text?.trim() || null;
  }
}
