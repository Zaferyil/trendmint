/**
 * Password hashing and session cookies.
 *
 * Everything here is built on `node:crypto` — scrypt for passwords, HMAC for
 * session signatures. No dependency is added for auth: a hand-rolled hash
 * would be the risky part, and scrypt is the part we are not hand-rolling.
 */

import { scrypt as scryptCallback, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export const SESSION_COOKIE = 'tm_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Rejects the passwords that make a login system pointless. Deliberately short:
 * length is the property that actually resists guessing, and composition rules
 * mostly push people towards "Password1!".
 */
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > 200) {
    // scrypt cost is paid by the server, so an arbitrarily long password is a
    // way to make us do arbitrarily much work.
    return 'Password must be at most 200 characters';
  }
  return null;
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Fresh random salt per user, so identical passwords do not share a hash. */
export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}

export async function verifyPassword(password, saltB64, expectedHashB64) {
  if (!password || !saltB64 || !expectedHashB64) return false;

  let expected;
  try {
    expected = Buffer.from(expectedHashB64, 'base64');
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), KEY_LENGTH);
  // Length-equal by construction above, which is what timingSafeEqual requires.
  return timingSafeEqual(actual, expected);
}

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value) {
  return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * The session is the signed payload itself rather than a lookup key, so a
 * request costs no storage read to authenticate. It still carries `tv` (the
 * user's token version) so the record can revoke it — see resolveSession.
 */
export function signSession(payload, secret) {
  const body = base64url(JSON.stringify(payload));
  const signature = base64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${signature}`;
}

export function verifySession(token, secret) {
  if (!token || !secret) return null;

  const [body, signature] = String(token).split('.');
  if (!body || !signature) return null;

  const expected = base64url(createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(fromBase64url(body).toString('utf8'));
  } catch {
    return null;
  }

  if (!payload?.exp || payload.exp * 1000 < Date.now()) return null;
  return payload;
}

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;

  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (name) cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

/**
 * HttpOnly is the point of using a cookie at all: script cannot read it, so an
 * XSS bug cannot walk off with the session the way it could with localStorage.
 * Secure is dropped only on localhost, where there is no HTTPS to be had.
 */
export function serializeSessionCookie(value, { maxAge = SESSION_TTL_SECONDS, secure = true } = {}) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearedSessionCookie({ secure = true } = {}) {
  return serializeSessionCookie('', { maxAge: 0, secure });
}

/** Strips the fields a browser has no business seeing. */
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    disabled: Boolean(user.disabled),
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}
