import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import type { SelectedAndroidMedia } from './AndroidMediaLibraryPicker';

type Media = SelectedAndroidMedia;
type StoredDraft = {
  accountId: string;
  content: string;
  media: Media[];
  missingMedia: string[];
  savedAt: number;
};

const PREFIX = 'knowme-post-draft-v1:';

function safeAccount(accountId: string) {
  if (!accountId || accountId.length > 128) throw new Error('Identifiant de compte invalide.');
  return encodeURIComponent(accountId);
}

function mediaFolder(accountId: string) {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('Stockage local indisponible.');
  return root + 'knowme-offline-posts/' + safeAccount(accountId) + '/';
}

function digest(value: string) {
  // Stable, non-secret filename component. Never use a gallery-provided path
  // as a destination or as a directory traversal component.
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function extension(mime: string) {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'video/mp4') return '.mp4';
  return '.bin';
}

export async function restoreOfflinePostDraft(accountId: string): Promise<StoredDraft | null> {
  const value = await AsyncStorage.getItem(PREFIX + safeAccount(accountId));
  if (!value) return null;
  const parsed = JSON.parse(value) as StoredDraft;
  if (parsed.accountId !== accountId) return null;
  const media: Media[] = [];
  const missing = Array.isArray(parsed.missingMedia) ? parsed.missingMedia.slice() : [];
  for (const file of Array.isArray(parsed.media) ? parsed.media : []) {
    if (!file || typeof file.uri !== 'string' || typeof file.name !== 'string'
        || typeof file.mime !== 'string') continue;
    const allowedFolder = mediaFolder(accountId);
    const relative = file.uri.slice(allowedFolder.length);
    if (!file.uri.startsWith(allowedFolder) || !relative || relative.includes('/') || relative === '..') {
      missing.push(file.name);
      continue;
    }
    const info = await FileSystem.getInfoAsync(file.uri).catch(() => null);
    if (info?.exists && info.size && info.size > 0) media.push(file);
    else missing.push(file.name);
  }
  return {
    accountId,
    content: typeof parsed.content === 'string' ? parsed.content : '',
    media,
    missingMedia: missing,
    savedAt: Number(parsed.savedAt) || 0
  };
}

/** Copies gallery picks to private app storage so temporary content URIs survive restarts. */
export async function saveOfflinePostDraft(accountId: string, content: string, selected: Media[]) {
  const key = PREFIX + safeAccount(accountId);
  if (!content && !selected.length) {
    await clearOfflinePostDraft(accountId);
    return { missingMedia: [] as string[] };
  }
  const folder = mediaFolder(accountId);
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const media: Media[] = [];
  const missingMedia: string[] = [];
  for (let index = 0; index < selected.length; index += 1) {
    const file = selected[index]!;
    // Deterministic names avoid copying gigabytes repeatedly after each keystroke.
    const cached = file.uri.startsWith(folder) && !file.uri.slice(folder.length).includes('/');
    const target = cached ? file.uri : folder + index + '-' + digest(file.uri + ':' + file.name)
      + extension(file.mime);
    try {
      if (!file.uri.startsWith('file://') && !file.uri.startsWith('content://')) {
        throw new Error('Source média non prise en charge.');
      }
      const info = await FileSystem.getInfoAsync(target);
      if (!info.exists || !info.size) {
        await FileSystem.copyAsync({ from: file.uri, to: target });
      }
      const checked = await FileSystem.getInfoAsync(target);
      if (!checked.exists || !checked.size) throw new Error('Copie média incomplète.');
      media.push({ uri: target, name: file.name, mime: file.mime });
    } catch {
      missingMedia.push(file.name);
    }
  }
  const saved: StoredDraft = {
    accountId, content, media, missingMedia, savedAt: Date.now()
  };
  await AsyncStorage.setItem(key, JSON.stringify(saved));
  // Best-effort cleanup of stale copies, but never delete the active draft files.
  try {
    const kept = new Set(media.map(file => file.uri.slice(folder.length)));
    for (const entry of await FileSystem.readDirectoryAsync(folder)) {
      if (!kept.has(entry)) {
        await FileSystem.deleteAsync(folder + entry, { idempotent: true });
      }
    }
  } catch {
    // Failed cache cleanup must not invalidate a successfully saved draft.
  }
  return { missingMedia };
}

export async function clearOfflinePostDraft(accountId: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + safeAccount(accountId));
  const root = FileSystem.documentDirectory;
  if (root) await FileSystem.deleteAsync(mediaFolder(accountId), { idempotent: true }).catch(() => undefined);
}
