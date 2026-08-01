const signals = [
  ['Centres d’intérêt', 88],
  ['Réponses communes', 76],
  ['Activités partagées', 82]
];

export default function CompatibilityPage() {
  return (
    <main className="shell" style={{maxWidth:760,margin:'0 auto'}}>
      <section className="card" style={{padding:28,textAlign:'center'}}>
        <small style={{color:'var(--orange)'}}>ANALYSE KNOWME</small>
        <h1>Ta compatibilité avec Léa</h1>

        <div
          style={{
            width:180,
            height:180,
            margin:'24px auto',
            borderRadius:'50%',
            border:'18px solid var(--mint)',
            display:'grid',
            placeItems:'center',
            fontSize:44,
            fontWeight:900
          }}
        >
          84 %
        </div>

        <p style={{color:'var(--muted)',fontSize:18}}>
          Vous partagez plusieurs centres d’intérêt et répondez souvent de manière similaire.
        </p>

        <div className="grid" style={{marginTop:24}}>
          {signals.map(([label, value]) => (
            <div key={label} style={{textAlign:'left'}}>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span>{label}</span>
                <strong>{value} %</strong>
              </div>
              <div style={{height:10,background:'var(--surface-2)',borderRadius:999,marginTop:8}}>
                <div
                  style={{
                    width:`${value}%`,
                    height:'100%',
                    borderRadius:999,
                    background:'var(--mint)'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
