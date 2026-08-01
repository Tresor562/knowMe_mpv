import RealtimeDemo from './realtime-demo';

const conversations = [
  ['Léa','Tu me connais vraiment ? 😄','2 min'],
  ['Nexus Tech','Nouveau défi communautaire disponible','18 min'],
  ['Marc','J’ai répondu au défi !','1 h']
];

export default function MessagesPage() {
  return (
    <main className="shell" style={{maxWidth:820,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--mint)'}}>CONVERSATIONS</small>
        <h1>Messages</h1>
      </header>

      <section className="card" style={{overflow:'hidden'}}>
        {conversations.map(([name,last,time]) => (
          <div
            key={name}
            style={{
              display:'grid',
              gridTemplateColumns:'52px 1fr auto',
              gap:14,
              padding:18,
              borderBottom:'1px solid rgba(255,255,255,.06)',
              alignItems:'center'
            }}
          >
            <div style={{width:52,height:52,borderRadius:'50%',background:'var(--surface-2)',display:'grid',placeItems:'center',fontWeight:800}}>
              {name[0]}
            </div>
            <div>
              <strong>{name}</strong>
              <div style={{color:'var(--muted)',marginTop:4}}>{last}</div>
            </div>
            <small style={{color:'var(--muted)'}}>{time}</small>
          </div>
        ))}
      </section>

      <RealtimeDemo />
    </main>
  );
}
