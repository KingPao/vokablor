import type {
  AIProvider,
  ConverseTurnParams,
  ConverseTurnResult,
  EvaluateSpeechParams,
  EvaluateSpeechResult,
  GenerateTextParams,
} from './types.js';
import { AIProviderError } from './types.js';

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Learner-configured Google (Gemini) provider (research.md #5); BYO API key. */
export class GoogleProvider implements AIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  private async generateContent(parts: object[]): Promise<string> {
    const response = await fetch(
      `${GOOGLE_API_BASE}/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      },
    );

    if (!response.ok) {
      throw new AIProviderError(`Google request failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AIProviderError('Google response had no text content');
    return text;
  }

  async generateText({ prompt, context }: GenerateTextParams): Promise<string> {
    return this.generateContent([
      {
        text: `You are a language-learning assistant helping a learner of ${context.languageCode} at CEFR level ${context.level}. ${prompt}`,
      },
    ]);
  }

  async converseTurn({
    history,
    learnerMessage,
    knownVocabulary,
    context,
  }: ConverseTurnParams): Promise<ConverseTurnResult> {
    const transcript = history.map((t) => `${t.speaker}: ${t.content}`).join('\n');
    const prompt = [
      `You are a conversation partner helping a learner practice ${context.languageCode} at CEFR level ${context.level}.`,
      `Known vocabulary: ${knownVocabulary.join(', ') || '(none yet)'}.`,
      'Reply only in the target language. Correct any learner error explicitly and specifically.',
      'Respond with strict JSON: {"reply": string, "flaggedNewVocabulary": string[], "correctionDetail": string|null}.',
      `Conversation so far:\n${transcript}\nlearner: ${learnerMessage}`,
    ].join(' ');

    const raw = await this.generateContent([{ text: prompt }]);
    try {
      const parsed = JSON.parse(raw) as {
        reply: string;
        flaggedNewVocabulary?: string[];
        correctionDetail?: string | null;
      };
      return {
        reply: parsed.reply,
        flaggedNewVocabulary: parsed.flaggedNewVocabulary ?? [],
        correctionDetail: parsed.correctionDetail ?? null,
      };
    } catch {
      return { reply: raw, flaggedNewVocabulary: [], correctionDetail: null };
    }
  }

  /** Gemini accepts inline audio parts, so transcription + judgment happen in one call. */
  async evaluateSpeech({
    audio,
    mimeType,
    targetTerm,
    targetTranslation,
    context,
  }: EvaluateSpeechParams): Promise<EvaluateSpeechResult> {
    const raw = await this.generateContent([
      {
        text: [
          `Target word/phrase in ${context.languageCode}: "${targetTerm}" (${targetTranslation}).`,
          'Listen to the attached audio of a learner attempting to say it.',
          'Respond with strict JSON:',
          '{"transcript": string|null, "result": "correct"|"corrected"|"could_not_evaluate", "correctionDetail": string|null, "confidence": number}',
          'Use "could_not_evaluate" if the audio is inaudible/unrelated rather than guessing.',
        ].join(' '),
      },
      { inline_data: { mime_type: mimeType, data: audio.toString('base64') } },
    ]);

    try {
      const parsed = JSON.parse(raw) as {
        transcript: string | null;
        result: EvaluateSpeechResult['result'];
        correctionDetail: string | null;
        confidence: number;
      };
      return parsed;
    } catch {
      return { transcript: null, result: 'could_not_evaluate', correctionDetail: null, confidence: null };
    }
  }
}
