import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, API_BASE } from './api.js';

const MAX_POINTS = 300;

/** Live device state, rolling series and alert feed, fed by Socket.IO. */
export function useLive() {
  const [devices, setDevices] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0);
  const series = useRef({});
  const pending = useRef({});

  useEffect(() => {
    let alive = true;
    api.devices().then((list) => {
      if (!alive) return;
      const map = {};
      list.forEach((d) => { map[d.deviceId] = { deviceId: d.deviceId, type: d.type, status: d.status, lastSeen: d.lastSeen, metrics: d.lastMetrics || {} }; });
      setDevices((prev) => ({ ...map, ...prev }));
    }).catch(() => {});
    api.alerts('?limit=50').then((a) => alive && setAlerts(a)).catch(() => {});

    const socket = io(API_BASE || undefined, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('telemetry', (m) => {
      const prev = pending.current[m.deviceId];
      pending.current[m.deviceId] = { ...m, metrics: { ...(prev ? prev.metrics : {}), ...m.metrics } };
      const arr = (series.current[m.deviceId] ||= []);
      arr.push({ ts: m.ts, ...m.metrics });
      if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
    });
    socket.on('alert', (a) => setAlerts((prev) => [a, ...prev].slice(0, 100)));
    socket.on('alert:resolved', (r) =>
      setAlerts((prev) => prev.map((a) => (String(a.ruleId) === r.ruleId && a.deviceId === r.deviceId && !a.resolvedAt ? { ...a, resolvedAt: new Date(r.ts).toISOString() } : a)))
    );
    socket.on('device:status', (s) => setDevices((prev) => (prev[s.deviceId] ? { ...prev, [s.deviceId]: { ...prev[s.deviceId], status: s.status } } : prev)));

    // Batch UI updates: high-frequency streams re-render at most twice a second.
    const timer = setInterval(() => {
      const p = pending.current;
      const ids = Object.keys(p);
      if (ids.length === 0) return;
      pending.current = {};
      setDevices((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          const m = p[id];
          next[id] = { deviceId: id, type: m.type, status: 'online', lastSeen: m.ts, metrics: { ...(prev[id]?.metrics || {}), ...m.metrics } };
        }
        return next;
      });
      setTick((t) => t + 1);
    }, 500);

    return () => { alive = false; clearInterval(timer); socket.close(); };
  }, []);

  return { devices: Object.values(devices).sort((a, b) => a.deviceId.localeCompare(b.deviceId)), alerts, setAlerts, connected, series: series.current, tick };
}
