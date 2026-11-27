import { WebSocketServer, WebSocket } from 'ws';

let wss = null;

/**
 * Attaches a WebSocket server at /ws onto the given HTTP server.
 */
export function initWebSocketServer(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket) => {
    socket.send(
      JSON.stringify({
        type: 'connected',
        payload: { message: 'NexusFlow live telemetry stream connected' },
        timestamp: Date.now()
      })
    );

    socket.on('error', () => {
      // Ignore transient client socket errors
    });
  });

  return wss;
}

/**
 * Broadcasts a typed JSON event to all active WebSocket clients.
 */
export function broadcast(type, payload) {
  if (!wss || wss.clients.size === 0) {
    return;
  }

  const serialized = JSON.stringify({
    type,
    payload,
    timestamp: Date.now()
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

/**
 * Returns the number of connected WebSocket clients.
 */
export function getConnectedClientCount() {
  if (!wss) {
    return 0;
  }
  let count = 0;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      count += 1;
    }
  }
  return count;
}

/**
 * Closes the WebSocket server cleanly.
 */
export async function closeWebSocketServer() {
  if (!wss) {
    return;
  }
  await new Promise((resolve) => {
    wss.close(() => resolve());
  });
  wss = null;
}
