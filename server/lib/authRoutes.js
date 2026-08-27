/**
 * Login, session lookup and admin user management.
 *
 * Split out of router.js so the trend/design endpoints stay readable; router.js
 * calls resolveSession() to guard them and handleAuthRoute() for these paths.
 */

import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  clearedSessionCookie,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  parseCookies,
  publicUser,
  serializeSessionCookie,
  signSession,
  validatePassword,
  verifyPassword,
  verifySession,
} from './auth.js';
import {
  buildUser,
  clearAttempts,
  countUsers,
  deleteUserByEmail,
  getAttempts,
  getUserByEmail,
  listUsers,
  putUser,
  recordFailedAttempt,
} from './userStore.js';

// Compared against a real hash so a missing account costs the same time as a
// wrong password — otherwise response latency tells an attacker which emails
// are registered.
const DUMMY_SALT = Buffer.alloc(16).toString('base64');
const DUMMY_HASH = Buffer.alloc(64).toString('base64');

const GENERIC_LOGIN_ERROR = 'Invalid email or password';

function sessionSecret(env) {
  return env.SESSION_SECRET || env.AUTH_SECRET;
}

/**
 * Creates the first admin from the environment when the store is empty. This
 * is the way out of the chicken-and-egg problem: adding a user needs an admin,
 * and the first admin has nobody to add them.
 */
export async function ensureBootstrapAdmin(env) {
  const email = normalizeEmail(env.ADMIN_EMAIL);
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if ((await countUsers()) > 0) return;
  if (!isValidEmail(email) || validatePassword(password)) return;

  const { salt, hash } = await hashPassword(password);
  await putUser(
    buildUser({
      email,
      name: env.ADMIN_NAME || 'Admin',
      role: 'admin',
      salt,
      hash,
      // The bootstrap password sits in the deploy environment, so it is treated
      // as a delivery mechanism rather than a password the admin keeps.
      mustChangePassword: true,
    })
  );
}

/**
 * Reads the session cookie and re-checks it against the stored user, so a
 * disabled account or a bumped token version stops working immediately rather
 * than when the cookie happens to expire.
 */
export async function resolveSession({ headers, env }) {
  const secret = sessionSecret(env);
  if (!secret) return null;

  const cookies = parseCookies(headers?.cookie || headers?.Cookie);
  const payload = verifySession(cookies[SESSION_COOKIE], secret);
  if (!payload?.sub) return null;

  const user = await getUserByEmail(payload.email);
  if (!user || user.disabled) return null;
  if (user.id !== payload.sub) return null;
  if ((user.tokenVersion || 1) !== payload.tv) return null;

  return user;
}

function issueSession(user, env, isSecure) {
  const token = signSession(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion || 1,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    },
    sessionSecret(env)
  );
  return { 'set-cookie': serializeSessionCookie(token, { secure: isSecure }) };
}

function forbidden() {
  return { status: 403, body: { error: 'Admin access required' } };
}

/**
 * @returns {Promise<{status:number, body:any, headers?:Record<string,string>}|null>}
 *   null when the route is not an auth route, so the caller can carry on.
 */
export async function handleAuthRoute({ route, body, env, isSecure, currentUser }) {
  const secret = sessionSecret(env);

  switch (route) {
    case 'POST /auth/login': {
      if (!secret) {
        return { status: 503, body: { error: 'SESSION_SECRET is not configured on the server' } };
      }

      await ensureBootstrapAdmin(env);

      const email = normalizeEmail(body?.email);
      const password = body?.password;
      if (!email || !password) {
        return { status: 400, body: { error: 'Email and password are required' } };
      }

      const attempts = await getAttempts(email);
      if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
        const minutes = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
        return {
          status: 429,
          body: { error: `Too many failed attempts. Try again in ${minutes} minute(s).` },
        };
      }

      const user = await getUserByEmail(email);
      const ok = user
        ? await verifyPassword(password, user.passwordSalt, user.passwordHash)
        : await verifyPassword(password, DUMMY_SALT, DUMMY_HASH);

      if (!user || !ok || user.disabled) {
        await recordFailedAttempt(email);
        // Disabled accounts answer the same as wrong passwords: whether an
        // address is registered is not something an unauthenticated caller
        // should be able to probe.
        return { status: 401, body: { error: GENERIC_LOGIN_ERROR } };
      }

      await clearAttempts(email);
      const updated = await putUser({ ...user, lastLoginAt: new Date().toISOString() });

      return {
        status: 200,
        body: { user: publicUser(updated) },
        headers: issueSession(updated, env, isSecure),
      };
    }

    case 'POST /auth/logout':
      return {
        status: 200,
        body: { ok: true },
        headers: { 'set-cookie': clearedSessionCookie({ secure: isSecure }) },
      };

    case 'GET /auth/me': {
      // Answers 200 either way: "nobody is logged in" is the expected state on
      // first load, not an error the UI should surface.
      await ensureBootstrapAdmin(env);
      return {
        status: 200,
        body: {
          user: publicUser(currentUser),
          authConfigured: Boolean(secret),
        },
      };
    }

    case 'POST /auth/change-password': {
      if (!currentUser) return { status: 401, body: { error: 'Not signed in' } };

      const { currentPassword, newPassword } = body || {};
      const invalid = validatePassword(newPassword);
      if (invalid) return { status: 400, body: { error: invalid } };

      const ok = await verifyPassword(currentPassword, currentUser.passwordSalt, currentUser.passwordHash);
      if (!ok) return { status: 401, body: { error: 'Current password is incorrect' } };

      const { salt, hash } = await hashPassword(newPassword);
      const updated = await putUser({
        ...currentUser,
        passwordSalt: salt,
        passwordHash: hash,
        mustChangePassword: false,
        // Retires every session signed under the old password, including any
        // the admin handed over when creating the account.
        tokenVersion: (currentUser.tokenVersion || 1) + 1,
      });

      return {
        status: 200,
        body: { user: publicUser(updated) },
        // Re-issued, or bumping the version would sign the caller out of the
        // tab they just changed their password in.
        headers: issueSession(updated, env, isSecure),
      };
    }

    case 'GET /users': {
      if (!currentUser) return { status: 401, body: { error: 'Not signed in' } };
      if (currentUser.role !== 'admin') return forbidden();

      const users = await listUsers();
      users.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      return { status: 200, body: { users: users.map(publicUser) } };
    }

    case 'POST /users': {
      if (!currentUser) return { status: 401, body: { error: 'Not signed in' } };
      if (currentUser.role !== 'admin') return forbidden();

      const email = normalizeEmail(body?.email);
      if (!isValidEmail(email)) return { status: 400, body: { error: 'A valid email is required' } };

      const invalid = validatePassword(body?.password);
      if (invalid) return { status: 400, body: { error: invalid } };

      if (await getUserByEmail(email)) {
        return { status: 409, body: { error: 'A user with that email already exists' } };
      }

      const { salt, hash } = await hashPassword(body.password);
      const created = await putUser(
        buildUser({
          email,
          name: body?.name,
          role: body?.role === 'admin' ? 'admin' : 'user',
          salt,
          hash,
          createdBy: currentUser.email,
          // The admin knows this password, so it is a handover credential and
          // not the one the account should keep running on.
          mustChangePassword: true,
        })
      );

      return { status: 201, body: { user: publicUser(created) } };
    }

    case 'POST /users/update': {
      if (!currentUser) return { status: 401, body: { error: 'Not signed in' } };
      if (currentUser.role !== 'admin') return forbidden();

      const target = await getUserByEmail(body?.email);
      if (!target) return { status: 404, body: { error: 'User not found' } };

      const next = { ...target };
      if (typeof body.name === 'string' && body.name.trim()) next.name = body.name.trim();
      if (body.role === 'admin' || body.role === 'user') next.role = body.role;
      if (typeof body.disabled === 'boolean') next.disabled = body.disabled;

      if (target.email === currentUser.email && (next.disabled || next.role !== 'admin')) {
        // Locking yourself out of the only admin account leaves the site with
        // no way back in short of editing the environment and redeploying.
        return { status: 400, body: { error: 'You cannot disable or demote your own admin account' } };
      }

      const admins = (await listUsers()).filter((u) => u.role === 'admin' && !u.disabled);
      const losesAdmin = target.role === 'admin' && (next.role !== 'admin' || next.disabled);
      if (losesAdmin && admins.length <= 1) {
        return { status: 400, body: { error: 'At least one active admin must remain' } };
      }

      // Any change to role or access retires the sessions issued under the old
      // permissions, so a demotion takes effect on the next request.
      if (next.role !== target.role || next.disabled !== target.disabled) {
        next.tokenVersion = (target.tokenVersion || 1) + 1;
      }

      return { status: 200, body: { user: publicUser(await putUser(next)) } };
    }

    case 'POST /users/reset-password': {
      if (!currentUser) return { status: 401, body: { error: 'Not signed in' } };
      if (currentUser.role !== 'admin') return forbidden();

      const target = await getUserByEmail(body?.email);
      if (!target) return { status: 404, body: { error: 'User not found' } };

      const invalid = validatePassword(body?.password);
      if (invalid) return { status: 400, body: { error: invalid } };

      const { salt, hash } = await hashPassword(body.password);
      const updated = await putUser({
        ...target,
        passwordSalt: salt,
        passwordHash: hash,
        mustChangePassword: true,
        tokenVersion: (target.tokenVersion || 1) + 1,
      });

      return { status: 200, body: { user: publicUser(updated) } };
    }

    case 'POST /users/delete': {
      if (!currentUser) return { status: 401, body: { error: 'Not signed in' } };
      if (currentUser.role !== 'admin') return forbidden();

      const target = await getUserByEmail(body?.email);
      if (!target) return { status: 404, body: { error: 'User not found' } };
      if (target.email === currentUser.email) {
        return { status: 400, body: { error: 'You cannot delete your own account' } };
      }

      const admins = (await listUsers()).filter((u) => u.role === 'admin' && !u.disabled);
      if (target.role === 'admin' && admins.length <= 1) {
        return { status: 400, body: { error: 'At least one active admin must remain' } };
      }

      await deleteUserByEmail(target.email);
      return { status: 200, body: { ok: true } };
    }

    default:
      return null;
  }
}
