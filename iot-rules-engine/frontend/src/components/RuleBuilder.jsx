import React, { useState } from 'react';
import { api } from '../api.js';
import { dehydrate, hydrate, metricsIn, newGroup } from '../lib.js';
import ConditionEditor from './ConditionEditor.jsx';

const blank = () => ({
  name: '',
  description: '',
  severity: 'warning',
  target: { type: 'all', value: '' },
  condition: newGroup(),
  durationSeconds: 0,
  cooldownSeconds: 60,
  message: '',
  actions: [],
  enabled: true,
});

function sampleReadings(condition) {
  const metrics = [...metricsIn(dehydrateSafe(condition))];
  const list = metrics.length ? metrics : ['temperature'];
  return Array.from({ length: 40 }, (_, i) => ({
    tOffsetSec: i,
    deviceId: 'test-device',
    metrics: Object.fromEntries(list.map((m) => [m, Math.round((60 + i) * 10) / 10])),
  }));
}

function dehydrateSafe(c) {
  try { return dehydrate(c); } catch { return {}; }
}

export default function RuleBuilder({ rule, knownMetrics, devices, onCancel, onSaved }) {
  const [form, setForm] = useState(() => (rule ? { ...blank(), ...rule, condition: hydrate(rule.condition) } : blank()));
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [sample, setSample] = useState('');
  const [testOut, setTestOut] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const payload = () => ({
    name: form.name,
    description: form.description,
    severity: form.severity,
    target: form.target,
    condition: dehydrate(form.condition),
    durationSeconds: Number(form.durationSeconds) || 0,
    cooldownSeconds: Number(form.cooldownSeconds) || 0,
    message: form.message,
    enabled: form.enabled,
    actions: form.actions.map((a) => (a.type === 'webhook' ? { type: 'webhook', url: a.url } : { type: 'command', name: a.name, params: a.params || {} })),
  });

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      if (rule) await api.updateRule(rule._id, payload());
      else await api.createRule(payload());
      onSaved();
    } catch (e) {
      setErrors(e.details?.length ? e.details : [e.message]);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setErrors([]);
    setTestOut(null);
    try {
      const readings = JSON.parse(sample || JSON.stringify(sampleReadings(form.condition)));
      setTestOut(await api.testRule(payload(), readings));
    } catch (e) {
      setErrors(e.details?.length ? e.details : [e.message]);
    }
  };

  const setAction = (i, patch) => set({ actions: form.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const deviceIds = devices.map((d) => d.deviceId);
  const deviceTypes = [...new Set(devices.map((d) => d.type))];

  return (
    <div className="page builder">
      <header className="page-head">
        <h1>{rule ? 'Edit rule' : 'New rule'}</h1>
        <p>Describe the situation to watch for. The engine checks it on every incoming reading.</p>
      </header>

      <datalist id="metric-list">{knownMetrics.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="device-list">{deviceIds.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="type-list">{deviceTypes.map((m) => <option key={m} value={m} />)}</datalist>

      {errors.length > 0 && (
        <div className="error" role="alert">
          <strong>Fix these before saving:</strong>
          <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      <section className="panel form">
        <label className="field">
          <span>Rule name</span>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Overheating" />
        </label>
        <label className="field">
          <span>Notes (optional)</span>
          <input value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Why this rule exists" />
        </label>
        <div className="row-fields">
          <label className="field">
            <span>Severity</span>
            <select value={form.severity} onChange={(e) => set({ severity: e.target.value })}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="field">
            <span>Applies to</span>
            <select value={form.target.type} onChange={(e) => set({ target: { type: e.target.value, value: '' } })}>
              <option value="all">All devices</option>
              <option value="deviceType">A device type</option>
              <option value="device">One device</option>
            </select>
          </label>
          {form.target.type !== 'all' && (
            <label className="field">
              <span>{form.target.type === 'device' ? 'Device ID' : 'Device type'}</span>
              <input list={form.target.type === 'device' ? 'device-list' : 'type-list'} value={form.target.value} onChange={(e) => set({ target: { ...form.target, value: e.target.value } })} />
            </label>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Condition</h2>
        <ConditionEditor node={form.condition} onChange={(c) => set({ condition: c })} />
        <div className="row-fields timing">
          <label className="field">
            <span>Must stay true for (seconds)</span>
            <input type="number" min="0" value={form.durationSeconds} onChange={(e) => set({ durationSeconds: e.target.value })} />
          </label>
          <label className="field">
            <span>Minimum time between alerts (seconds)</span>
            <input type="number" min="0" value={form.cooldownSeconds} onChange={(e) => set({ cooldownSeconds: e.target.value })} />
          </label>
        </div>
        <p className="hint">Use "must stay true" to ignore short spikes. If the problem persists, you get another alert after the minimum time; 0 means one alert per episode.</p>
      </section>

      <section className="panel form">
        <h2>When it triggers</h2>
        <p className="hint">An alert is always created. Add more steps if you want the engine to act too.</p>
        <label className="field">
          <span>Alert message (optional)</span>
          <input value={form.message} onChange={(e) => set({ message: e.target.value })} placeholder="{{device}} is at {{temperature}}°C" />
        </label>
        {form.actions.map((a, i) => (
          <div className="action" key={i}>
            <select value={a.type} onChange={(e) => setAction(i, { type: e.target.value })} aria-label="Action type">
              <option value="command">Send a command to the device</option>
              <option value="webhook">Call a webhook</option>
            </select>
            {a.type === 'webhook' ? (
              <input value={a.url || ''} onChange={(e) => setAction(i, { url: e.target.value })} placeholder="https://example.com/hook" />
            ) : (
              <input value={a.name || ''} onChange={(e) => setAction(i, { name: e.target.value })} placeholder="command name, e.g. cooling_on" className="mono" />
            )}
            <button type="button" className="link" onClick={() => set({ actions: form.actions.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <div><button type="button" className="btn small" onClick={() => set({ actions: [...form.actions, { type: 'command', name: '' }] })}>Add step</button></div>
      </section>

      <section className="panel">
        <h2>Try it on sample data</h2>
        <p className="hint">Replays readings through this rule without storing anything or sending any alerts. The default sample ramps every metric from 60 to 99 over 40 seconds.</p>
        <textarea rows={5} className="mono" value={sample} onChange={(e) => setSample(e.target.value)} placeholder='[{"tOffsetSec":0,"deviceId":"test-device","metrics":{"temperature":70}}, ...]' />
        <div className="group-add">
          <button type="button" className="btn" onClick={runTest}>Run test</button>
          <button type="button" className="btn" onClick={() => setSample(JSON.stringify(sampleReadings(form.condition), null, 1))}>Fill with ramp sample</button>
        </div>
        {testOut && (
          <div className="test-out">
            <p><strong>{testOut.events.filter((e) => e.event === 'triggered').length}</strong> alert(s) from {testOut.readings} readings.</p>
            <ul>
              {testOut.events.map((e, i) => (
                <li key={i}>
                  <span className="mono">+{e.tOffsetSec}s</span> {e.event === 'triggered' ? 'Triggered' : 'Back to normal'}
                  {e.values && ` — ${e.values.filter((v) => v.ok).map((v) => `${v.agg !== 'last' ? `${v.agg} ` : ''}${v.metric} = ${Math.round(v.actual * 100) / 100}`).join(', ')}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="bar">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save rule'}</button>
      </div>
    </div>
  );
}
