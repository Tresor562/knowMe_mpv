import Link from 'next/link';
import { ReactNode } from 'react';

export default function StickersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav
        className="shell"
        aria-label="Espace stickers"
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          paddingBottom: 0,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap'
        }}
      >
        <Link className="btn" href="/stickers">Bibliothèque</Link>
        <Link className="btn" href="/stickers/conversations">Conversations</Link>
        <Link className="btn" href="/messages">Messagerie classique</Link>
      </nav>
      {children}
    </>
  );
}
