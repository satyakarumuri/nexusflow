import { useEffect, useRef, useState } from 'react';

/**
 * Connects to /ws with automatic exponential backoff reconnection and routes typed events.
 */
export function useWebSocket({ onTelemetry, onEdgePulse, onAlert, onStats }) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef({ onTelemetry, onEdgePulse, onAlert, onStats });
  handlersRef.current = { onTelemetry, onEdgePulse, onAlert, onStats };

  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;
    let stopped = false;
    let attempt = 0;

    function connect() {
      if (stopped) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const { type, payload } = msg;
          if (type === 'telemetry') handlersRef.current.onTelemetry?.(payload);
          else if (type === 'edge_pulse') handlersRef.current.onEdgePulse?.(payload);
          else if (type === 'alert') handlersRef.current.onAlert?.(payload);
          else if (type === 'stats') handlersRef.current.onStats?.(payload);
        } catch {
          // Ignore malformed frames
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!stopped) {
          const delay = Math.min(5000, 400 * 2 ** attempt);
          attempt += 1;
          reconnectTimer = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  return { connected };
}
