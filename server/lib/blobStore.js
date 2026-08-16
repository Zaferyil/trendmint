/**
 * The one place that knows how storage differs between the two runtimes.
 *
 * Netlify Blobs is only importable inside the Netlify runtime, so locally every
 * caller falls back to an in-process map. Callers get the same shape either
 * way and stay free of the branch.
 */

const MEMORY_STORES = new Map();

export async function getStoreOrNull(name) {
  try {
    const { getStore } = await import('@netlify/blobs');
    // Strong consistency throughout: a record written by one function instance
    // has to be visible to the next request, which may land anywhere.
    return getStore({ name, consistency: 'strong' });
  } catch {
    return null;
  }
}

/** The local stand-in, one map per store name so keys cannot collide. */
export function memoryStore(name) {
  if (!MEMORY_STORES.has(name)) MEMORY_STORES.set(name, new Map());
  return MEMORY_STORES.get(name);
}

export async function readJSON(name, key) {
  const store = await getStoreOrNull(name);
  if (store) return (await store.get(key, { type: 'json' })) || null;
  return memoryStore(name).get(key) || null;
}

export async function writeJSON(name, key, value) {
  const store = await getStoreOrNull(name);
  if (store) {
    await store.setJSON(key, value);
    return value;
  }
  memoryStore(name).set(key, value);
  return value;
}

export async function removeKey(name, key) {
  const store = await getStoreOrNull(name);
  if (store) {
    await store.delete(key);
    return;
  }
  memoryStore(name).delete(key);
}

export async function listKeys(name) {
  const store = await getStoreOrNull(name);
  if (store) {
    const { blobs } = await store.list();
    return blobs.map((blob) => blob.key);
  }
  return [...memoryStore(name).keys()];
}

export async function readAllJSON(name) {
  return (await readAllEntries(name)).map((entry) => entry.value);
}

/** Same read, but keeps each record's key so callers can delete by it. */
export async function readAllEntries(name) {
  const store = await getStoreOrNull(name);
  if (!store) {
    return [...memoryStore(name).entries()].map(([key, value]) => ({ key, value }));
  }

  const { blobs } = await store.list();
  const entries = await Promise.all(
    blobs.map(async (blob) => ({ key: blob.key, value: await store.get(blob.key, { type: 'json' }) }))
  );
  return entries.filter((entry) => entry.value);
}
