import type { ColumnType, Generated } from 'kysely';

export type ProficiencyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type VocabularyOrigin = 'user_added' | 'app_discovered';
export type MasteryState = 'new' | 'learning' | 'reviewing' | 'mastered';
export type PracticeMode = 'training' | 'speaking' | 'conversation';
export type SpeakingEvaluationResult = 'correct' | 'corrected' | 'could_not_evaluate';
export type SourceType = 'news' | 'tv_show' | 'game';
export type AIProviderName = 'openai' | 'anthropic' | 'google' | 'nvidia_free' | 'other';
export type ConversationSpeaker = 'learner' | 'ai';

/** Set by a DB default on insert, immutable afterwards. */
type CreatedAt = ColumnType<Date, string | Date | undefined, never>;
/** Set by a DB default on insert, but explicitly updatable by application code afterwards. */
type UpdatableTimestamp = ColumnType<Date, string | Date | undefined, string | Date>;
/**
 * MySQL JSON column: mysql2 auto-parses to `Select` on read, but Kysely mishandles a raw
 * JS array/object on write (it tries to expand it as multiple SQL values) — callers MUST
 * pass `JSON.stringify(...)` for Insert/Update; only the read side is already-parsed.
 */
type JsonColumn<Select> = ColumnType<Select, string | null, string | null>;

export interface LearnerTable {
  id: string;
  email: string;
  password_hash: string;
  created_at: CreatedAt;
  default_language_id: string | null;
}

export interface SessionTable {
  id: string;
  learner_id: string;
  created_at: CreatedAt;
  expires_at: Date;
}

export interface LearnerLanguageTable {
  id: string;
  learner_id: string;
  language_code: string;
  current_level: Generated<ProficiencyLevel>;
  level_updated_at: UpdatableTimestamp;
  ai_provider_id: string | null;
}

export interface AIProviderConfigTable {
  id: string;
  learner_id: string;
  provider: AIProviderName;
  model: string;
  api_key_encrypted: Buffer | null;
  created_at: CreatedAt;
}

export interface VocabularyItemTable {
  id: string;
  learner_language_id: string;
  term: string;
  translation: string;
  origin: VocabularyOrigin;
  mastery_state: Generated<MasteryState>;
  next_review_at: Date | null;
  created_at: CreatedAt;
}

export interface SourceExcerptTable {
  id: string;
  language_code: string;
  source_type: SourceType;
  source_name: string;
  source_url: string;
  snippet_text: string;
  level: ProficiencyLevel;
  fetched_at: CreatedAt;
}

export interface VocabularyExcerptMatchTable {
  vocabulary_item_id: string;
  source_excerpt_id: string;
}

export interface PracticeSessionTable {
  id: string;
  learner_language_id: string;
  mode: PracticeMode;
  started_at: CreatedAt;
  ended_at: Date | null;
  outcome_summary: JsonColumn<Record<string, unknown> | null>;
}

export interface SpeakingAttemptTable {
  id: string;
  practice_session_id: string;
  vocabulary_item_id: string;
  audio_ref: string;
  transcript: string | null;
  evaluation_result: SpeakingEvaluationResult;
  correction_detail: string | null;
  confidence: number | null;
  created_at: CreatedAt;
}

export interface ConversationSessionTable {
  id: string;
  practice_session_id: string;
}

export interface ConversationTurnTable {
  id: string;
  conversation_session_id: string;
  speaker: ConversationSpeaker;
  turn_index: number;
  content: string;
  flagged_new_vocabulary: JsonColumn<string[] | null>;
  correction_detail: string | null;
}

export interface ProgressStateTable {
  learner_language_id: string;
  points: number;
  current_streak_days: number;
  last_activity_at: Date | null;
  updated_at: UpdatableTimestamp;
}

export interface OfflineSyncedActionTable {
  idempotency_key: string;
  learner_id: string;
  applied_at: CreatedAt;
}

/** Operational table for the shared free-tier rate limiter (research.md #6); not a spec entity. */
export interface AIFreeTierUsageTable {
  learner_id: string;
  window_start: ColumnType<string, string, never>;
  request_count: number;
}

export interface Database {
  learners: LearnerTable;
  sessions: SessionTable;
  learner_languages: LearnerLanguageTable;
  ai_provider_configs: AIProviderConfigTable;
  vocabulary_items: VocabularyItemTable;
  source_excerpts: SourceExcerptTable;
  vocabulary_excerpt_matches: VocabularyExcerptMatchTable;
  practice_sessions: PracticeSessionTable;
  speaking_attempts: SpeakingAttemptTable;
  conversation_sessions: ConversationSessionTable;
  conversation_turns: ConversationTurnTable;
  progress_states: ProgressStateTable;
  offline_synced_actions: OfflineSyncedActionTable;
  ai_free_tier_usage: AIFreeTierUsageTable;
}
