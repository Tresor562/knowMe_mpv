'use client';

import Link from 'next/link';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Sticker = { key: string; version: number; label: string; glyph: string; accessibilityLabel: string };
type Pack = { key: string; version: number; name: string; description: string; stickers: Sticker[] };
type Catalog = { schemaVersion: number; packs: Pack[] };

export default function SharedStickersPage() {
  const { pack: packKey } = useParams<{pack: string}>();
  const { loading: sessionLoading } = useSession({required:true});
  const [pack, setPack] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState('');

  useEffect(() => {
    setSelected(new URLSearchParams(window.location.search).get('sticker') ?? '');
  }, [packKey]);

  useEffect(() => {
    if(sessionLoading) return;
    let active = true;
    setLoading(true);
    void apiFetch<Catalog>('/stickers/catalog')
      .then(result => { if(active) setPack(result.packs.find(item => item.key === packKey) ?? null); })
      .catch(() => { if(active) setPack(null); })
      .finally(() => { if(active) setLoading(false); });
    return () => { active = false; };
  },[sessionLoading,packKey]);

  async function copy(kind: 'sticker'|'sticker-pack', id: string) {
    try {
      await navigator.clipboard.writeText(buildKnowMePublicLink({kind,id}));
      setNotice('Lien copié.');
    } catch {
      setNotice('Copie indisponible.');
    }
  }

  if(sessionLoading || loading) return <main className="shell"><p>Chargement des stickers…</p></main>;
  if(!pack) return (
    <main className="shell"><section className="card"><h1>Pack indisponible</h1><p>Ce pack n’existe plus ou n’est pas accessible.</p><Link href="/messages">Retour aux discussions</Link></section></main>
  );

  return (
    <main className="shell" style={{maxWidth:850,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div><h1>{pack.name}</h1><p>{pack.description}</p></div>
        <button type="button" className="btn" onClick={() => void copy('sticker-pack',pack.key)}>Copier le lien du pack</button>
      </header>
      {notice && <p role="status" style={{color:'var(--mint)'}}>{notice}</p>}
      <section className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:12}}>
        {pack.stickers.map(sticker => (
          <article className="card" key={sticker.key}
            style={{textAlign:'center',outline:selected===sticker.key?'2px solid var(--mint)':undefined,scrollMarginTop:80}}
            id={`sticker-${sticker.key}`}>
            <div role="img" aria-label={sticker.accessibilityLabel} style={{fontSize:48,marginBottom:8}}>{sticker.glyph}</div>
            <strong>{sticker.label}</strong>
            <button type="button" className="btn" style={{display:'block',margin:'10px auto 0'}}
              onClick={() => void copy('sticker',`${pack.key}__${sticker.key}`)}>Lien du sticker</button>
          </article>
        ))}
      </section>
    </main>
  );
}
