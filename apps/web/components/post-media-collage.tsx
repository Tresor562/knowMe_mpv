'use client';

import { useEffect, useRef, useState } from 'react';
import { PostVideoPlayer } from './post-video-player';
import { VideoStill } from './video-still';
import './post-media-collage.css';

export type PostMediaItem = {
  url: string;
  mimeType: string;
  position: number;
};

function safeMediaUrl(url: string): string {
  if (url.startsWith('/media/public/post/')) return `/api/knowme${url}`;
  // The public Post API may also return a legacy profile-hosted image.
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (/^https:\/\//i.test(url)) return url;
  return '';
}

export function PostMediaCollage({ media, fallbackUrl, caption = '', en = false }: {
  media?: PostMediaItem[] | null;
  fallbackUrl?: string | null;
  caption?: string;
  en?: boolean;
}) {
  const items = media?.length
    ? [...media].sort((a, b) => a.position - b.position)
      .map(item => ({ ...item, url: safeMediaUrl(item.url) })).filter(item => item.url)
    : fallbackUrl
      ? [{ url: safeMediaUrl(fallbackUrl), mimeType: 'image/jpeg', position: 0 }].filter(item => item.url)
      : [];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const total = items.length;

  useEffect(() => {
    if (activeIndex === null) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {setActiveIndex(null);return;}
      // Left and right keys seek in the video, and navigate between photos.
      if (document.activeElement?.closest('.km-post-video-player')) return;
      if (event.key === 'ArrowRight') setActiveIndex(index => index === null ? null : (index + 1) % total);
      if (event.key === 'ArrowLeft') setActiveIndex(index => index === null ? null : (index - 1 + total) % total);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [activeIndex === null, total]);

  if (total === 0) return null;
  const visible = items.slice(0, Math.min(total, 5));
  const current = activeIndex === null ? null : items[activeIndex];

  return (
    <>
      <div className="km-post-collage" data-count={Math.min(5,total)}
        aria-label={en ? `Post with ${total} media files` : `Publication contenant ${total} médias`}>
        {visible.map((item, index) => {
          const video = item.mimeType.startsWith('video/');
          return <button type="button" key={item.position + ':' + item.url}
            className="km-post-collage-tile"
            aria-label={en ? `Open media ${index + 1} of ${total}` : `Ouvrir le média ${index + 1} sur ${total}`}
            onClick={() => setActiveIndex(index)}>
            {video ? (
              <span className="km-post-collage-video">
                <VideoStill src={item.url} />
                <span className="km-post-collage-video-play" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="29" height="29"
                    fill="currentColor"><path d="M8 5.5a1 1 0 0 1 1.5-.85l10 6.5a1.6 1.6 0 0 1 0 2.7l-10 6.5A1 1 0 0 1 8 19z"/></svg>
                </span>
              </span>
            ) : <img src={item.url} loading="lazy"
                alt={en ? `Post photo ${index + 1}` : `Photo ${index + 1} de la publication`}/>}
            {index === 4 && total > 5 && (
              <span className="km-post-collage-more" aria-hidden="true">+{total - 5}</span>
            )}
          </button>;
        })}
      </div>
      {current && activeIndex !== null && (
        <div className="km-post-media-viewer" role="presentation"
          onMouseDown={event => {if (event.target === event.currentTarget) setActiveIndex(null);}}>
          <section role="dialog" aria-modal="true"
            aria-label={en ? 'Publication media gallery' : 'Galerie de la publication'}
            className="km-post-media-viewer-dialog">
            <div className="km-post-media-viewer-header">
              <span className="km-post-media-viewer-counter">{activeIndex + 1} / {total}</span>
              <button ref={closeRef} type="button" onClick={() => setActiveIndex(null)}
                aria-label={en ? 'Close gallery' : 'Fermer la galerie'}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M5 5 19 19M19 5 5 19"/>
                </svg>
              </button>
            </div>
            <div className="km-post-media-viewer-stage">
              {total > 1 && <button type="button" className="km-post-media-viewer-prev"
                aria-label={en ? 'Previous media' : 'Média précédent'}
                onClick={() => setActiveIndex((activeIndex - 1 + total) % total)}>‹</button>}
              {current.mimeType.startsWith('video/')
                ? <PostVideoPlayer key={current.url} src={current.url} en={en}/>
                : <img key={current.url} src={current.url}
                    alt={en ? `Photo ${activeIndex + 1}` : `Photo ${activeIndex + 1}`}/>}
              {total > 1 && <button type="button" className="km-post-media-viewer-next"
                aria-label={en ? 'Next media' : 'Média suivant'}
                onClick={() => setActiveIndex((activeIndex + 1) % total)}>›</button>}
            </div>
            {caption.trim() && <p className="km-post-media-viewer-caption">{caption}</p>}
          </section>
        </div>
      )}
    </>
  );
}
