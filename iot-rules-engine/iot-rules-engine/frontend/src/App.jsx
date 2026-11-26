import React, { useState } from 'react';
import { useLive } from './hooks.js';
import Dashboard from './components/Dashboard.jsx';
import RulesPage from './components/RulesPage.jsx';
import AlertsPage from './components/AlertsPage.jsx';
import { api } from './api.js';

const TABS = [
  ['dashboard', 'Live monitor'],
  ['rules', 'Rules'],
  ['alerts', 'Alerts'],
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const live = useLive();
  const open = live.alerts.filter((a) => !a.acknowledged).length;

  const ackAlert = async (id) => {
    await api.ackAlert(id);
    live.setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, acknowledged: true } : a)));
  };
  const ackAll = async () => {
    await api.ackAll();
    live.setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
  };

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-name">Rulebook</div>
            <div className="brand-sub">IoT rules engine</div>
          </div>
        </div>
        <nav>
          {TABS.map(([id, label]) => (
            <button key={id} className={`nav ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
              {label}
              {id === 'alerts' && open > 0 && <span className="count">{open}</span>}
            </button>
          ))}
        </nav>
        <div className={`conn ${live.connected ? 'up' : 'down'}`}>
          <span className="dot" /> {live.connected ? 'Receiving live data' : 'Reconnecting…'}
        </div>
      </aside>
      <main className="main">
        {tab === 'dashboard' && <Dashboard live={live} onAck={ackAlert} />}
        {tab === 'rules' && <RulesPage devices={live.devices} />}
        {tab === 'alerts' && <AlertsPage alerts={live.alerts} onAck={ackAlert} onAckAll={ackAll} />}
      </main>
    </div>
  );
}
