'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';
import { storyUi } from '../story-i18n';

type StoryResponse = { id: string };
type UploadSession = { id: string; uploadToken: string };
type UploadedAsset = { id: string };
type StoryKind = 'TEXT' | 'PHOTO' | 'VIDEO' | 'LINK';

const DURATIONS = [
  [24, '24 h', false],
  [48, '48 h · Premium', true],
  [72, '72 h · Premium', true],
  [168, '7 j / days · Premium', true],
  [336, '14 j / days · Premium', true],
  [720, '30 j / days · Premium', true]
] as const;

export default function NewStoryPage() {
  const ui = storyUi();
  const router = useRouter();
  const { user, loading } = useSession({ required: true });
  const [type, setType] = useState<StoryKind>('TEXT');
  const [audience, setAudience] = useState('FRIENDS');
  const [durationHours, setDurationHours] = useState(24);
  const [permanent, setPermanent] = useState(false);
  const [allowReplies, setAllowReplies] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [allowSharing, setAllowSharing] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const selectedDuration = useMemo(
    () => DURATIONS.find(([hours]) => hours === durationHours),
    [durationHours]
  );

  const audiences = [
    ['FRIENDS', ui.friends],
    ['PUBLIC', ui.everyone],
    ['FOLLOWERS', ui.followers],
    ['BEST_FRIENDS', ui.bestFriends],
    ['PRIVATE', ui.onlyMe]
  ] as const;

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
    if (!selected) return;
    if (selected.type.startsWith('image/')) setType('PHOTO');
    if (selected.type.startsWith('video/')) setType('VIDEO');
  }

  async function uploadStoryMedia(): Promise<string | undefined> {
    if (!file) return undefined;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'].includes(file.type)) {
      throw new Error('Unsupported Story media format.');
    }
    if (file.size > 25 * 1024 * 1024) throw new Error('Story media exceeds 25 MB.');

    const session = await apiFetch<UploadSession>('/media/uploads', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'STORY',
        visibility: 'PRIVATE',
        maxBytes: Math.max(1024, file.size),
        allowedMime: [file.type]
      })
    });
    const body = new FormData();
    body.append('file', file);
    const asset = await apiFetch<UploadedAsset>(`/media/uploads/${session.id}/complete`, {
      method: 'POST',
      headers: { 'x-upload-token': session.uploadToken },
      body
    });
    return asset.id;
  }

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
    const locationLabel = String(data.get('locationLabel') ?? '').trim();
    const musicAssetId = String(data.get('musicAssetId') ?? '').trim();

    setPublishing(true);
    setMessage('');
    try {
      const assetId = await uploadStoryMedia();
      const effectiveType = assetId ? type : type === 'PHOTO' || type === 'VIDEO' ? 'TEXT' : type;
      const story = await apiFetch<StoryResponse>('/stories', {
        method: 'POST',
        body: JSON.stringify({
          type: effectiveType,
          audience,
          caption: caption || undefined,
          assetId,
          linkUrl: effectiveType === 'LINK' ? linkUrl : undefined,
          hashtags,
          locationLabel: locationLabel || undefined,
          musicAssetId: musicAssetId || undefined,
          durationHours: permanent ? undefined : durationHours,
          permanent,
          allowReplies,
          allowReactions,
          allowSharing,
          background: effectiveType === 'TEXT' ? { preset: 'knowme-gradient', alignment: 'center' } : undefined
        })
      });
      router.replace(`/stories/${story.id}`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : ui.unavailable);
    } finally {
      setPublishing(false);
    }
  }

  if (loading || !user) return <main className="shell"><p>{ui.loading}</p></main>;

  return (
    <main className="shell" style={{ maxWidth: 680, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Link href="/feed" className="btn" aria-label={ui.close}>×</Link>
        <div style={{ flex: 1 }}>
          <small style={{ color: 'var(--mint)' }}>@{user.username}</small>
          <h1 style={{ margin: 0 }}>{ui.createTitle}</h1>
        </div>
        <Link href="/stories/archive" className="btn">{ui.archive}</Link>
      </header>

      <form onSubmit={submit} className="grid" style={{ gap: 16 }}>
        <section className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button type="button" className={type === 'TEXT' ? 'btn btn-primary' : 'btn'} onClick={() => setType('TEXT')}>{ui.text}</button>
            <label className={type === 'PHOTO' ? 'btn btn-primary' : 'btn'} style={{ cursor: 'pointer' }}>
              Photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseFile} hidden />
            </label>
            <label className={type === 'VIDEO' ? 'btn btn-primary' : 'btn'} style={{ cursor: 'pointer' }}>
              Video<input type="file" accept="video/mp4" onChange={chooseFile} hidden />
            </label>
            <button type="button" className={type === 'LINK' ? 'btn btn-primary' : 'btn'} onClick={() => setType('LINK')}>{ui.link}</button>
          </div>

          <div style={{
            minHeight: 420,
            borderRadius: 28,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            background: 'linear-gradient(145deg, rgba(121,87,255,.95), rgba(23,211,176,.5), rgba(18,20,29,.98))'
          }}>
            {previewUrl && type === 'PHOTO' && <img src={previewUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            {previewUrl && type === 'VIDEO' && <video src={previewUrl} controls muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            <textarea
              name="caption"
              className="input"
              rows={7}
              maxLength={4000}
              placeholder={ui.shareMoment}
              style={{ position: 'relative', zIndex: 2, fontSize: type === 'TEXT' ? 22 : 17, lineHeight: 1.35, resize: 'vertical', background: 'rgba(0,0,0,.32)' }}
              required={type === 'TEXT'}
            />
            {type === 'LINK' && (
              <input name="linkUrl" className="input" type="url" placeholder="https://…" required style={{ marginTop: 12, position: 'relative', zIndex: 2 }} />
            )}
          </div>

          <div className="grid" style={{ gap: 10, marginTop: 14 }}>
            <input name="hashtags" className="input" placeholder="#travel #gaming #knowme" />
            <input name="locationLabel" className="input" maxLength={160} placeholder="Location (optional)" />
            <input name="musicAssetId" className="input" placeholder="Music asset (optional)" />
          </div>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>{ui.audience}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {audiences.map(([value, label]) => (
              <button key={value} type="button" className={audience === value ? 'btn btn-primary' : 'btn'} onClick={() => setAudience(value)}>{label}</button>
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>{ui.duration}</h2>
          <select className="input" value={permanent ? 'PERMANENT' : String(durationHours)} onChange={(event) => {
            if (event.target.value === 'PERMANENT') setPermanent(true);
            else {
              setPermanent(false);
              setDurationHours(Number(event.target.value));
            }
          }}>
            {DURATIONS.map(([hours, label]) => <option key={hours} value={hours}>{label}</option>)}
            <option value="PERMANENT">Permanent · Premium</option>
          </select>
          {(permanent || selectedDuration?.[2]) && <small style={{ color: 'var(--mint)' }}>{ui.premiumRequired}</small>}
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>{ui.interactions}</h2>
          <label style={{ display: 'flex', gap: 10, marginBottom: 10 }}><input type="checkbox" checked={allowReplies} onChange={(e) => setAllowReplies(e.target.checked)} /> {ui.allowReplies}</label>
          <label style={{ display: 'flex', gap: 10, marginBottom: 10 }}><input type="checkbox" checked={allowReactions} onChange={(e) => setAllowReactions(e.target.checked)} /> {ui.allowReactions}</label>
          <label style={{ display: 'flex', gap: 10 }}><input type="checkbox" checked={allowSharing} onChange={(e) => setAllowSharing(e.target.checked)} /> {ui.allowSharing}</label>
        </section>

        {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}
        <button className="btn btn-primary" disabled={publishing} style={{ minHeight: 52 }}>{publishing ? ui.publishing : ui.shareStory}</button>
      </form>
    </main>
  );
}
