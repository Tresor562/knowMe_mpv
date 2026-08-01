const interests = ['Cybersécurité', 'IA', 'Programmation', 'Musique'];

export default function ProfilePage() {
  return (
    <main className="shell" style={{maxWidth:880,margin:'0 auto'}}>
      <section className="card" style={{padding:28}}>
        <div style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{width:110,height:110,borderRadius:'50%',background:'linear-gradient(135deg,var(--mint),var(--orange))',display:'grid',placeItems:'center',fontSize:42,fontWeight:900}}>
            T
          </div>
          <div>
            <small style={{color:'var(--mint)'}}>PROFIL KNOWME</small>
            <h1 style={{margin:'5px 0'}}>Trésor</h1>
            <p style={{color:'var(--muted)'}}>@tresor · Niveau 12 · 120 KnowCoins</p>
          </div>
        </div>

        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',marginTop:26}}>
          <article className="card" style={{padding:18}}><strong style={{fontSize:28}}>82 %</strong><div style={{color:'var(--muted)'}}>Compatibilité moyenne</div></article>
          <article className="card" style={{padding:18}}><strong style={{fontSize:28}}>36</strong><div style={{color:'var(--muted)'}}>Défis terminés</div></article>
          <article className="card" style={{padding:18}}><strong style={{fontSize:28}}>9</strong><div style={{color:'var(--muted)'}}>Badges obtenus</div></article>
        </div>

        <h2>Centres d’intérêt</h2>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {interests.map((interest) => (
            <span key={interest} style={{background:'var(--surface-2)',padding:'10px 14px',borderRadius:999}}>
              {interest}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
