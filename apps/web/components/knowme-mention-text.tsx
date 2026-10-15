'use client';

import Link from 'next/link';

/**
 * Turns username-shaped mentions into profile links without HTML injection.
 * An unknown or inaccessible username is reported by the profile page/API.
 */
export function KnowMeMentionText({ text }: { text: string }) {
  const parts: Array<{ value: string; username?: string }> = [];
  const pattern = /(^|[^\w.@])@([A-Za-z0-9_]{3,24})(?![\w])/g;
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const username = match[2];
    if (!username) continue;
    const start = (match.index ?? 0) + (match[1] ?? '').length;
    const end = start + username.length + 1;
    if (start < cursor) continue;
    if (start > cursor) parts.push({ value: text.slice(cursor, start) });
    parts.push({ value: `@${username}`, username });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ value: text.slice(cursor) });

  return (
    <>
      {parts.map((part, index) => part.username
        ? <Link key={index} href={`/profile/${encodeURIComponent(part.username)}`}
            style={{ color: 'var(--mint)', fontWeight: 650 }}
            aria-label={`Voir le profil de ${part.value}`}>{part.value}</Link>
        : <span key={index}>{part.value}</span>)}
    </>
  );
}
