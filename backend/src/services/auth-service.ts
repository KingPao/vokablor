import { createLearner, findLearnerByEmail, type Learner } from '../models/learner.js';
import { hashPassword, verifyPassword } from './password.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthError extends Error {}

export async function register(email: string, password: string): Promise<Learner> {
  if (!EMAIL_PATTERN.test(email)) {
    throw new AuthError('Invalid email address');
  }
  if (password.length < 8) {
    throw new AuthError('Password must be at least 8 characters');
  }
  const existing = await findLearnerByEmail(email);
  if (existing) {
    throw new AuthError('An account with this email already exists');
  }
  const passwordHash = await hashPassword(password);
  return createLearner(email, passwordHash);
}

export async function authenticate(email: string, password: string): Promise<Learner> {
  const learner = await findLearnerByEmail(email);
  if (!learner) {
    throw new AuthError('Invalid email or password');
  }
  const valid = await verifyPassword(learner.passwordHash, password);
  if (!valid) {
    throw new AuthError('Invalid email or password');
  }
  return learner;
}
