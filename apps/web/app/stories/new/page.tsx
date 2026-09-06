'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type StoryResponse = { id: string };

const AUDIENCES = [
  ['FRIENDS', 'Friends'],
  ['PUBLIC', 'Everyone'],
  ['FOLLOWERS', 'Followers'],
  ['BEST_FRIENDS', 'Best friends'],
  ['PRIVATE', 'Only me']
] as const;

const DURATIONS = [
  [24, '24 hours', false],
  [48, '48 hours · Premium', true],
  [72, '72 hours · Premium', true],
  [168, '7 days · Premium', true],
  [336, '14 days · Premium', true],
  [720, '30 days · Premium', true]
] as const;

export default function NewStoryPage() {
  const router = useRouter();
  const { user, loading } = useSession({ required: true });
  const [type, setType] = useState<'TEXT' | 'LINK'>('TEXT');
  const [audience, setAudience] = useState('FRIENDS');
  const [durationHours, setDurationHours] = useState(24);
  const [permanent, setPermanent] = useState(false);
  const [allowReplies, setAllowReplies] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [allowSharing, setAllowSharing] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState('');

  const selectedDuration = useMemo(
    () => DURATIONS.find(([hours]) => hours === durationHours),
    [durationHours]
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const caption = String(data.get('caption') ?? '').trim();
    const linkUrl = String(data.get('linkUrl') ?? '').trim();
    const hashtags = String(data.get('hashtags') ?? '')
      .split(/[\s,]+/)
      .map((item) => item.replace(/^#/, '').trim())
      .filter(Boolean)
      .slice(0, 30);

    setPublishing(true);
    setMessage('');
    try {
      const story = await apiFetch<StoryResponse>('/stories', {
        method: 'POST',
        body: JSON.stringify({
          type,
          audience,
          caption: caption || undefined,
          linkUrl: type === 'LINK' ? linkUrl : undefined,
          hashtags,
          durationHours: permanent ? undefined : durationHours,
          permanent,
          allowReplies,
          allowReactions,
          allowSharing,
          background: type === 'TEXT' ? { preset: 'knowme-gradient', alignment: 'center' } : undefined
        })
      });
      router.replace(`/stories/${story.id}`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Story could not be published.');
    } finally {
      setPublishing(false);
    }
  }

  if (loading || !user) return <main className="shell"><p>Loading Story composer…</p></main>;

  return (
    <main className="shell" style={{ maxWidth: 680, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Link href="/feed" className="btn" aria-label="Close Story composer">×</Link>
        <div style={{ flex: 1 }}>
          <small style={{ color: 'var(--mint)' }}>@{user.username}</small>
          <h1 style={{ margin: 0 }}>Create Story</h1>
        </div>
      </header>

      <form onSubmit={submit} className="grid" style={{ gap: 16 }}>
        <section className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" className={type === 'TEXT' ? 'btn btn-primary' : 'btn'} onClick={() => setType('TEXT')}>Text</button>
            <button type="button" className={type === 'LINK' ? 'btn btn-primary' : 'btn'} onClick={() => setType('LINK')}>Link</button>
          </div>

          <div style={{
            minHeight: 380,
            borderRadius: 28,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: 'linear-gradient(145deg, rgba(121,87,255,.95), rgba(23,211,176,.5), rgba(18,20,29,.98))'
          }}>
            <textarea
              name="caption"
              className="input"
              rows={7}
              maxLength={4000}
              placeholder="Share a moment…"
              style={{ fontSize: 22, lineHeight: 1.35, resize: 'vertical', background: 'rgba(0,0,0,.24)' }}
              required={type === 'TEXT'}
            />
            {type === 'LINK' && (
              <input name="linkUrl" className="input" type="url" placeholder="https://…" required style={{ marginTop: 12 }} />
            )}
          </div>

          <input name="hashtags" className="input" placeholder="#travel #gaming #knowme" style={{ marginTop: 14 }} />
          <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
            Photo/video Stories use the secure KnowMe media pipeline. The visual uploader will use the new STORY upload purpose rather than exposing raw public files.
          </p>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Audience</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AUDIENCES.map(([value, label]) => (
              <button key={value} type="button" className={audience === value ? 'btn btn-primary' : 'btn'} onClick={() => setAudience(value)}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Duration</h2>
          <select className="input" value={permanent ? 'PERMANENT' : String(durationHours)} onChange={(event) => {
            if (event.target.value === 'PERMANENT') {
              setPermanent(true);
            } else {
              setPermanent(false);
              setDurationHours(Number(event.target.value));
            }
          }}>
            {DURATIONS.map(([hours, label]) => <option key={hours} value={hours}>{label}</option>)}
            <option value="PERMANENT">Permanent · Premium</option>
          </select>
          {(permanent || selectedDuration?.[2]) && <small style={{ color: 'var(--mint)' }}>Requires KnowMe Premium.</small>}
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Interactions</h2>
          <label style={{ display: 'flex', gap: 10, marginBottom: 10 }}><input type="checkbox" checked={allowReplies} onChange={(e) => setAllowReplies(e.target.checked)} /> Allow replies</label>
          <label style={{ display: 'flex', gap: 10, marginBottom: 10 }}><input type="checkbox" checked={allowReactions} onChange={(e) => setAllowReactions(e.target.checked)} /> Allow reactions</label>
          <label style={{ display: 'flex', gap: 10 }}><input type="checkbox" checked={allowSharing} onChange={(e) => setAllowSharing(e.target.checked)} /> Allow repost/share</label>
        </section>

        {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

        <button className="btn btn-primary" disabled={publishing} style={{ minHeight: 52 }}>
          {publishing ? 'Publishing…' : 'Share Story'}
        </button>
      </form>
    </main>
  );
}
