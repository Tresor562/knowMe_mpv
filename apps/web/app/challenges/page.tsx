const challenges = [
  {title:'Qui me connaît le mieux ?',meta:'5 participants · 10 questions',emoji:'🧠'},
  {title:'Vrai ou faux sur moi',meta:'3 participants · 8 questions',emoji:'🎭'},
  {title:'Nos points communs',meta:'2 participants · Compatibilité',emoji:'🤝'}
];
export default function ChallengesPage(){
  return <main className="shell" style={{maxWidth:900,margin:'0 auto'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><small style={{color:'var(--orange)'}}>LE CŒUR DE KNOWME</small><h1>Défis</h1></div>
      <button className="btn btn-accent">Créer</button>
    </header>
    <section className="grid">
      {challenges.map(c=><article className="card" key={c.title} style={{padding:22,display:'flex',gap:18,alignItems:'center'}}>
        <div style={{fontSize:42}}>{c.emoji}</div><div><h2 style={{margin:0}}>{c.title}</h2><p style={{color:'var(--muted)'}}>{c.meta}</p></div>
      </article>)}
    </section>
  </main>
}
