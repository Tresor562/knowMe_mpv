'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from './i18n-provider';

type IconName = 'chats' | 'feed' | 'challenges' | 'profile';

function NavIcon({ name }: { name: IconName }) {
  const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  if (name === 'chats') return <svg {...base}><path d="M20 11.5a7.8 7.8 0 0 1-8.2 7.7 9 9 0 0 1-3.3-.7L4 20l1.4-4A8 8 0 1 1 20 11.5Z" /><path d="M8.2 11.7h7.6M8.2 14.6h4.8" /></svg>;
  if (name === 'feed') return <svg {...base}><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M8 7.8h8M8 12h8M8 16.2h4.5" /></svg>;
  if (name === 'challenges') return <svg {...base}><path d="m13.6 2.8-9 10.5h6.4l-1 7.9 9-10.6h-6.4z" /></svg>;
  return <svg {...base}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.8-3.6 3.4-5.5 7.5-5.5s6.7 1.9 7.5 5.5" /></svg>;
}

const HIDDEN_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

export function BottomNavigation() {
  const pathname = usePathname() ?? '/';
  const { locale } = useI18n();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const update = () => setHasSession(Boolean(window.localStorage.getItem('knowme_token')));
    update();
    window.addEventListener('storage', update);
    window.addEventListener('pageshow', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('pageshow', update);
    };
  }, [pathname]);

  if (!hasSession || HIDDEN_PATHS.includes(pathname) || pathname.startsWith('/m/') || pathname.startsWith('/play/') || /^\/messages\/[^/]+/.test(pathname)) return null;

  const items: { href: string; label: string; icon: IconName; matches: string[] }[] = [
    { href: '/messages', label: locale === 'fr' ? 'Discussions' : 'Chats', icon: 'chats', matches: ['/messages', '/conversation-pins', '/saved-messages'] },
    { href: '/feed', label: locale === 'fr' ? 'Actualités' : 'Feed', icon: 'feed', matches: ['/feed', '/dashboard'] },
    { href: '/challenges', label: locale === 'fr' ? 'Défis' : 'Challenges', icon: 'challenges', matches: ['/challenges', '/play', '/quests'] },
    { href: '/profile', label: locale === 'fr' ? 'Profil' : 'Profile', icon: 'profile', matches: ['/profile', '/settings', '/security'] }
  ];

  return (
    <nav className="bottom-nav" aria-label={locale === 'fr' ? 'Navigation principale' : 'Main navigation'}>
      {items.map((item) => {
        const active = item.matches.some(route => pathname === route || pathname.startsWith(route + '/'));
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
            className={`bottom-nav-item${active ? ' is-active' : ''}`}>
            <span className="bottom-nav-icon"><NavIcon name={item.icon} /></span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
