'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from './i18n-provider';
import { KnowMeAnimatedIcon } from './knowme-animated-icon';
import { KnowMeIconButton } from './knowme-icon-button';

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
        <KnowMeAnimatedIcon
          name={offline ? 'wifi-off' : 'wifi'}
          state={offline ? 'offline' : 'success'}
          eventToken={state}
          size={24}
        />
      </span>
      <span className="km-network-notice-copy">
        <strong>{offline
          ? (en ? 'You appear to be offline' : 'Tu sembles hors connexion')
          : (en ? 'Network connection restored' : 'Connexion réseau rétablie')}</strong>
        <span>{offline
          ? (en ? 'Some features require Internet. Previously available offline content may remain accessible.' : 'Certaines fonctions nécessitent Internet. Les contenus déjà disponibles hors ligne peuvent rester accessibles.')
          : (en ? 'KnowMe can reconnect to its services.' : 'KnowMe peut se reconnecter à ses services.')}</span>
      </span>
      <KnowMeIconButton name="close" size={20}
        className="km-network-notice-dismiss"
        onClick={() => setVisible(false)}
        label={en ? 'Dismiss connection notice' : 'Masquer le message de connexion'}/>
    </aside>
  );
}
