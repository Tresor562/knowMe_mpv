'use client';

import { apiFetch } from './api';

export type PostMedia = {
  position: number;
  asset: {
    id: string;
    originalName: string;
    detectedMime: string;
    size: number;
    status?: string;
    deletedAt?: string | null;
  };
};

export const POST_MEDIA_MAX_COUNT = 10;
export const POST_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

export const POST_MEDIA_MIMES = new Set([
  'image/jpeg','image/png','image/webp','image/gif','video/mp4',
  'audio/mpeg','audio/ogg','audio/wav','application/pdf'
]);

export function checkPostFiles(files: File[], existingCount = 0): string | null {
  if (files.length + existingCount > POST_MEDIA_MAX_COUNT) {
    return 'Dix pièces jointes maximum par publication.';
  }
  for (const file of files) {
    if (!POST_MEDIA_MIMES.has(file.type)) {
      return 'Format non pris en charge : ' + file.name;
    }
    if (file.size < 1024 || file.size > POST_MEDIA_MAX_BYTES) {
      return 'Chaque fichier doit peser entre 1 Ko et 25 Mo : ' + file.name;
    }
  }
  return null;
}

export async function uploadPostFiles(
  files: File[], onProgress: (index: number, count: number) => void
) {
  const error = checkPostFiles(files);
  if (error) throw new Error(error);
  const results: string[] = [];
  for (let i=0;i<files.length;i++) {
    const file = files[i];
    if (!file) continue;
    onProgress(i+1,files.length);
    const session = await apiFetch<{id:string;uploadToken:string}>('/media/uploads',{
      method:'POST',
      body:JSON.stringify({
        purpose:'POST',visibility:'PRIVATE',maxBytes:file.size,allowedMime:[file.type]
      })
    });
    const payload = new FormData();
    payload.append('file',file,file.name);
    const asset = await apiFetch<{id:string;status:string;scannerVerdict?:string}>(
      '/media/uploads/' + encodeURIComponent(session.id) + '/complete',{
        method:'POST',headers:{'x-upload-token':session.uploadToken},body:payload
      }
    );
    if (asset.status !== 'AVAILABLE') {
      throw new Error(asset.scannerVerdict === 'UNAVAILABLE'
        ? 'Contrôle de sécurité indisponible. Envoi annulé.'
        : 'Fichier non validé par le contrôle de sécurité : ' + file.name);
    }
    results.push(asset.id);
  }
  return results;
}

export function publicPostAssetUrl(postId: string, assetId: string) {
  return '/api/knowme/posts/' + encodeURIComponent(postId) +
    '/media/' + encodeURIComponent(assetId);
}
