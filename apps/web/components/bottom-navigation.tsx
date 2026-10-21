'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from './i18n-provider';
import { KnowMeAnimatedIcon } from './knowme-animated-icon';

type IconName = 'home' | 'discover' | 'create' | 'notifications' | 'chats' | 'profile';
type NavPosition = 'top' | 'bottom';

export const KNOWME_NAV_POSITION_KEY = 'knowme-navigation-position';
const ROOT_ROUTES = new Set(['/dashboard', '/feed', '/discover', '/notifications', '/messages', '/profile']);

function NavIcon({ name, active = false, menuOpen = false }: { name: IconName; active?: boolean; menuOpen?: boolean }) {
  return <KnowMeAnimatedIcon name={name} state={menuOpen ? 'open' : active ? 'selected' : 'idle'} size={22}/>;
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
  const [wideLayout,setWideLayout] = useState(false);
  const [topHeaderSlot, setTopHeaderSlot] = useState<HTMLElement | null>(null);
  const lastScrollY = useRef(0);
  const directionDistance = useRef(0);
  const scrollSource = useRef<EventTarget | null>(null);

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

  // On desktop, all six KnowMe destinations remain accessible in a compact rail.
  // The stored top/bottom dock preference is preserved for mobile, not overwritten.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const update = () => setWideLayout(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // The upper dock is hosted by the active page header, never fixed above it.
  useEffect(() => {
    if (position !== 'top') { setTopHeaderSlot(null); return; }
    const findSlot = () => setTopHeaderSlot(document.querySelector<HTMLElement>('[data-knowme-header-nav-slot]'));
    findSlot();
    const observer = new MutationObserver(findSlot);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, position]);

  useEffect(() => {
    setVisible(true);
    setCreateOpen(false);
    lastScrollY.current = window.scrollY;
    directionDistance.current = 0;
    scrollSource.current = null;
  }, [pathname]);

  useEffect(() => {
    const onScroll = (event: Event) => {
      if (createOpen || keyboardEditing) return;
      // Nested scroll containers are used by the feed and messaging screens.
      const source = event.target;
      const now = source instanceof HTMLElement
        ? Math.max(0, source.scrollTop)
        : Math.max(0, window.scrollY);
      if (scrollSource.current !== source) {
        scrollSource.current = source;
        lastScrollY.current = now;
        directionDistance.current = 0;
        return;
      }
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
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [createOpen, keyboardEditing]);

  // Secondary screens own their back controls, not the global navigation.
  if (!hasSession || !ROOT_ROUTES.has(pathname)) return null;

  const items: { href: string; label: string; compactLabel?: string; icon: IconName; matches: string[] }[] = [
    { href: '/feed', label: en ? 'Home' : 'Accueil', icon: 'home', matches: ['/feed', '/dashboard'] },
    { href: '/discover', label: en ? 'Discover' : 'Suggestions', compactLabel: en ? 'Discover' : 'Découvrir', icon: 'discover', matches: ['/discover'] },
    { href: '/notifications', label: en ? 'Alerts' : 'Notifications', compactLabel: en ? 'Alerts' : 'Alertes', icon: 'notifications', matches: ['/notifications'] },
    { href: '/messages', label: en ? 'Messages' : 'Messages', icon: 'chats', matches: ['/messages'] },
    { href: '/profile', label: en ? 'Profile' : 'Profil', icon: 'profile', matches: ['/profile'] }
  ];
  const createLinks = [
    { href: '/feed#compose', label: en ? 'Post' : 'Publication' },
    { href: '/stories/new', label: en ? 'Story' : 'Story' },
    { href: '/channels/new', label: en ? 'Channel' : 'Chaîne' },
    { href: '/challenges', label: en ? 'Challenge' : 'Défi' },
    { href: '/messages/new', label: en ? 'Group or message' : 'Groupe ou message' }
  ];
  const hide = !wideLayout && (!visible || keyboardEditing);
  const navigation = (
      <nav className={'bottom-nav km-smart-nav' + (hide ? ' is-hidden' : '') + (createOpen ? ' has-create-menu' : '')}
        data-position={position} data-layout={wideLayout ? 'desktop' : 'mobile'}
        aria-label={en ? 'Main navigation' : 'Navigation principale'}>
        {items.slice(0, 2).map(item => (
          <Link key={item.href} href={item.href} aria-current={item.matches.includes(pathname) ? 'page' : undefined}
            aria-label={item.label}
            className={'bottom-nav-item' + (item.matches.includes(pathname) ? ' is-active' : '')}>
            <span className="bottom-nav-icon"><NavIcon name={item.icon} active={item.matches.includes(pathname)}/></span>
            <span className={'bottom-nav-label' + (item.compactLabel ? ' km-nav-label-full' : '')}>{item.label}</span>
            {item.compactLabel && <span aria-hidden="true" className="bottom-nav-label km-nav-label-compact">{item.compactLabel}</span>}
          </Link>
        ))}
        <div className="km-nav-create-wrap">
          <button type="button" className={'bottom-nav-item km-nav-create' + (createOpen ? ' is-active' : '')}
            aria-expanded={createOpen} aria-haspopup="menu" onClick={() => { setVisible(true); setCreateOpen(value => !value); }}>
            <span className="bottom-nav-icon"><NavIcon name="create" menuOpen={createOpen}/></span>
            <span className="bottom-nav-label">{en ? 'Create' : 'Créer'}</span>
          </button>
          {createOpen && <div className="km-nav-create-menu" role="menu" aria-label={en ? 'Create' : 'Créer'}>
            {createLinks.map(item => <Link role="menuitem" key={item.href} href={item.href} onClick={() => {
              setCreateOpen(false);
              // Next.js may handle same-page hash links with pushState without a
              // browser hashchange event. Open the actual feed editor explicitly.
              if (item.href === '/feed#compose' && pathname === '/feed') {
                window.dispatchEvent(new Event('knowme:open-post-composer'));
              }
            }}>{item.label}</Link>)}
          </div>}
        </div>
        {items.slice(2).map(item => (
          <Link key={item.href} href={item.href} aria-current={item.matches.includes(pathname) ? 'page' : undefined}
            aria-label={item.label}
            className={'bottom-nav-item' + (item.matches.includes(pathname) ? ' is-active' : '')}>
            <span className="bottom-nav-icon"><NavIcon name={item.icon} active={item.matches.includes(pathname)}/></span>
            <span className={'bottom-nav-label' + (item.compactLabel ? ' km-nav-label-full' : '')}>{item.label}</span>
            {item.compactLabel && <span aria-hidden="true" className="bottom-nav-label km-nav-label-compact">{item.compactLabel}</span>}
          </Link>
        ))}
      </nav>
  );
  return (
    <>
      {createOpen && <button type="button" className="km-nav-scrim"
        aria-label={en ? 'Close create menu' : 'Fermer le menu Créer'}
        onClick={() => setCreateOpen(false)}/>}
      {position === 'top' && !wideLayout ? (topHeaderSlot ? createPortal(navigation, topHeaderSlot) : navigation) : navigation}
    </>
  );
}
