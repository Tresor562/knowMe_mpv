'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from './i18n-provider';

type ConnectivityState = 'online' | 'offline' | 'restored';

const REMINDER_INTERVAL_MS = 3 * 60 * 1000;
const RESTORED_NOTICE_MS = 6 * 1000;

/**
 * Global, discreet connectivity feedback. This reflects the browser's network
 * signal; it does NOT claim to verify the availability of the KnowMe API.
 * Offline media availability is a separate, explicitly authorised cache path.
 */
export function NetworkConnectivityNotice() {
  const { locale } = useI18n();
  const en = locale === 'en';
  const [state, setState] = useState<ConnectivityState>('online');
  const [visible, setVisible] = useState(false);
  const previouslyOffline = useRef<boolean | null>(null);

  useEffect(() => {
    const checkNetwork = () => {
      const offline = navigator.onLine === false;
      if (offline) {
        setState('offline');
        setVisible(true);
      } else if (previouslyOffline.current === true) {
        setState('restored');
        setVisible(true);
      } else {
        setState('online');
        setVisible(false);
      }
      previouslyOffline.current = offline;
    };
    checkNetwork();
    window.addEventListener('online', checkNetwork);
    window.addEventListener('offline', checkNetwork);
    const reminder = window.setInterval(() => {
      if (navigator.onLine === false && document.visibilityState === 'visible') {
        setState('offline');
        setVisible(true);
      }
    }, REMINDER_INTERVAL_MS);
    return () => {
      window.removeEventListener('online', checkNetwork);
      window.removeEventListener('offline', checkNetwork);
      window.clearInterval(reminder);
    };
  }, []);

  useEffect(() => {
    if (state !== 'restored') return;
    const id = window.setTimeout(() => {
      setState('online');
      setVisible(false);
    }, RESTORED_NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [state]);

  if (!visible) return null;

  const offline = state === 'offline';
  return (
    <aside className="km-network-notice" role="status" aria-live="polite"
      data-offline={offline ? 'true' : 'false'}>
      <span className="km-network-notice-icon" aria-hidden="true">
        {offline
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="m3 3 18 18M16.8 12.1A7 7 0 0 0 12 10.3M8.2 10.9A9.5 9.5 0 0 1 12 10.1M4 8.8A14 14 0 0 1 12 6c3.7 0 7 1.4 9 3.8M9.2 14.4a4.5 4.5 0 0 1 5.6 0M12 18.8h.01"/>
            </svg>
          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M4 12.7 9.3 18 20 6"/>
            </svg>}
      </span>
      <span className="km-network-notice-copy">
        <strong>{offline
          ? (en ? 'You appear to be offline' : 'Tu sembles hors connexion')
          : (en ? 'Network connection restored' : 'Connexion réseau rétablie')}</strong>
        <span>{offline
          ? (en ? 'Some features require Internet. Previously available offline content may remain accessible.' : 'Certaines fonctions nécessitent Internet. Les contenus déjà disponibles hors ligne peuvent rester accessibles.')
          : (en ? 'KnowMe can reconnect to its services.' : 'KnowMe peut se reconnecter à ses services.')}</span>
      </span>
      <button type="button" className="km-network-notice-dismiss"
        onClick={() => setVisible(false)}
        aria-label={en ? 'Dismiss connection notice' : 'Masquer le message de connexion'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 6 18 18M18 6 6 18"/>
        </svg>
      </button>
    </aside>
  );
}
