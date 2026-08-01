'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getRealtimeSocket() {
  if (socket) return socket;

  socket = io(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/realtime`,
    {
      transports: ['websocket'],
      auth: { token: window.localStorage.getItem('knowme_token') }
    }
  );

  return socket;
}
