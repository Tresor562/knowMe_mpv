'use client';

import { useState } from 'react';

/**
 * A profile photo must never display the browser's broken-image glyph.
 * Keep a legible initial when the media endpoint is temporarily unavailable.
 * A changed URL is retried automatically.
 */
export function KnowMeAvatarImage({ src, name, alt = '' }: {
  src?: string | null;
  name: string;
  alt?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || src === failedSource) {
    return <span aria-hidden="true">{name.trim().charAt(0).toLocaleUpperCase() || '?'}</span>;
  }
  return <img src={src} alt={alt} onError={() => setFailedSource(src)} />;
}
