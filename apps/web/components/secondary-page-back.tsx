'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { KnowMeGlyph } from './knowme-glyph';
import { isSecondaryKnowMeRoute } from './secondary-page-back-model';
import './secondary-page-back.css';

const LOCAL_BACK = [
  'button[aria-label^="Retour"]:not([data-knowme-fallback-back])',
  'a[aria-label^="Retour"]',
  'button[aria-label^="Back"]:not([data-knowme-fallback-back])',
  'a[aria-label^="Back"]',
  '[data-knowme-page-back]'
].join(',');

/** Fallback only: existing page-specific headers and immersive viewers keep priority. */
export function SecondaryPageBack() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const currentRoute = useRef(pathname);
  const previousRoute = useRef<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [localBackExists, setLocalBackExists] = useState(false);

  useEffect(() => {
    if (currentRoute.current !== pathname) {
      previousRoute.current = currentRoute.current;
      currentRoute.current = pathname;
    }
    setSignedIn(Boolean(window.localStorage.getItem('knowme_token')));
  }, [pathname]);

  useEffect(() => {
    if (!isSecondaryKnowMeRoute(pathname)) return;
    const check = () => setLocalBackExists(Boolean(document.querySelector(LOCAL_BACK)));
    check();
    // Secondary screens can mount their own back control after loading asynchronously.
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  if (!signedIn || !isSecondaryKnowMeRoute(pathname) || localBackExists) return null;

  const goBack = () => {
    const previous = previousRoute.current;
    // history.length includes outside-origin pages: never send a direct-link visitor away from KnowMe.
    if (previous && previous !== pathname && previous.startsWith('/') && !previous.startsWith('//')) {
      router.back();
    } else {
      router.push('/feed');
    }
  };

  return <button type="button" className="km-secondary-back" data-knowme-fallback-back
    aria-label="Retour à la page précédente" title="Retour" onClick={goBack}>
    <KnowMeGlyph name="back" size={23}/><span>Retour</span>
  </button>;
}
