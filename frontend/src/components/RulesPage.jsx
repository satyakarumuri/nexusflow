import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { describe } from '../lib.js';
import RuleBuilder from './RuleBuilder.jsx';
import { SeverityPill } from './Dashboard.jsx';

const targetText = (t) => (!t || t.type === 'all' ? 'all devices' : t.type === 'device' ? `device ${t.value}` : `${t.value} devices`);

export default function RulesPage({ devices }) {
  const [rules, setRules] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | rule
  const [error, setError] = useState('');

  const load = useCallback(() => api.rules().then(setRules).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (r) => { await api.toggleRule(r._id); load(); };
  const remove = async (r) => {
    if (!window.confirm(`Delete the rule "${r.name}"? This cannot be undone.`)) return;
    await api.deleteRule(r._id);
    load();
  };

  const knownMetrics = [...new Set(devices.flatMap((d) => Object.keys(d.metrics)))];

  if (editing) {
    return (
      <RuleBuilder
        rule={editing === 'new' ? null : editing}
        knownMetrics={knownMetrics}
        devices={devices}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    );
  }

  return (
    <div className="page">
      <header className="page-head row">
        <div>
          <h1>Rules</h1>
          <p>Changes apply to the live stream immediately. No code changes, no redeploy.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>New rule</button>
      </header>
      {error && <div className="error">{error}</div>}
      {rules.length === 0 && !error && <p className="empty panel">No rules yet. Create one to start watching your devices.</p>}
      <div className="rules">
        {rules.map((r) => (
          <article key={r._id} className={`rule ${r.enabled ? '' : 'off'}`}>
            <div className="rule-main">
              <div className="rule-title">
                <SeverityPill s={r.severity} />
                <h3>{r.name}</h3>
              </div>
              <p className="rule-when"><span>When</span> {describe(r.condition)}{r.durationSeconds ? <>, for at least {r.durationSeconds}s</> : null}</p>
              <p className="rule-meta">
                Watches {targetText(r.target)}
                {r.actions?.length ? ` · ${r.actions.map((a) => (a.type === 'webhook' ? 'sends a webhook' : `sends command ${a.name}`)).join(', ')}` : ''}
                {` · fired ${r.triggerCount || 0} time${r.triggerCount === 1 ? '' : 's'}`}
              </p>
              {r.description && <p className="rule-desc">{r.description}</p>}
            </div>
            <div className="rule-actions">
              <label className="switch" title={r.enabled ? 'Turn off' : 'Turn on'}>
                <input type="checkbox" checked={r.enabled} onChange={() => toggle(r)} />
                <span>{r.enabled ? 'On' : 'Off'}</span>
              </label>
              <button className="btn small" onClick={() => setEditing(r)}>Edit</button>
              <button className="btn small danger" onClick={() => remove(r)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
