'use client';

import { useEffect, useState } from 'react';
import { apiFetch, apiFetchBlob } from '../lib/api';

type DownloadGrant = { path: string };

// A profile cover stores an asset ID, not an image URL. Resolve it through the
// authenticated media grant instead of putting a raw ID into CSS url().
export function ProfileCover({ assetId, className = '' }: {
  assetId?: string | null;
  className?: string;
}) {
  const [source, setSource] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    setSource('');
    if (!assetId) return;

    // Older profiles may hold an existing HTTPS image URL instead of a media ID.
    if (/^https:\/\//i.test(assetId)) {
      setSource(assetId);
      return;
    }

    async function loadImage() {
      try {
        // Public cover is allowed only while the owner actively selects this
        // scanned asset. The backend must enforce that policy.
        const publicResponse = await fetch(
          `/api/knowme/media/public/cover/${encodeURIComponent(assetId!)}`,
          { cache: 'no-store' }
        );
        if (!publicResponse.ok) throw new Error('Public cover unavailable');
        const publicBlob = await publicResponse.blob();
        if (cancelled || !publicBlob.type.startsWith('image/')) return;
        objectUrl = URL.createObjectURL(publicBlob);
        setSource(objectUrl);
      } catch {
        // Backwards-compatible owner view while API servers are being updated.
        try {
          const grant = await apiFetch<DownloadGrant>(
            `/media/${encodeURIComponent(assetId!)}/download-grant`,
            { method: 'POST' }
          );
          const blob = await apiFetchBlob(grant.path);
          if (cancelled || !blob.type.startsWith('image/')) return;
          objectUrl = URL.createObjectURL(blob);
          setSource(objectUrl);
        } catch {
          // No grant: keep the decorative fallback rather than disclosing media.
        }
      }
    }
    void loadImage();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  return (
    <div className={`km-profile-cover ${className}`.trim()} aria-label="Couverture du profil">
      {source && <img src={source} alt="" loading="lazy" />}
    </div>
  );
}
