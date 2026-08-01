'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getRealtimeSocket() {
  if (socket) return socket;

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('knowme_token')
      : null;

  socket = io(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/realtime`,
    {
      autoConnect: typeof window !== 'undefined',
      transports: ['websocket'],
      auth: { token }
    }
  );

  return socket;
}
