import Link from 'next/link';

const items = [
  { href: '/dashboard', label: 'Accueil', icon: '⌂' },
  { href: '/feed', label: 'Activité', icon: '◉' },
  { href: '/challenges', label: 'Défis', icon: '⚡' },
  { href: '/messages', label: 'Messages', icon: '✉' },
  { href: '/profile', label: 'Profil', icon: '●' }
];

export function BottomNavigation() {
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="bottom-nav-item">
          <span className="bottom-nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
