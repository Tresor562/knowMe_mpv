'use client';
import { FormEvent, useState } from 'react';

export default function RegisterPage() {
  const [message, setMessage] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/auth/register`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        displayName:f.get('displayName'), username:f.get('username'),
        email:f.get('email'), password:f.get('password')
      })
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('knowme_token', data.accessToken);
      window.location.href='/dashboard';
    } else setMessage(Array.isArray(data.message) ? data.message.join(', ') : data.message);
  }
  return (
    <main className="shell" style={{display:'grid',placeItems:'center'}}>
      <form className="card grid" onSubmit={submit} style={{width:'min(100%,500px)',padding:28}}>
        <h1>Créer ton profil</h1>
        <input className="input" name="displayName" placeholder="Nom affiché" required />
        <input className="input" name="username" placeholder="Pseudo" required />
        <input className="input" type="email" name="email" placeholder="Email" required />
        <input className="input" type="password" name="password" placeholder="Mot de passe (8 caractères minimum)" minLength={8} required />
        <button className="btn btn-primary">Commencer</button>
        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
