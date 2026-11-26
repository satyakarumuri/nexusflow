import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { api } from '../api.js';
import { ago, fmtTime } from '../lib.js';

const RANGES = [
  ['live', 'Live'],
  ['900000', '15 min'],
  ['3600000', '1 hour'],
  ['86400000', '24 hours'],
];

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-v">{value}</div>
      <div className="stat-l">{label}</div>
    </div>
  );
}

export function SeverityPill({ s }) {
  return <span className={`pill sev-${s}`}>{s}</span>;
}

export default function Dashboard({ live, onAck }) {
  const { devices, alerts, series, tick } = live;
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [metric, setMetric] = useState('');
  const [range, setRange] = useState('live');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const load = () => api.stats().then(setStats).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selected && devices.length) setSelected(devices[0].deviceId);
  }, [devices, selected]);

  const dev = devices.find((d) => d.deviceId === selected);
  const metricNames = dev ? Object.keys(dev.metrics) : [];
  useEffect(() => {
    if (metricNames.length && !metricNames.includes(metric)) setMetric(metricNames[0]);
  }, [selected, metricNames.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (range === 'live' || !selected || !metric) { setHistory([]); return undefined; }
    let alive = true;
    const load = () =>
      api.series(selected, metric, Date.now() - Number(range))
        .then((r) => alive && setHistory(r.points.map((p) => ({ ts: new Date(p.ts).getTime(), value: Math.round(p.avg * 100) / 100 }))))
        .catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => { alive = false; clearInterval(t); };
  }, [range, selected, metric]);

  const data = useMemo(() => {
    if (range !== 'live') return history;
    return (series[selected] || []).filter((p) => p[metric] !== undefined).map((p) => ({ ts: p.ts, value: p[metric] }));
  }, [range, history, series, selected, metric, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeAlerts = alerts.filter((a) => !a.acknowledged).slice(0, 8);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Live monitor</h1>
        <p>Readings stream in from your devices; rules you define run against every one.</p>
      </header>

      <section className="stats">
        <Stat label="Devices online" value={stats ? `${stats.online} / ${stats.devices}` : '–'} />
        <Stat label="Readings per second" value={stats ? stats.ingestPerSecond : '–'} />
        <Stat label="Readings stored" value={stats ? stats.ingestedTotal.toLocaleString() : '–'} />
        <Stat label="Active rules" value={stats ? stats.rules : '–'} />
        <Stat label="Unacknowledged alerts" value={stats ? stats.openAlerts : '–'} />
      </section>

      <div className="grid">
        <section className="panel">
          <h2>Devices</h2>
          {devices.length === 0 && (
            <p className="empty">No devices yet. Run <code>npm run simulate</code> in the backend, or POST readings to <code>/api/telemetry</code>.</p>
          )}
          <div className="devices">
            {devices.map((d) => (
              <button key={d.deviceId} className={`device ${selected === d.deviceId ? 'on' : ''} ${d.status}`} onClick={() => setSelected(d.deviceId)}>
                <div className="device-top">
                  <span className="device-id">{d.deviceId}</span>
                  <span className={`status ${d.status}`}>{d.status}</span>
                </div>
                <div className="device-type">{d.type} · seen {ago(d.lastSeen)}</div>
                <div className="readouts">
                  {Object.entries(d.metrics).slice(0, 4).map(([k, v]) => (
                    <div key={k} className="readout"><span className="rv">{typeof v === 'number' ? v.toFixed(1) : v}</span><span className="rk">{k}</span></div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{selected ? `${selected}` : 'Trend'}</h2>
            <div className="controls">
              <select value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Metric">
                {metricNames.map((m) => <option key={m}>{m}</option>)}
              </select>
              <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Time range">
                {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#d5dde4" strokeDasharray="2 4" />
                <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtTime} tick={{ fontSize: 11, fill: '#5b6b7a' }} minTickGap={48} />
                <YAxis tick={{ fontSize: 11, fill: '#5b6b7a' }} domain={['auto', 'auto']} width={44} />
                <Tooltip labelFormatter={fmtTime} contentStyle={{ fontSize: 12, borderRadius: 4 }} />
                <Line type="monotone" dataKey="value" name={metric} stroke="#0b6e8a" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel wide">
          <h2>Needs attention</h2>
          {activeAlerts.length === 0 ? (
            <p className="empty">Nothing needs attention. Alerts appear here as soon as a rule fires.</p>
          ) : (
            <ul className="feed">
              {activeAlerts.map((a) => (
                <li key={a._id} className={`feed-item sev-border-${a.severity}`}>
                  <div>
                    <div className="feed-title"><SeverityPill s={a.severity} /> <strong>{a.ruleName}</strong> on {a.deviceId}</div>
                    <div className="feed-msg">{a.message} · {fmtTime(a.ts)}{a.resolvedAt ? ' · back to normal' : ''}</div>
                  </div>
                  <button className="btn small" onClick={() => onAck(a._id)}>Acknowledge</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
