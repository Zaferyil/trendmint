/**
 * User records and login throttling.
 *
 * Same storage split as imageJobs.js: Netlify Blobs in production, an
 * in-process map locally so `npm run dev:api` needs no extra infrastructure.
 * A record holds a scrypt salt and hash — never a plaintext password.
 */

import { randomUUID } from 'node:crypto';
import { normalizeEmail } from './auth.js';
import { readAllJSON, readJSON, removeKey, listKeys, writeJSON } from './blobStore.js';

const USERS = 'users';
const ATTEMPTS = 'login-attempts';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

/**
 * Email addresses contain characters that are awkward in a blob key, so the
 * key is the encoded address. The readable address lives inside the record.
 */
function userKey(email) {
  return `user_${Buffer.from(normalizeEmail(email)).toString('base64url')}`;
}

export async function getUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return readJSON(USERS, userKey(normalized));
}

export async function putUser(user) {
  const record = { ...user, email: normalizeEmail(user.email) };
  return writeJSON(USERS, userKey(record.email), record);
}

export async function deleteUserByEmail(email) {
  await removeKey(USERS, userKey(email));
}

export async function listUsers() {
  return readAllJSON(USERS);
}

export async function countUsers() {
  return (await listKeys(USERS)).length;
}

export function buildUser({ email, name, role = 'user', salt, hash, createdBy = null, mustChangePassword = false }) {
  return {
    id: randomUUID(),
    email: normalizeEmail(email),
    name: name || normalizeEmail(email).split('@')[0],
    role,
    passwordSalt: salt,
    passwordHash: hash,
    // Bumped whenever a password changes or an admin revokes access, which
    // invalidates every session already signed for this user.
    tokenVersion: 1,
    disabled: false,
    mustChangePassword,
    createdAt: new Date().toISOString(),
    createdBy,
    lastLoginAt: null,
  };
}

/**
 * Login throttling. Serverless gives no shared memory, so the counter lives
 * beside the users; without it an open login form is an offline-speed guessing
 * oracle against whatever password the admin chose.
 */
export async function getAttempts(email) {
  return (await readJSON(ATTEMPTS, userKey(email))) || { count: 0, lockedUntil: 0 };
}

export async function recordFailedAttempt(email) {
  const current = await getAttempts(email);
  const count = current.count + 1;
  return writeJSON(ATTEMPTS, userKey(email), {
    count,
    lockedUntil: count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
  });
}

export async function clearAttempts(email) {
  await removeKey(ATTEMPTS, userKey(email));
}
