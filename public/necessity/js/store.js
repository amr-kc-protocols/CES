/* ============================================================================
 * store.js — IndexedDB persistence
 * ----------------------------------------------------------------------------
 * Everything lives on this device. There is no sync, no telemetry, and no
 * network code path anywhere in this application. `wipe()` is offered in the
 * UI because a local PHI store needs a deliberate way to be emptied.
 * ==========================================================================*/

const DB_NAME = 'ems-necessity-review';
const DB_VERSION = 1;
const CHARTS = 'charts';
const SETTINGS = 'settings';

let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CHARTS)) {
        const s = db.createObjectStore(CHARTS, { keyPath: 'key' });
        s.createIndex('incident', 'record.incident', { unique: false });
        s.createIndex('batch', 'batch', { unique: false });
      }
      if (!db.objectStoreNames.contains(SETTINGS)) {
        db.createObjectStore(SETTINGS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let out;
        try { out = fn(s); } catch (e) { reject(e); return; }
        t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

/** Stable key: incident number when present, otherwise a content hash. */
export function keyFor(rec) {
  if (rec.incident) return `inc:${rec.incident}`;
  const basis = `${rec.dateOfService}|${rec.patientName}|${rec.impression}|${(rec.narrative || '').slice(0, 200)}`;
  let h = 0;
  for (let i = 0; i < basis.length; i++) h = ((h << 5) - h + basis.charCodeAt(i)) | 0;
  return `hash:${(h >>> 0).toString(36)}`;
}

export async function putCharts(entries) {
  const existing = new Map((await allCharts()).map((c) => [c.key, c]));
  return tx(CHARTS, 'readwrite', (s) => {
    for (const e of entries) {
      const prev = existing.get(e.key);
      // Never overwrite a reviewer's work on re-import of the same chart.
      s.put(prev ? { ...e, review: prev.review, addedAt: prev.addedAt } : e);
    }
  });
}

export function allCharts() {
  return tx(CHARTS, 'readonly', (s) => s.getAll()).then((r) => r || []);
}

export async function updateReview(key, patch) {
  const all = await allCharts();
  const found = all.find((c) => c.key === key);
  if (!found) return null;
  const next = {
    ...found,
    review: { ...(found.review || {}), ...patch, updatedAt: new Date().toISOString() },
  };
  await tx(CHARTS, 'readwrite', (s) => s.put(next));
  return next;
}

export function removeChart(key) {
  return tx(CHARTS, 'readwrite', (s) => s.delete(key));
}

export function wipe() {
  return tx(CHARTS, 'readwrite', (s) => s.clear());
}

export async function getSettings() {
  const v = await tx(SETTINGS, 'readonly', (s) => s.get('main'));
  return (v && v.value) || {};
}

export function saveSettings(value) {
  return tx(SETTINGS, 'readwrite', (s) => s.put({ id: 'main', value }));
}
