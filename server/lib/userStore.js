/**
 * User records and login throttling.
 *
 * Same storage split as imageJobs.js: Netlify Blobs in production, an
 * in-process map locally so `npm run dev:api` needs no extra infrastructure.
 * A record holds a scrypt salt and hash — never a plaintext password.
 */

import { randomUUID } from 'node:crypto';
import { normalizeEmail } from './auth.js';

const MEMORY_USERS = new Map();
const MEMORY_ATTEMPTS = new Map();

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

/** Netlify Blobs is only importable inside the Netlify runtime. */
async function getStoreOrNull(name) {
  try {
    const { getStore } = await import('@netlify/blobs');
    // Strong consistency matters here: a user created on one function instance
    // has to be visible to the next login, which may land anywhere.
    return getStore({ name, consistency: 'strong' });
  } catch {
    return null;
  }
}

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

  const store = await getStoreOrNull('users');
  if (store) return (await store.get(userKey(normalized), { type: 'json' })) || null;
  return MEMORY_USERS.get(userKey(normalized)) || null;
}

export async function putUser(user) {
  const record = { ...user, email: normalizeEmail(user.email) };
  const store = await getStoreOrNull('users');
  if (store) {
    await store.setJSON(userKey(record.email), record);
  } else {
    MEMORY_USERS.set(userKey(record.email), record);
  }
  return record;
}

export async function deleteUserByEmail(email) {
  const store = await getStoreOrNull('users');
  if (store) {
    await store.delete(userKey(email));
    return;
  }
  MEMORY_USERS.delete(userKey(email));
}

export async function listUsers() {
  const store = await getStoreOrNull('users');
  if (!store) return [...MEMORY_USERS.values()];

  const { blobs } = await store.list();
  const users = await Promise.all(blobs.map((blob) => store.get(blob.key, { type: 'json' })));
  return users.filter(Boolean);
}

export async function countUsers() {
  const store = await getStoreOrNull('users');
  if (!store) return MEMORY_USERS.size;

  const { blobs } = await store.list();
  return blobs.length;
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
  const key = userKey(email);
  const store = await getStoreOrNull('login-attempts');
  const record = store ? await store.get(key, { type: 'json' }) : MEMORY_ATTEMPTS.get(key);
  return record || { count: 0, lockedUntil: 0 };
}

export async function recordFailedAttempt(email) {
  const current = await getAttempts(email);
  const count = current.count + 1;
  const record = {
    count,
    lockedUntil: count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
  };

  const key = userKey(email);
  const store = await getStoreOrNull('login-attempts');
  if (store) {
    await store.setJSON(key, record);
  } else {
    MEMORY_ATTEMPTS.set(key, record);
  }
  return record;
}

export async function clearAttempts(email) {
  const key = userKey(email);
  const store = await getStoreOrNull('login-attempts');
  if (store) {
    await store.delete(key);
    return;
  }
  MEMORY_ATTEMPTS.delete(key);
}
