import { io, Socket } from 'socket.io-client';
import { API_URL, getAccessToken } from './api';

let socket: Socket | null = null;
let connectPromise: Promise<Socket | null> | null = null;

function realtimeEndpoint() {
  const api = new URL(API_URL);
  const prefix = api.pathname.replace(/\/+$/, '');
  return {
    namespaceUrl: `${api.origin}/realtime`,
    enginePath: `${prefix}/socket.io`
  };
}

function createSocket(token: string) {
  const endpoint = realtimeEndpoint();
  return io(endpoint.namespaceUrl, {
    path: endpoint.enginePath,
    autoConnect: false,
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 10000
  });
}

export async function getRealtimeSocket() {
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const token = await getAccessToken();
    if (!token) return null;

    if (!socket) {
      socket = createSocket(token);
    } else {
      socket.auth = { token };
    }

    if (!socket.connected) {
      socket.connect();
    }

    return socket;
  })().finally(() => {
    connectPromise = null;
  });

  return connectPromise;
}

export async function refreshRealtimeAuth() {
  const token = await getAccessToken();
  if (!token) {
    disconnectRealtimeSocket();
    return null;
  }

  if (!socket) {
    socket = createSocket(token);
  } else {
    socket.auth = { token };
  }

  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
  return socket;
}

export function disconnectRealtimeSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
