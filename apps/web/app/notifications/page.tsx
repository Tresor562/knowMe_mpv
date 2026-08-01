const notifications = [
  ['🎯','Léa t’a invité à un défi','Il y a 2 min'],
  ['💬','Nouveau message de Marc','Il y a 8 min'],
  ['🔥','Ton défi devient populaire','Il y a 1 h'],
  ['🪙','Tu as gagné 25 KnowCoins','Hier']
];

export default function NotificationsPage() {
  return (
    <main className="shell" style={{maxWidth:760,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--orange)'}}>ALERTES</small>
        <h1>Notifications</h1>
      </header>
      <section className="card" style={{overflow:'hidden'}}>
        {notifications.map(([icon,title,time]) => (
          <div key={title} style={{display:'grid',gridTemplateColumns:'48px 1fr auto',gap:14,padding:18,borderBottom:'1px solid rgba(255,255,255,.06)',alignItems:'center'}}>
            <div style={{fontSize:28}}>{icon}</div>
            <strong>{title}</strong>
            <small style={{color:'var(--muted)'}}>{time}</small>
          </div>
        ))}
      </section>
    </main>
  );
}
