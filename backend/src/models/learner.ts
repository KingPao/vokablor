import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';

export interface Learner {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  defaultLanguageId: string | null;
}

function toLearner(row: {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  default_language_id: string | null;
}): Learner {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    defaultLanguageId: row.default_language_id,
  };
}

export async function findLearnerByEmail(email: string): Promise<Learner | null> {
  const row = await db.selectFrom('learners').selectAll().where('email', '=', email).executeTakeFirst();
  return row ? toLearner(row) : null;
}

export async function findLearnerById(id: string): Promise<Learner | null> {
  const row = await db.selectFrom('learners').selectAll().where('id', '=', id).executeTakeFirst();
  return row ? toLearner(row) : null;
}

export async function createLearner(email: string, passwordHash: string): Promise<Learner> {
  const id = randomUUID();
  await db.insertInto('learners').values({ id, email, password_hash: passwordHash }).execute();
  const learner = await findLearnerById(id);
  if (!learner) throw new Error('Failed to create learner');
  return learner;
}

export async function setDefaultLanguage(learnerId: string, learnerLanguageId: string): Promise<void> {
  await db
    .updateTable('learners')
    .set({ default_language_id: learnerLanguageId })
    .where('id', '=', learnerId)
    .execute();
}
