const cards = [
  ['🔥 Aujourd’hui pour toi','3 défis à relever avec tes amis.'],
  ['🧩 Compatibilité','Léa pense te connaître à 82 %.'],
  ['🎯 Objectif du jour','Découvre un nouveau point commun avec un ami.'],
  ['🪙 KnowCoins','Tu disposes de 120 KnowCoins.']
];

export default function Dashboard() {
  return (
    <main className="shell" style={{maxWidth:1100,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div><small style={{color:'var(--mint)'}}>BON RETOUR</small><h1 style={{margin:4}}>Ton univers KnowMe</h1></div>
        <button className="btn btn-accent">+ Nouveau défi</button>
      </header>
      <section className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))'}}>
        {cards.map(([title,text]) => <article className="card" key={title} style={{padding:22}}><h2>{title}</h2><p style={{color:'var(--muted)'}}>{text}</p></article>)}
      </section>
    </main>
  );
}
