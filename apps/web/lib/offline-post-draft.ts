/** Offline post drafts are private to a signed-in KnowMe account on this device.
 * IndexedDB stores text and selected File blobs without uploading them.
 * This is NOT a posting queue: publication always requires a user action.
 */
export type PersistedPostDraft = {
  accountId: string;
  content: string;
  files: File[];
  missingAttachmentNames: string[];
  updatedAt: number;
};

type StoredMedia = { name: string; mimeType: string; lastModified: number; blob: Blob };
type StoredDraft = {
  accountId: string;
  content: string;
  media: StoredMedia[];
  missingAttachmentNames?: string[];
  updatedAt: number;
};

const DATABASE_NAME = 'knowme-offline-post-drafts';
const STORE = 'drafts';

function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Le stockage hors ligne est indisponible dans ce navigateur.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'accountId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Impossible d’ouvrir les brouillons.'));
    request.onblocked = () => reject(new Error('Stockage temporairement bloqué.'));
  });
}

async function requestStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result: T;
      const req = operation(tx.objectStore(STORE));
      req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error ?? req.error ?? new Error('Écriture du brouillon annulée.'));
      tx.onerror = () => reject(tx.error ?? req.error ?? new Error('Erreur de stockage du brouillon.'));
    });
  } finally {
    db.close();
  }
}

function validateAccount(accountId: string) {
  if (!accountId || accountId.length > 128) throw new Error('Identifiant de compte invalide.');
}

export async function loadPostDraft(accountId: string): Promise<PersistedPostDraft | null> {
  validateAccount(accountId);
  const saved = await requestStore<StoredDraft | undefined>('readonly', store => store.get(accountId));
  if (!saved || saved.accountId !== accountId) return null;
  const files: File[] = [];
  for (const media of Array.isArray(saved.media) ? saved.media : []) {
    if (!media || typeof media.name !== 'string' || !(media.blob instanceof Blob)) continue;
    files.push(new File([media.blob], media.name, {
      type: media.mimeType || media.blob.type,
      lastModified: media.lastModified
    }));
  }
  return {
    accountId,
    content: typeof saved.content === 'string' ? saved.content : '',
    files,
    missingAttachmentNames: Array.isArray(saved.missingAttachmentNames)
      ? saved.missingAttachmentNames.filter(item => typeof item === 'string')
      : [],
    updatedAt: saved.updatedAt
  };
}

export async function clearPostDraft(accountId: string): Promise<void> {
  validateAccount(accountId);
  await requestStore('readwrite', store => store.delete(accountId));
}

/** If device storage is exhausted, keep text without claiming attachments survived. */
export async function savePostDraft(accountId: string, content: string, files: File[]): Promise<{ attachmentsSaved: boolean }> {
  validateAccount(accountId);
  if (!content && !files.length) {
    await clearPostDraft(accountId);
    return { attachmentsSaved: true };
  }
  const serialized: StoredMedia[] = files.map(file => ({
    name: file.name,
    mimeType: file.type,
    lastModified: file.lastModified,
    blob: file
  }));
  const base = { accountId, content, updatedAt: Date.now() };
  try {
    await requestStore('readwrite', store => store.put({ ...base, media: serialized, missingAttachmentNames: [] }));
    return { attachmentsSaved: true };
  } catch (error) {
    if (!files.length) throw error;
    // Retain the message text and list missing files; never mislead a user
    // into believing that an unsaved video is safe for offline use.
    await requestStore('readwrite', store => store.put({
      ...base, media: [], missingAttachmentNames: files.map(file => file.name)
    }));
    return { attachmentsSaved: false };
  }
}
