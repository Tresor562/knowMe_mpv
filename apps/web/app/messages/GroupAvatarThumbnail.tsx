'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetchBlob } from '../../lib/api';

const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

type Picture = {
  src: string;
  conversationId: string;
  viewerId: string;
  refreshKey: number;
};

/** A group image is private: only a signed-in conversation member may request
 * it through the authenticated API. A blob URL stays in this mounted component
 * only, and is revoked on unmount/refresh/account change.
 *
 * The IntersectionObserver avoids one media request for every offscreen chat.
 * No 404/failure grants permissions or exposes user profile images as a group.
 */
export function GroupAvatarThumbnail({
  conversationId,
  viewerId,
  fallback,
  refreshKey
}: {
  conversationId: string;
  viewerId: string;
  fallback: string;
  refreshKey: number;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [picture, setPicture] = useState<Picture | null>(null);

  useEffect(() => {
    setVisible(false);
    const element = root.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '100px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [conversationId, viewerId]);

  useEffect(() => {
    if (!visible || !viewerId) return;
    let alive = true;
    let objectUrl: string | null = null;
    setPicture(null);

    void apiFetchBlob(`/conversations/${encodeURIComponent(conversationId)}/group/avatar`)
      .then(blob => {
        if (!alive || !MIME_TYPES.has(blob.type) || blob.size < 1024 || blob.size > MAX_BYTES) return;
        objectUrl = URL.createObjectURL(blob);
        setPicture({ src: objectUrl, conversationId, viewerId, refreshKey });
      })
      .catch(() => {
        // 404 = no photo/legacy API; 403 = not a member; offline = fallback.
        // No public URL, unauthorized image or persistent cache is introduced.
      });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [conversationId, viewerId, refreshKey, visible]);

  const current = picture?.conversationId === conversationId
    && picture?.viewerId === viewerId
    && picture?.refreshKey === refreshKey
    ? picture.src : null;

  return <span ref={root} className="km-group-chat-thumbnail"
    style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
    {current ? <img src={current} className="km-chat-avatar-image" alt="" /> : fallback}
  </span>;
}
