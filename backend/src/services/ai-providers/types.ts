import type { ProficiencyLevel, SpeakingEvaluationResult } from '../../db/schema.js';

export interface AIRequestContext {
  languageCode: string;
  level: ProficiencyLevel;
}

export interface GenerateTextParams {
  prompt: string;
  context: AIRequestContext;
}

export interface EvaluateSpeechParams {
  audio: Buffer;
  mimeType: string;
  targetTerm: string;
  targetTranslation: string;
  context: AIRequestContext;
}

export interface EvaluateSpeechResult {
  transcript: string | null;
  result: SpeakingEvaluationResult;
  correctionDetail: string | null;
  /** null when the provider gives no usable confidence signal (e.g. it could not evaluate at all). */
  confidence: number | null;
}

export interface ConversationTurnInput {
  speaker: 'learner' | 'ai';
  content: string;
}

export interface ConverseTurnParams {
  history: ConversationTurnInput[];
  learnerMessage: string;
  knownVocabulary: string[];
  context: AIRequestContext;
}

export interface ConverseTurnResult {
  reply: string;
  flaggedNewVocabulary: string[];
  correctionDetail: string | null;
}

/**
 * Principle III (constitution.md): every method must ground its output in the actual
 * input, and evaluateSpeech/converseTurn callers must be able to represent "could not
 * evaluate" — never a confident-looking guess — when the provider lacks the capability
 * or confidence to answer for real.
 */
export interface AIProvider {
  generateText(params: GenerateTextParams): Promise<string>;
  evaluateSpeech(params: EvaluateSpeechParams): Promise<EvaluateSpeechResult>;
  converseTurn(params: ConverseTurnParams): Promise<ConverseTurnResult>;
}

export class AIProviderError extends Error {}
