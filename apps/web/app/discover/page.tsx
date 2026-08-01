const suggestions = [
  {
    name: 'Léa',
    username: '@lea',
    score: 86,
    interests: ['Musique', 'Anime', 'Voyage']
  },
  {
    name: 'Marc',
    username: '@marc',
    score: 78,
    interests: ['Tech', 'IA']
  },
  {
    name: 'Aïcha',
    username: '@aicha',
    score: 74,
    interests: ['Design', 'Entrepreneuriat']
  }
];

export default function DiscoverPage() {
  return (
    <main className="shell" style={{maxWidth:980,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--mint)'}}>DÉCOUVERTE INTELLIGENTE</small>
        <h1>Des personnes qui pourraient te correspondre</h1>
      </header>

      <section className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))'}}>
        {suggestions.map((suggestion) => (
          <article className="card" key={suggestion.username} style={{padding:22}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:16}}>
              <div>
                <h2 style={{margin:'0 0 4px'}}>{suggestion.name}</h2>
                <div style={{color:'var(--muted)'}}>{suggestion.username}</div>
              </div>
              <div style={{fontSize:28,fontWeight:900,color:'var(--mint)'}}>
                {suggestion.score} %
              </div>
            </div>

            <p style={{color:'var(--muted)'}}>Centres d’intérêt communs</p>

            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {suggestion.interests.map((interest) => (
                <span
                  key={interest}
                  style={{
                    background:'var(--surface-2)',
                    borderRadius:999,
                    padding:'8px 12px'
                  }}
                >
                  {interest}
                </span>
              ))}
            </div>

            <button className="btn btn-primary" style={{width:'100%',marginTop:20}}>
              Lancer un défi
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
