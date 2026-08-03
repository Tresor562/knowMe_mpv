import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import {
  decideMediaDownload,
  mediaKindFromMime,
  normalizeMediaDownloadPreference,
  type MediaDownloadPreference,
  type NetworkClass
} from '@knowme/media-cache-contract';
import { API_URL, apiFetch, getAccessToken } from './api';

const DIRECTORY = `${FileSystem.cacheDirectory ?? ''}knowme-private-media/`;
const INDEX_KEY = 'knowme_media_cache_index_v1';

type DownloadGrant = { path: string; expiresAt: string };
export type MobileCachedMediaEntry = {
  assetId: string;
  uri: string;
  mimeType: string;
  size: number;
  cachedAt: string;
  lastAccessedAt: string;
};

export async function currentNetworkClass(): Promise<{
  network: NetworkClass;
  dataSaverEnabled: boolean;
}> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return { network: 'OFFLINE', dataSaverEnabled: false };
  const expensive = Boolean(state.details && 'isConnectionExpensive' in state.details && state.details.isConnectionExpensive);
  if (state.type === 'wifi' || state.type === 'ethernet') {
    return { network: 'WIFI', dataSaverEnabled: expensive };
  }
  if (state.type === 'cellular') {
    const roaming = Boolean(state.details && 'isRoaming' in state.details && state.details.isRoaming);
    return { network: roaming ? 'ROAMING' : 'CELLULAR', dataSaverEnabled: expensive };
  }
  return { network: 'UNKNOWN', dataSaverEnabled: expensive };
}

export async function cacheMediaAsset(input: {
  assetId: string;
  mimeType: string;
  size: number;
  preference: MediaDownloadPreference;
  isBackground?: boolean;
}) {
  await ensureDirectory();
  const connection = await currentNetworkClass();
  const stats = await mobileMediaCacheStats();
  const preference = normalizeMediaDownloadPreference(input.preference);
  const decision = decideMediaDownload({
    preference,
    kind: mediaKindFromMime(input.mimeType),
    network: connection.network,
    dataSaverEnabled: connection.dataSaverEnabled,
    isBackground: input.isBackground,
    cachedBytes: stats.bytes,
    incomingBytes: input.size
  });
  if (!decision.allowed) return { cached: false, decision };

  validateAssetId(input.assetId);
  const grant = await apiFetch<DownloadGrant>(`/media/${input.assetId}/download-grant`, {
    method: 'POST'
  });
  const token = await getAccessToken();
  if (!token) throw new Error('Session requise.');
  const uri = `${DIRECTORY}${input.assetId}`;
  const result = await FileSystem.downloadAsync(`${API_URL}${grant.path}`, uri, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    throw new Error('Téléchargement du média impossible.');
  }
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) throw new Error('Copie locale introuvable après téléchargement.');
  const now = new Date().toISOString();
  const entry: MobileCachedMediaEntry = {
    assetId: input.assetId,
    uri,
    mimeType: input.mimeType,
    size: info.size ?? input.size,
    cachedAt: now,
    lastAccessedAt: now
  };
  const index = await loadIndex();
  index[input.assetId] = entry;
  await saveIndex(index);
  await enforceMobileMediaCacheLimit(preference.maxCacheMb);
  return { cached: true, decision, entry };
}

export async function readCachedMedia(assetId: string) {
  validateAssetId(assetId);
  const index = await loadIndex();
  const entry = index[assetId];
  if (!entry) return null;
  const info = await FileSystem.getInfoAsync(entry.uri, { size: true });
  if (!info.exists) {
    delete index[assetId];
    await saveIndex(index);
    return null;
  }
  const updated = { ...entry, size: info.size ?? entry.size, lastAccessedAt: new Date().toISOString() };
  index[assetId] = updated;
  await saveIndex(index);
  return updated;
}

export async function removeCachedMedia(assetId: string) {
  validateAssetId(assetId);
  const index = await loadIndex();
  const entry = index[assetId];
  if (entry) await FileSystem.deleteAsync(entry.uri, { idempotent: true });
  delete index[assetId];
  await saveIndex(index);
  return { removed: Boolean(entry) };
}

export async function clearMobileMediaCache() {
  await FileSystem.deleteAsync(DIRECTORY, { idempotent: true });
  await AsyncStorage.removeItem(INDEX_KEY);
  await ensureDirectory();
  return { cleared: true };
}

export async function mobileMediaCacheStats() {
  const index = await loadIndex();
  const entries: MobileCachedMediaEntry[] = [];
  for (const entry of Object.values(index)) {
    const info = await FileSystem.getInfoAsync(entry.uri, { size: true });
    if (info.exists) entries.push({ ...entry, size: info.size ?? entry.size });
  }
  await saveIndex(Object.fromEntries(entries.map((entry) => [entry.assetId, entry])));
  return { entries, count: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.size, 0) };
}

export async function enforceMobileMediaCacheLimit(maxCacheMb: number) {
  const limit = normalizeMediaDownloadPreference({ maxCacheMb }).maxCacheMb * 1024 * 1024;
  const stats = await mobileMediaCacheStats();
  let bytes = stats.bytes;
  let evicted = 0;
  for (const entry of [...stats.entries].sort((a, b) => a.lastAccessedAt.localeCompare(b.lastAccessedAt))) {
    if (bytes <= limit) break;
    await removeCachedMedia(entry.assetId);
    bytes -= entry.size;
    evicted += entry.size;
  }
  return { bytes, evicted };
}

async function ensureDirectory() {
  if (!FileSystem.cacheDirectory) throw new Error('Cache local indisponible.');
  const info = await FileSystem.getInfoAsync(DIRECTORY);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIRECTORY, { intermediates: true });
}

async function loadIndex(): Promise<Record<string, MobileCachedMediaEntry>> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveIndex(index: Record<string, MobileCachedMediaEntry>) {
  return AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function validateAssetId(assetId: string) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(assetId)) throw new Error('Identifiant média invalide.');
}
