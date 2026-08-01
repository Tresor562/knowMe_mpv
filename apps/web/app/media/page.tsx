'use client';

import { FormEvent, useState } from 'react';

type UploadResult = {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export default function MediaPage() {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem('knowme_token');
    const form = new FormData(event.currentTarget);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/media/upload`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message ?? 'Envoi impossible.');
      setResult(null);
      return;
    }

    setResult(data);
    setMessage('Fichier envoyé avec succès.');
  }

  return (
    <main className="shell" style={{maxWidth:720,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--orange)'}}>MÉDIAS</small>
        <h1>Ajouter une image ou une vidéo</h1>
      </header>

      <form className="card grid" onSubmit={submit} style={{padding:24}}>
        <input
          className="input"
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,video/mp4"
          required
        />
        <button className="btn btn-primary">Envoyer</button>
      </form>

      {message && <p>{message}</p>}

      {result && (
        <section className="card" style={{padding:20,marginTop:18}}>
          <h2>Résultat</h2>
          <pre style={{whiteSpace:'pre-wrap',color:'var(--muted)'}}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
