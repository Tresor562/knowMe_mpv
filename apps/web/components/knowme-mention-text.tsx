'use client';

import Link from 'next/link';
import { Fragment } from 'react';

/** Only username-shaped mentions are links; the profile authority decides whether they exist. */
export function KnowMeMentionText({ text }: { text: string }) {
  const expression = /(^|[^\w.@])@([A-Za-z0-9_]{3,24})(?![\w])/g;
  const pieces: Array<string | React.ReactNode> = [];
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(expression)) {
    const fullStart = match.index ?? 0;
    const mentionStart = fullStart + match[1].length;
    const handle = match[2];
    const end = mentionStart + handle.length + 1;
    if (mentionStart < cursor) continue;
    pieces.push(text.slice(cursor, mentionStart));
    pieces.push(<Link key={index++} href={`/profile/${encodeURIComponent(handle)}`}
      style={{ color: 'var(--mint)', fontWeight: 650 }}
      aria-label={`Voir le profil de @${handle}`}>@${handle}</Link>);
    cursor = end;
  }
  pieces.push(text.slice(cursor));
  return <>{pieces.map((part, i) => typeof part === 'string'
    ? <Fragment key={`text-${i}`}>{part}</Fragment>
    : part)}</>;
}
