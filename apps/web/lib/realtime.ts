'use client';

import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const REALTIME_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/realtime`;
let socket: Socket | null = null;

function createSocket() {
  return io(REALTIME_URL, {
    autoConnect: false,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    auth: { token: getAccessToken() }
  });
}

export function getRealtimeSocket() {
  if (!socket) {
    socket = createSocket();
  }

  if (typeof window !== 'undefined') {
    const token = getAccessToken();
    socket.auth = { token };

    if (token && !socket.connected) {
      socket.connect();
    }
  }

  return socket;
}

export function refreshRealtimeAuth() {
  const current = getRealtimeSocket();
  const token = getAccessToken();
  current.auth = { token };

  if (!token) {
    current.disconnect();
    return;
  }

  if (current.connected) {
    current.disconnect().connect();
  } else {
    current.connect();
  }
}

export function disconnectRealtimeSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
