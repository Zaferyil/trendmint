// All third-party calls go through our own backend proxy: the browser only
// ever talks to the same origin, so there is no CORS preflight and no API key
// in the bundle. Override with VITE_API_BASE if the proxy lives elsewhere.
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

let onUnauthorized = null;

/**
 * Lets the app drop back to the login screen the moment any call reports an
 * expired or revoked session, instead of leaving a signed-out user staring at
 * a screen whose buttons all fail.
 */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    // The session rides in an HttpOnly cookie, which fetch only attaches when
    // credentials are requested.
    credentials: 'same-origin',
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    // A 401 from the login call is a wrong password, not a lost session —
    // bouncing the user "back" to the screen they are already on would just
    // wipe the error message they need to read.
    if (response.status === 401 && !path.startsWith('/auth/') && onUnauthorized) {
      onUnauthorized();
    }

    const message = data?.error || `API error: ${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const apiClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
};
