import type {
  AIProvider,
  ConverseTurnParams,
  ConverseTurnResult,
  EvaluateSpeechParams,
  EvaluateSpeechResult,
  GenerateTextParams,
} from './types.js';
import { AIProviderError } from './types.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Shared implementation for providers exposing an OpenAI-compatible `/chat/completions`
 * endpoint (research.md #1/#5) — NVIDIA's free-tier NIM API and OpenAI itself both mirror
 * this shape, so generateText/converseTurn logic is written once here.
 */
export abstract class OpenAICompatibleProvider implements AIProvider {
  constructor(
    protected readonly baseUrl: string,
    protected readonly apiKey: string,
    protected readonly model: string,
  ) {}

  private async chatCompletion(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, messages, temperature: 0.4 }),
    });

    if (!response.ok) {
      throw new AIProviderError(`Chat completion request failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new AIProviderError('Chat completion response had no content');
    }
    return content;
  }

  async generateText({ prompt, context }: GenerateTextParams): Promise<string> {
    return this.chatCompletion([
      {
        role: 'system',
        content: `You are a language-learning assistant helping a learner of ${context.languageCode} at CEFR level ${context.level}.`,
      },
      { role: 'user', content: prompt },
    ]);
  }

  async converseTurn({
    history,
    learnerMessage,
    knownVocabulary,
    context,
  }: ConverseTurnParams): Promise<ConverseTurnResult> {
    const systemPrompt = [
      `You are a conversation partner helping a learner practice ${context.languageCode} at CEFR level ${context.level}.`,
      `Known vocabulary: ${knownVocabulary.join(', ') || '(none yet)'}.`,
      'Reply only in the target language, staying close to the known vocabulary and level.',
      'If the learner made a language error, correct it explicitly and specifically.',
      'Respond with strict JSON: {"reply": string, "flaggedNewVocabulary": string[], "correctionDetail": string|null}.',
      'flaggedNewVocabulary lists any words in your reply that are not in the known vocabulary list.',
      'correctionDetail is null unless the learner message actually contained an error.',
    ].join(' ');

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((turn) => ({
        role: (turn.speaker === 'ai' ? 'assistant' : 'user') as ChatMessage['role'],
        content: turn.content,
      })),
      { role: 'user', content: learnerMessage },
    ];

    const raw = await this.chatCompletion(messages);
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
      // Model didn't honor the JSON contract — surface the raw reply rather than
      // fabricating structured fields we don't actually have (Principle III).
      return { reply: raw, flaggedNewVocabulary: [], correctionDetail: null };
    }
  }

  abstract evaluateSpeech(params: EvaluateSpeechParams): Promise<EvaluateSpeechResult>;
}
