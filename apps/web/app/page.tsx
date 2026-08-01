import Link from 'next/link';

export default function Home() {
  return (
    <main className="shell" style={{display:'grid',placeItems:'center'}}>
      <section className="card" style={{maxWidth:760,padding:36,textAlign:'center'}}>
        <div style={{fontSize:64}}>🧠✨</div>
        <h1 style={{fontSize:'clamp(44px,8vw,88px)',margin:'8px 0'}}>KnowMe</h1>
        <p style={{color:'var(--muted)',fontSize:20}}>
          Des défis, des jeux et des conversations pour découvrir les personnes qui comptent.
        </p>
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap',marginTop:26}}>
          <Link className="btn btn-primary" href="/register">Créer un compte</Link>
          <Link className="btn btn-accent" href="/login">Se connecter</Link>
        </div>
      </section>
    </main>
  );
}
