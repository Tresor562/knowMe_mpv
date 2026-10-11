'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from './i18n-provider';

type IconName = 'home' | 'discover' | 'create' | 'notifications' | 'chats' | 'profile';
type NavPosition = 'top' | 'bottom';

export const KNOWME_NAV_POSITION_KEY = 'knowme-navigation-position';
const ROOT_ROUTES = new Set(['/dashboard', '/feed', '/discover', '/notifications', '/messages', '/profile']);

function NavIcon({ name }: { name: IconName }) {
  const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true as const };
  if (name === 'home') return <svg {...base}><path d="m3.5 10 8.5-7 8.5 7v9a2 2 0 0 1-2 2h-4.5v-7h-4v7H6a2.5 2.5 0 0 1-2.5-2.5z"/></svg>;
  if (name === 'discover') return <svg {...base}><circle cx="9" cy="8.5" r="3"/><path d="M2.5 19c.6-3.5 2.7-5.2 6.5-5.2 2.2 0 4 .7 5.1 2.2"/><circle cx="18" cy="9" r="2.5"/><path d="M17 14c3.3 0 4.5 1.5 4.5 4.8"/></svg>;
  if (name === 'create') return <svg {...base}><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></svg>;
  if (name === 'notifications') return <svg {...base}><path d="M18 8a6 6 0 0 0-12 0c0 7-2 7.5-2 9h16c0-1.5-2-2-2-9ZM10 21h4"/></svg>;
  if (name === 'chats') return <svg {...base}><path d="M20 11.5c0 4.8-3.8 8.2-8.5 8.2-1.3 0-2.6-.3-3.7-.8L3 20l1.5-4.1a8.4 8.4 0 1 1 15.5-4.4Z"/><path d="M8 11h8M8 14.5h5"/></svg>;
  return <svg {...base}><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-3.6 3.4-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/></svg>;
}

function isTypingTarget(element: EventTarget | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  return Boolean(element.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

export function BottomNavigation() {
  const pathname = usePathname() ?? '/';
  const { locale } = useI18n();
  const en = locale === 'en';
  const [hasSession, setHasSession] = useState(false);
  const [visible, setVisible] = useState(true);
  const [keyboardEditing, setKeyboardEditing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [position, setPosition] = useState<NavPosition>('bottom');
  const lastScrollY = useRef(0);
  const directionDistance = useRef(0);

  useEffect(() => {
    const update = () => setHasSession(Boolean(window.localStorage.getItem('knowme_token')));
    update();
    window.addEventListener('storage', update);
    window.addEventListener('pageshow', update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener('pageshow', update); };
  }, [pathname]);

  useEffect(() => {
    const update = () => {
      const value = window.localStorage.getItem(KNOWME_NAV_POSITION_KEY);
      setPosition(value === 'top' ? 'top' : 'bottom');
    };
    update();
    window.addEventListener('storage', update);
    window.addEventListener('knowme-nav-position-changed', update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener('knowme-nav-position-changed', update); };
  }, []);

  useEffect(() => {
    setVisible(true);
    setCreateOpen(false);
    lastScrollY.current = window.scrollY;
    directionDistance.current = 0;
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => {
      if (createOpen || keyboardEditing) return;
      const now = Math.max(0, window.scrollY);
      const previous = lastScrollY.current;
      const delta = now - previous;
      if (now < 24) {
        directionDistance.current = 0;
        setVisible(true);
      } else if (delta > 0) {
        directionDistance.current = Math.max(0, directionDistance.current) + delta;
        if (directionDistance.current > 30) setVisible(false);
      } else if (delta < 0) {
        directionDistance.current = Math.min(0, directionDistance.current) + delta;
        if (directionDistance.current < -22) setVisible(true);
      }
      lastScrollY.current = now;
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isTypingTarget(event.target)) setKeyboardEditing(true);
    };
    const onFocusOut = () => {
      // The next focused element is available after the browser focus transition.
      requestAnimationFrame(() => setKeyboardEditing(isTypingTarget(document.activeElement)));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCreateOpen(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [createOpen, keyboardEditing]);

  // Secondary screens own their back controls, not the global navigation.
  if (!hasSession || !ROOT_ROUTES.has(pathname)) return null;

  const items: { href: string; label: string; icon: IconName; matches: string[] }[] = [
    { href: '/feed', label: en ? 'Home' : 'Accueil', icon: 'home', matches: ['/feed', '/dashboard'] },
    { href: '/discover', label: en ? 'Discover' : 'Suggestions', icon: 'discover', matches: ['/discover'] },
    { href: '/notifications', label: en ? 'Alerts' : 'Notifs', icon: 'notifications', matches: ['/notifications'] },
    { href: '/messages', label: en ? 'Messages' : 'Messages', icon: 'chats', matches: ['/messages'] },
    { href: '/profile', label: en ? 'Profile' : 'Profil', icon: 'profile', matches: ['/profile'] }
  ];
  const createLinks = [
    { href: '/feed#compose', label: en ? 'Post' : 'Publication' },
    { href: '/stories/new', label: en ? 'Story' : 'Story' },
    { href: '/channels/new', label: en ? 'Channel' : 'Chaîne' },
    { href: '/challenges', label: en ? 'Challenge' : 'Défi' },
    { href: '/messages', label: en ? 'Group or message' : 'Groupe ou message' }
  ];
  const hide = !visible || keyboardEditing;
  return (
    <>
      {createOpen && <button type="button" className="km-nav-scrim" aria-label={en ? 'Close create menu' : 'Fermer le menu Créer'} onClick={() => setCreateOpen(false)}/>}
      <nav className={'bottom-nav km-smart-nav' + (hide ? ' is-hidden' : '') + (createOpen ? ' has-create-menu' : '')}
        data-position={position} aria-label={en ? 'Main navigation' : 'Navigation principale'}>
        {items.slice(0, 2).map(item => (
          <Link key={item.href} href={item.href} aria-current={item.matches.includes(pathname) ? 'page' : undefined}
            className={'bottom-nav-item' + (item.matches.includes(pathname) ? ' is-active' : '')}>
            <span className="bottom-nav-icon"><NavIcon name={item.icon}/></span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        ))}
        <div className="km-nav-create-wrap">
          <button type="button" className={'bottom-nav-item km-nav-create' + (createOpen ? ' is-active' : '')}
            aria-expanded={createOpen} aria-haspopup="menu" onClick={() => { setVisible(true); setCreateOpen(value => !value); }}>
            <span className="bottom-nav-icon"><NavIcon name="create"/></span>
            <span className="bottom-nav-label">{en ? 'Create' : 'Créer'}</span>
          </button>
          {createOpen && <div className="km-nav-create-menu" role="menu" aria-label={en ? 'Create' : 'Créer'}>
            {createLinks.map(item => <Link role="menuitem" key={item.href} href={item.href} onClick={() => setCreateOpen(false)}>{item.label}</Link>)}
          </div>}
        </div>
        {items.slice(2).map(item => (
          <Link key={item.href} href={item.href} aria-current={item.matches.includes(pathname) ? 'page' : undefined}
            className={'bottom-nav-item' + (item.matches.includes(pathname) ? ' is-active' : '')}>
            <span className="bottom-nav-icon"><NavIcon name={item.icon}/></span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
