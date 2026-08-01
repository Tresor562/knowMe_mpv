const posts = [
  {
    author: 'Léa',
    handle: '@lea',
    text: 'Qui pense vraiment me connaître ? J’ai lancé un nouveau défi 😄',
    stats: '24 j’aime · 8 commentaires'
  },
  {
    author: 'Nexus Tech',
    handle: '@nexustech',
    text: 'Défi du jour : présente ton projet tech en trois phrases.',
    stats: '41 j’aime · 12 commentaires'
  }
];

export default function FeedPage() {
  return (
    <main className="shell" style={{maxWidth:760,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--mint)'}}>ACTIVITÉ</small>
        <h1>Fil KnowMe</h1>
      </header>

      <section className="card" style={{padding:18,marginBottom:18}}>
        <textarea className="input" placeholder="Partage quelque chose..." rows={4} />
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
          <button className="btn btn-primary">Publier</button>
        </div>
      </section>

      <section className="grid">
        {posts.map((post) => (
          <article className="card" key={post.author + post.text} style={{padding:20}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:46,height:46,borderRadius:'50%',background:'var(--surface-2)',display:'grid',placeItems:'center',fontWeight:800}}>
                {post.author[0]}
              </div>
              <div>
                <strong>{post.author}</strong>
                <div style={{color:'var(--muted)'}}>{post.handle}</div>
              </div>
            </div>
            <p style={{fontSize:18,lineHeight:1.6}}>{post.text}</p>
            <small style={{color:'var(--muted)'}}>{post.stats}</small>
          </article>
        ))}
      </section>
    </main>
  );
}
