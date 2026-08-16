/**
 * The saved-design archive.
 *
 * Artwork is kept in its own store rather than inside the design record: a
 * generated image arrives as a base64 data URL of a megabyte or so, and
 * embedding that in the metadata would make listing the archive download every
 * picture in it.
 */

import { randomUUID } from 'node:crypto';
import { readAllEntries, readJSON, removeKey, writeJSON } from './blobStore.js';

const DESIGNS = 'designs';
const IMAGES = 'design-images';

export const ARCHIVE_LIMIT = 300;

function designKey(id) {
  return `design_${id}`;
}

export function buildDesignRecord({ design, trend, source = 'automation', runId = null, createdBy = null }) {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source,
    runId,
    createdBy,
    trendName: trend?.name || null,
    trendUrl: trend?.url || null,
    garment: trend?.garment || 't-shirt',
    trendMetrics: trend?.metrics || null,
    tags: trend?.tags || [],
    design,
    hasImage: false,
  };
}

export async function saveDesign(record) {
  return writeJSON(DESIGNS, designKey(record.id), record);
}

export async function getDesign(id) {
  if (!id) return null;
  return readJSON(DESIGNS, designKey(id));
}

export async function saveDesignImage(id, imageUrl) {
  await writeJSON(IMAGES, designKey(id), { imageUrl, savedAt: new Date().toISOString() });

  const record = await getDesign(id);
  if (record) await saveDesign({ ...record, hasImage: true });
}

export async function getDesignImage(id) {
  const record = await readJSON(IMAGES, designKey(id));
  return record?.imageUrl || null;
}

export async function deleteDesign(id) {
  await removeKey(DESIGNS, designKey(id));
  await removeKey(IMAGES, designKey(id));
}

export async function listDesigns() {
  const entries = await readAllEntries(DESIGNS);
  return entries
    .map((entry) => entry.value)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/**
 * Drops records past the retention window or the hard ceiling, whichever bites
 * first. Without this an archive that only ever grows eventually makes every
 * listing slow and every run more expensive to store.
 */
export async function pruneDesigns({ retentionDays = 30, limit = ARCHIVE_LIMIT } = {}) {
  const designs = await listDesigns();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const doomed = designs.filter(
    (record, index) => index >= limit || new Date(record.createdAt).getTime() < cutoff
  );

  for (const record of doomed) {
    await deleteDesign(record.id);
  }
  return doomed.length;
}
