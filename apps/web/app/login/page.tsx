'use client';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const [message, setMessage] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/auth/login`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ identifier: form.get('identifier'), password: form.get('password') })
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('knowme_token', data.accessToken);
      window.location.href = '/dashboard';
    } else setMessage(data.message ?? 'Connexion impossible.');
  }
  return (
    <main className="shell" style={{display:'grid',placeItems:'center'}}>
      <form className="card grid" onSubmit={submit} style={{width:'min(100%,430px)',padding:28}}>
        <h1>Connexion</h1>
        <input className="input" name="identifier" placeholder="Email ou pseudo" required />
        <input className="input" name="password" type="password" placeholder="Mot de passe" minLength={8} required />
        <button className="btn btn-primary">Entrer dans KnowMe</button>
        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
