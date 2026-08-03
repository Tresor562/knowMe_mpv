'use client';

import {
  decideMediaDownload,
  mediaKindFromMime,
  normalizeMediaDownloadPreference,
  type MediaDownloadPreference,
  type NetworkClass
} from '@knowme/media-cache-contract';
import { apiFetch, getAccessToken } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const CACHE_NAME = 'knowme-private-media-v1';
const CACHE_PREFIX = '/__knowme_private_media__/';

type DownloadGrant = { path: string; expiresAt: string };
export type CachedMediaEntry = {
  assetId: string;
  mimeType: string;
  size: number;
  cachedAt: string;
  lastAccessedAt: string;
};

export async function cacheMediaAsset(input: {
  assetId: string;
  mimeType: string;
  size: number;
  preference: MediaDownloadPreference;
  network: NetworkClass;
  dataSaverEnabled?: boolean;
  isBackground?: boolean;
}) {
  ensureCacheSupport();
  const stats = await mediaCacheStats();
  const decision = decideMediaDownload({
    preference: normalizeMediaDownloadPreference(input.preference),
    kind: mediaKindFromMime(input.mimeType),
    network: input.network,
    dataSaverEnabled: input.dataSaverEnabled,
    isBackground: input.isBackground,
    cachedBytes: stats.bytes,
    incomingBytes: input.size
  });
  if (!decision.allowed) return { cached: false, decision };

  const grant = await apiFetch<DownloadGrant>(`/media/${input.assetId}/download-grant`, { method: 'POST' });
  const token = getAccessToken();
  const response = await fetch(`${API_URL}${grant.path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Téléchargement du média impossible.');

  const body = await response.arrayBuffer();
  const now = new Date().toISOString();
  const headers = new Headers({
    'content-type': input.mimeType || response.headers.get('content-type') || 'application/octet-stream',
    'content-length': String(body.byteLength),
    'x-knowme-asset-id': input.assetId,
    'x-knowme-cached-at': now,
    'x-knowme-last-accessed-at': now,
    'cache-control': 'private, no-store'
  });
  const cache = await caches.open(CACHE_NAME);
  await cache.put(cacheKey(input.assetId), new Response(body, { status: 200, headers }));
  await enforceMediaCacheLimit(input.preference.maxCacheMb);
  return { cached: true, decision, entry: await cachedMediaEntry(input.assetId) };
}

export async function readCachedMedia(assetId: string) {
  ensureCacheSupport();
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(cacheKey(assetId));
  if (!response) return null;
  const body = await response.arrayBuffer();
  const now = new Date().toISOString();
  const headers = new Headers(response.headers);
  headers.set('x-knowme-last-accessed-at', now);
  await cache.put(cacheKey(assetId), new Response(body.slice(0), { status: 200, headers }));
  const blob = new Blob([body], { type: response.headers.get('content-type') || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

export async function removeCachedMedia(assetId: string) {
  ensureCacheSupport();
  return (await caches.open(CACHE_NAME)).delete(cacheKey(assetId));
}

export async function clearMediaCache() {
  ensureCacheSupport();
  await caches.delete(CACHE_NAME);
  return { cleared: true };
}

export async function mediaCacheStats() {
  ensureCacheSupport();
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  const entries = (await Promise.all(keys.map(async (key) => {
    const response = await cache.match(key);
    return response ? entryFromResponse(response) : null;
  }))).filter((entry): entry is CachedMediaEntry => Boolean(entry));
  return { entries, count: entries.length, bytes: entries.reduce((total, entry) => total + entry.size, 0) };
}

export async function enforceMediaCacheLimit(maxCacheMb: number) {
  const limit = normalizeMediaDownloadPreference({ maxCacheMb }).maxCacheMb * 1024 * 1024;
  const stats = await mediaCacheStats();
  let bytes = stats.bytes;
  const oldest = [...stats.entries].sort((a, b) => a.lastAccessedAt.localeCompare(b.lastAccessedAt));
  for (const entry of oldest) {
    if (bytes <= limit) break;
    await removeCachedMedia(entry.assetId);
    bytes -= entry.size;
  }
  return { bytes, evicted: stats.bytes - bytes };
}

async function cachedMediaEntry(assetId: string) {
  const response = await (await caches.open(CACHE_NAME)).match(cacheKey(assetId));
  return response ? entryFromResponse(response) : null;
}

function entryFromResponse(response: Response): CachedMediaEntry {
  return {
    assetId: response.headers.get('x-knowme-asset-id') ?? '',
    mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
    size: Number(response.headers.get('content-length') ?? 0),
    cachedAt: response.headers.get('x-knowme-cached-at') ?? '',
    lastAccessedAt: response.headers.get('x-knowme-last-accessed-at') ?? response.headers.get('x-knowme-cached-at') ?? ''
  };
}

function cacheKey(assetId: string) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(assetId)) throw new Error('Identifiant média invalide.');
  return new Request(`${location.origin}${CACHE_PREFIX}${assetId}`, { method: 'GET', credentials: 'omit' });
}

function ensureCacheSupport() {
  if (typeof window === 'undefined' || !('caches' in window)) {
    throw new Error('Le cache média local n’est pas disponible sur cet appareil.');
  }
}
