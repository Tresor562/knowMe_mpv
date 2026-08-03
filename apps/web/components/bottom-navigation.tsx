'use client';

import Link from 'next/link';
import { useI18n } from './i18n-provider';

export function BottomNavigation() {
  const { locale, t } = useI18n();
  const items = [
    { href: '/dashboard', label: t('nav.home'), icon: '⌂' },
    { href: '/feed', label: t('nav.feed'), icon: '◉' },
    { href: '/challenges', label: t('nav.challenges'), icon: '⚡' },
    { href: '/messages', label: locale === 'fr' ? 'Messages' : 'Messages', icon: '✉' },
    { href: '/secret', label: locale === 'fr' ? 'Secret' : 'Secret', icon: '◌' },
    { href: '/profile', label: t('nav.profile'), icon: '●' }
  ];

  return (
    <nav
      className="bottom-nav"
      aria-label={locale === 'fr' ? 'Navigation principale' : 'Main navigation'}
    >
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="bottom-nav-item">
          <span className="bottom-nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
