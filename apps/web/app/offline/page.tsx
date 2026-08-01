export default function OfflinePage() {
  return (
    <main className="shell" style={{display:'grid',placeItems:'center'}}>
      <section className="card" style={{padding:32,textAlign:'center',maxWidth:520}}>
        <div style={{fontSize:56}}>📡</div>
        <h1>Tu es hors connexion</h1>
        <p style={{color:'var(--muted)'}}>
          Certaines fonctionnalités de KnowMe nécessitent Internet.
          Vérifie ta connexion puis réessaie.
        </p>
      </section>
    </main>
  );
}
