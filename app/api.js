/* make.fun public API client — read-only GETs with ETag/304 caching.
   The API answers any origin (CORS) and binds ETags to the minute:
   an If-None-Match inside the same minute answers 304. */
const BASE = 'https://make.fun/api';
const cache = new Map(); // url -> { etag, body, at }
const inflight = new Map();

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function apiBase() { return BASE; }
export function cacheSize() { return cache.size; }
export function clearCache() { cache.clear(); }

/** GET JSON from the public API. Returns { data, stale, fromCache }. */
export async function getJson(path, { fresh = false } = {}) {
  const url = BASE + path;
  if (inflight.has(url)) return inflight.get(url);
  const run = (async () => {
    const hit = cache.get(url);
    const headers = { Accept: 'application/json' };
    if (hit?.etag && !fresh) headers['If-None-Match'] = hit.etag;
    let res;
    try {
      res = await fetch(url, { headers, credentials: 'omit' });
    } catch (e) {
      if (hit) return { data: hit.body, stale: true, fromCache: true };
      throw new ApiError(0, 'Network error — could not reach make.fun.');
    }
    if (res.status === 304 && hit) {
      return { data: hit.body, stale: false, fromCache: true };
    }
    if (!res.ok) {
      if (hit && res.status >= 500) return { data: hit.body, stale: true, fromCache: true };
      throw new ApiError(res.status, httpMessage(res.status));
    }
    const data = await res.json();
    cache.set(url, { etag: res.headers.get('ETag') || null, body: data, at: Date.now() });
    return { data, stale: false, fromCache: false };
  })();
  inflight.set(url, run);
  try { return await run; } finally { inflight.delete(url); }
}

function httpMessage(status) {
  if (status === 404) return 'Not found.';
  if (status === 429) return 'Rate limited — please wait a moment and retry.';
  if (status >= 500) return 'make.fun is having trouble right now.';
  return `Request failed (${status}).`;
}

/* ── typed helpers over the public routes ─────────────────────────────── */
export const board = (query = '') => getJson(`/competitions${query}`);
export const bounty = (slug) => getJson(`/competitions/${encodeURIComponent(slug)}`);
export const bountyRequirements = (slug) => getJson(`/competitions/${encodeURIComponent(slug)}/requirements`);
export const leaderboard = (slug, query = '') => getJson(`/competitions/${encodeURIComponent(slug)}/leaderboard${query}`);
export const profile = (handle) => getJson(`/profiles/${encodeURIComponent(handle)}`);
export const rankings = (query = '') => getJson(`/rankings${query}`);
export const submissions = (slug, query = '') => getJson(`/competitions/${encodeURIComponent(slug)}/submissions${query}`);

/** Unwrap a paged list ({items,next_cursor} | array | {data:[...]}). */
export function pageItems(data) {
  if (Array.isArray(data)) return { items: data, nextCursor: null };
  if (!data || typeof data !== 'object') return { items: [], nextCursor: null };
  const items = data.items ?? data.data ?? data.competitions ?? data.entries ?? data.rows ?? [];
  const nextCursor = data.next_cursor ?? data.nextCursor ?? data.cursor ?? null;
  return { items: Array.isArray(items) ? items : [], nextCursor };
}

/** Pick the first defined value among candidate keys (defensive shapes). */
export function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}
