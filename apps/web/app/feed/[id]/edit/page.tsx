'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/api';
import { useSession } from '../../../../lib/use-session';
import { useI18n } from '../../../../components/i18n-provider';
import { PostMediaPicker, PostMediaStrip } from '../../../../components/post-media-ui';
import { uploadPostFiles, type PostMedia } from '../../../../lib/post-media';

type EditablePost = {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string | null;
  attachments?: PostMedia[];
  author: { displayName: string; username: string; avatarUrl?: string | null };
};

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';

  const [post, setPost] = useState<EditablePost | null>(null);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [existingAssets, setExistingAssets] = useState<PostMedia[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionLoading || !user || !id) return;
    let active = true;
    setLoading(true);
    apiFetch<EditablePost>('/posts/' + encodeURIComponent(id))
      .then(next => {
        if (!active) return;
        if (next.authorId !== user.id) {
          setError(en ? 'Only the author can edit this post.' : 'Seul l’auteur peut modifier cette publication.');
          return;
        }
        setPost(next);
        setContent(next.content);
        setImageUrl(next.imageUrl ?? '');
        setExistingAssets(next.attachments ?? []);
        setSelectedFiles([]);
        setError('');
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : (en ? 'Post unavailable.' : 'Publication indisponible.'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, user?.id, sessionLoading, en]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post || (!content.trim() && !imageUrl.trim() && !selectedFiles.length && !existingAssets.length) || busy) return;
    const image = imageUrl.trim();
    if (image) {
      try {
        const parsed = new URL(image);
        if (parsed.protocol !== 'https:') throw new Error();
      } catch {
        setError(en ? 'Enter a valid HTTPS image link.' : 'Indique un lien HTTPS valide pour l’image.');
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const uploaded = await uploadPostFiles(selectedFiles,
        (index,count)=>setUploadProgress((en?'Uploading ':'Envoi ')+index+'/'+count));
      await apiFetch('/posts/' + encodeURIComponent(post.id), {
        method: 'PATCH',
        body: JSON.stringify({
          content: content.trim(), imageUrl: image || null,
          assetIds: [...existingAssets.map(item=>item.asset.id),...uploaded]
        })
      });
      router.push('/feed/' + encodeURIComponent(post.id));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (en ? 'Could not save the post.' : 'Enregistrement impossible.'));
    } finally { setBusy(false);setUploadProgress(''); }
  }

  return (
    <main className="shell" style={{ maxWidth: 780, margin: '0 auto', paddingBottom: 100 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div>
          <small style={{ color: 'var(--muted)' }}>KnowMe</small>
          <h1 style={{ fontSize: 23, margin: 0 }}>{en ? 'Edit post' : 'Modifier la publication'}</h1>
        </div>
        <Link href={'/feed/' + encodeURIComponent(id)} className="btn">
          {en ? 'Cancel' : 'Annuler'}
        </Link>
      </header>
      {error && <p role="alert" style={{ color: 'var(--orange)' }}>{error}</p>}
      {loading || sessionLoading ? <p>{en ? 'Loading…' : 'Chargement…'}</p> : post ? (
        <form onSubmit={save} className="card" style={{
          display: 'grid', gap: 17, padding: 18, borderRadius: 24,
          background: 'var(--surface-glass)', backdropFilter: 'blur(18px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            {post.author.avatarUrl ? <img src={post.author.avatarUrl} alt="" width={46} height={46}
              style={{ borderRadius: '50%', objectFit: 'cover' }}/> :
              <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 23,
                display: 'grid', placeItems: 'center', background: 'var(--surface-2)' }}>◯</span>}
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {post.author.displayName}
              </strong>
              <small style={{ color: 'var(--muted)' }}>@{post.author.username}</small>
            </div>
          </div>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontWeight: 600 }}>{en ? 'Text' : 'Texte de la publication'}</span>
            <textarea
              className="input" autoFocus maxLength={2000} rows={7}
              value={content} onChange={event => setContent(event.target.value)}
              placeholder={en ? 'What would you like to share?' : 'Que veux-tu partager ?'}
              style={{ resize: 'vertical', minHeight: 160, fontSize: 18, lineHeight: 1.5 }}
            />
            <small style={{ textAlign: 'right', color: 'var(--muted)' }}>{content.length}/2000</small>
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontWeight: 600 }}>{en ? 'Image (HTTPS URL)' : 'Image (lien HTTPS)'}</span>
            <input className="input" type="url" value={imageUrl}
              onChange={event => setImageUrl(event.target.value)}
              placeholder="https://…" />
          </label>
          {imageUrl.trim().startsWith('https://') && <img src={imageUrl.trim()}
            alt={en ? 'Image preview' : 'Aperçu de l’image'}
            style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 16 }}/>}
          <PostMediaPicker files={selectedFiles} onChange={setSelectedFiles}
            maxCount={10-existingAssets.length}/>
          {existingAssets.length>0 && <div style={{display:'grid',gap:6}}>
            <strong>{en?'Existing media':'Médias déjà publiés'}</strong>
            <PostMediaStrip postId={post.id} media={existingAssets}/>
            {existingAssets.map(item=><div key={item.asset.id}
              style={{display:'flex',gap:8,alignItems:'center',justifyContent:'space-between'}}>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {item.asset.originalName}
              </span>
              <button type="button" className="btn"
                onClick={()=>setExistingAssets(list=>list.filter(entry=>entry.asset.id!==item.asset.id))}>
                {en?'Remove':'Retirer'}
              </button>
            </div>)}
          </div>}
          {!!uploadProgress&&<p role="status" style={{color:'var(--mint)'}}>{uploadProgress}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy || (!content.trim() && !imageUrl.trim() && !selectedFiles.length && !existingAssets.length)}
            style={{ minHeight: 46 }}>
            {busy ? (en ? 'Saving…' : 'Enregistrement…') : (en ? 'Save changes' : 'Enregistrer les modifications')}
          </button>
        </form>
      ) : null}
    </main>
  );
}
