const stats = [
  ['Utilisateurs','12 480'],
  ['Publications','34 211'],
  ['Défis actifs','1 482'],
  ['Signalements ouverts','17']
];

export default function AdminPage() {
  return (
    <main className="shell" style={{maxWidth:1100,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--orange)'}}>ADMINISTRATION</small>
        <h1>Tableau de bord</h1>
      </header>
      <section className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
        {stats.map(([label,value]) => (
          <article className="card" key={label} style={{padding:22}}>
            <div style={{color:'var(--muted)'}}>{label}</div>
            <strong style={{fontSize:32}}>{value}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
