import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import type { ConversationSpeaker } from '../db/schema.js';

export interface ConversationSession {
  id: string;
  practiceSessionId: string;
}

export interface ConversationTurn {
  id: string;
  conversationSessionId: string;
  speaker: ConversationSpeaker;
  turnIndex: number;
  content: string;
  flaggedNewVocabulary: string[];
  correctionDetail: string | null;
}

function toTurn(row: {
  id: string;
  conversation_session_id: string;
  speaker: ConversationSpeaker;
  turn_index: number;
  content: string;
  flagged_new_vocabulary: string[] | null;
  correction_detail: string | null;
}): ConversationTurn {
  return {
    id: row.id,
    conversationSessionId: row.conversation_session_id,
    speaker: row.speaker,
    turnIndex: row.turn_index,
    content: row.content,
    flaggedNewVocabulary: row.flagged_new_vocabulary ?? [],
    correctionDetail: row.correction_detail,
  };
}

export async function createSession(practiceSessionId: string): Promise<ConversationSession> {
  const id = randomUUID();
  await db.insertInto('conversation_sessions').values({ id, practice_session_id: practiceSessionId }).execute();
  return { id, practiceSessionId };
}

export async function findSessionById(id: string): Promise<ConversationSession | null> {
  const row = await db.selectFrom('conversation_sessions').selectAll().where('id', '=', id).executeTakeFirst();
  return row ? { id: row.id, practiceSessionId: row.practice_session_id } : null;
}

export async function listTurns(conversationSessionId: string): Promise<ConversationTurn[]> {
  const rows = await db
    .selectFrom('conversation_turns')
    .selectAll()
    .where('conversation_session_id', '=', conversationSessionId)
    .orderBy('turn_index', 'asc')
    .execute();
  return rows.map(toTurn);
}

export interface CreateTurnInput {
  conversationSessionId: string;
  speaker: ConversationSpeaker;
  turnIndex: number;
  content: string;
  flaggedNewVocabulary?: string[];
  correctionDetail?: string | null;
}

export async function createTurn(input: CreateTurnInput): Promise<ConversationTurn> {
  const id = randomUUID();
  await db
    .insertInto('conversation_turns')
    .values({
      id,
      conversation_session_id: input.conversationSessionId,
      speaker: input.speaker,
      turn_index: input.turnIndex,
      content: input.content,
      flagged_new_vocabulary: input.flaggedNewVocabulary?.length ? JSON.stringify(input.flaggedNewVocabulary) : null,
      correction_detail: input.correctionDetail ?? null,
    })
    .execute();
  const row = await db.selectFrom('conversation_turns').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  return toTurn(row);
}

export async function findTurnById(id: string): Promise<ConversationTurn | null> {
  const row = await db.selectFrom('conversation_turns').selectAll().where('id', '=', id).executeTakeFirst();
  return row ? toTurn(row) : null;
}

/**
 * Counts AI turns since `since`, split by whether they carried a correction — a proxy for
 * "the learner made an error this turn" and a LevelingService input signal.
 */
export async function countAiTurnsSince(
  learnerLanguageId: string,
  since: Date,
): Promise<{ clean: number; corrected: number }> {
  const rows = await db
    .selectFrom('conversation_turns')
    .innerJoin('conversation_sessions', 'conversation_sessions.id', 'conversation_turns.conversation_session_id')
    .innerJoin('practice_sessions', 'practice_sessions.id', 'conversation_sessions.practice_session_id')
    .select('conversation_turns.correction_detail')
    .where('practice_sessions.learner_language_id', '=', learnerLanguageId)
    .where('conversation_turns.speaker', '=', 'ai')
    .where('practice_sessions.started_at', '>=', since)
    .execute();

  let clean = 0;
  let corrected = 0;
  for (const row of rows) {
    if (row.correction_detail === null) clean += 1;
    else corrected += 1;
  }
  return { clean, corrected };
}
