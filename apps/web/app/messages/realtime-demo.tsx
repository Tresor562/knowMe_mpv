'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getRealtimeSocket } from '../../lib/realtime';

type Message = {
  id: string;
  content: string;
  sender?: { displayName?: string; username?: string };
};

export default function RealtimeDemo() {
  const socket = useMemo(() => getRealtimeSocket(), []);
  const conversationId = 'demo-room';
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState<string | null>(null);

  useEffect(() => {
    socket.emit('conversation:join', { conversationId });

    const onMessage = (message: Message) => {
      setMessages((current) => [...current, message]);
    };

    const onTyping = (event: {
      conversationId: string;
      username?: string;
      typing: boolean;
    }) => {
      if (event.conversationId === conversationId) {
        setTyping(event.typing ? event.username ?? 'Quelqu’un' : null);
      }
    };

    socket.on('message:created', onMessage);
    socket.on('typing:update', onTyping);

    return () => {
      socket.emit('conversation:leave', { conversationId });
      socket.off('message:created', onMessage);
      socket.off('typing:update', onTyping);
    };
  }, [socket]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const content = String(form.get('content') ?? '').trim();
    if (!content) return;

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        content,
        sender: { displayName: 'Moi' }
      }
    ]);

    event.currentTarget.reset();
    socket.emit('typing:stop', { conversationId });
  }

  return (
    <section className="card" style={{padding:20,marginTop:20}}>
      <h2>Démo temps réel</h2>

      <div style={{display:'grid',gap:10,margin:'18px 0'}}>
        {messages.map((message) => (
          <div key={message.id} style={{background:'var(--surface-2)',padding:12,borderRadius:14}}>
            <strong>{message.sender?.displayName ?? message.sender?.username ?? 'Utilisateur'}</strong>
            <div>{message.content}</div>
          </div>
        ))}
      </div>

      {typing && <small style={{color:'var(--mint)'}}>{typing} écrit...</small>}

      <form onSubmit={submit} style={{display:'flex',gap:10,marginTop:10}}>
        <input
          className="input"
          name="content"
          placeholder="Écrire un message..."
          onChange={(event) =>
            socket.emit(event.target.value ? 'typing:start' : 'typing:stop', {
              conversationId
            })
          }
        />
        <button className="btn btn-primary">Envoyer</button>
      </form>
    </section>
  );
}
