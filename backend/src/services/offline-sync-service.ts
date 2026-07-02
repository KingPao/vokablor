import * as offlineSyncedActionModel from '../models/offline-synced-action.js';
import { submitAnswer } from './training-service.js';

export class OfflineSyncError extends Error {}

export interface SyncActionPayload {
  idempotencyKey: string;
  type: string;
  payload: unknown;
}

interface TrainingAnswerPayload {
  sessionId: string;
  vocabularyItemId: string;
  correct: boolean;
}

function isTrainingAnswerPayload(payload: unknown): payload is TrainingAnswerPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as Record<string, unknown>).sessionId === 'string' &&
    typeof (payload as Record<string, unknown>).vocabularyItemId === 'string' &&
    typeof (payload as Record<string, unknown>).correct === 'boolean'
  );
}

/**
 * research.md #10: replays a queued offline mutation exactly once. A replay of an
 * already-applied `idempotencyKey` is a no-op success, never a duplicate write.
 */
export async function replayAction(learnerId: string, action: SyncActionPayload): Promise<{ applied: boolean }> {
  if (await offlineSyncedActionModel.hasBeenApplied(action.idempotencyKey)) {
    return { applied: true };
  }

  switch (action.type) {
    case 'training-answer': {
      if (!isTrainingAnswerPayload(action.payload)) {
        throw new OfflineSyncError('Malformed training-answer payload');
      }
      await submitAnswer(action.payload.sessionId, action.payload.vocabularyItemId, action.payload.correct);
      break;
    }
    default:
      throw new OfflineSyncError(`Unknown offline action type: ${action.type}`);
  }

  await offlineSyncedActionModel.markApplied(action.idempotencyKey, learnerId);
  return { applied: true };
}
