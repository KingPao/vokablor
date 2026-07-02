import type {
  AIProvider,
  ConverseTurnParams,
  ConverseTurnResult,
  EvaluateSpeechParams,
  EvaluateSpeechResult,
  GenerateTextParams,
} from './types.js';
import { AIProviderError } from './types.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/** Learner-configured Anthropic provider (research.md #5); BYO API key. */
export class AnthropicProvider implements AIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  private async createMessage(system: string, userContent: string): Promise<string> {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      throw new AIProviderError(`Anthropic request failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((block) => block.type === 'text')?.text;
    if (!text) throw new AIProviderError('Anthropic response had no text content');
    return text;
  }

  async generateText({ prompt, context }: GenerateTextParams): Promise<string> {
    return this.createMessage(
      `You are a language-learning assistant helping a learner of ${context.languageCode} at CEFR level ${context.level}.`,
      prompt,
    );
  }

  async converseTurn({
    history,
    learnerMessage,
    knownVocabulary,
    context,
  }: ConverseTurnParams): Promise<ConverseTurnResult> {
    const system = [
      `You are a conversation partner helping a learner practice ${context.languageCode} at CEFR level ${context.level}.`,
      `Known vocabulary: ${knownVocabulary.join(', ') || '(none yet)'}.`,
      'Reply only in the target language. Correct any learner error explicitly and specifically.',
      'Respond with strict JSON: {"reply": string, "flaggedNewVocabulary": string[], "correctionDetail": string|null}.',
    ].join(' ');

    const transcript = history.map((t) => `${t.speaker}: ${t.content}`).join('\n');
    const raw = await this.createMessage(system, `${transcript}\nlearner: ${learnerMessage}`);

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

  /** Claude has no audio-input capability in this integration — an honest capability gap, not a guess. */
  async evaluateSpeech(_params: EvaluateSpeechParams): Promise<EvaluateSpeechResult> {
    return { transcript: null, result: 'could_not_evaluate', correctionDetail: null, confidence: null };
  }
}
