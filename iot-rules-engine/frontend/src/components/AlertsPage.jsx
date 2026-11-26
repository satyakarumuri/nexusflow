import React, { useState } from 'react';
import { fmtDateTime } from '../lib.js';
import { SeverityPill } from './Dashboard.jsx';

export default function AlertsPage({ alerts, onAck, onAckAll }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? alerts : alerts.filter((a) => !a.acknowledged);

  return (
    <div className="page">
      <header className="page-head row">
        <div>
          <h1>Alerts</h1>
          <p>Every time a rule fires, it lands here with the readings that caused it.</p>
        </div>
        <div className="controls">
          <label className="check"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show acknowledged</label>
          <button className="btn" onClick={onAckAll} disabled={!alerts.some((a) => !a.acknowledged)}>Acknowledge all</button>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="empty panel">No open alerts.</p>
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th>Severity</th><th>Rule</th><th>Device</th><th>What happened</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a._id} className={a.acknowledged ? 'dim' : ''}>
                  <td className="mono">{fmtDateTime(a.ts)}</td>
                  <td><SeverityPill s={a.severity} /></td>
                  <td>{a.ruleName}</td>
                  <td className="mono">{a.deviceId}</td>
                  <td>{a.message}</td>
                  <td>{a.resolvedAt ? 'Back to normal' : 'Still active'}</td>
                  <td>{!a.acknowledged && <button className="btn small" onClick={() => onAck(a._id)}>Acknowledge</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
