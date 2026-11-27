import { BellRing, Trash2, MessageSquareWarning, Webhook } from 'lucide-react';

export function AlertFeed({ alerts, onClear }) {
  return (
    <aside
      style={{
        width: 310,
        flexShrink: 0,
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700 }}>
          <BellRing size={14} color="var(--accent-rose)" />
          LIVE ALERTS ({alerts.length})
        </div>
        <button
          type="button"
          className="nf-btn"
          style={{ padding: '4px 8px', fontSize: 11 }}
          onClick={onClear}
          disabled={alerts.length === 0}
        >
          <Trash2 size={12} /> Clear
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 32, padding: 12 }}>
            No anomalies triggered yet. Start the simulator and inject an overheat spike to watch RxJS rules fire.
          </div>
        ) : (
          alerts.map((alert) => {
            const isWebhook = alert.channel === 'webhook';
            const badgeColor =
              alert.severity === 'critical'
                ? '#f43f5e'
                : alert.severity === 'warning'
                ? '#f59e0b'
                : '#22d3ee';

            return (
              <div
                key={alert.alertId}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: `3px solid ${badgeColor}`,
                  borderRadius: 8,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700 }}>
                    {isWebhook ? (
                      <Webhook size={13} color="#ec4899" />
                    ) : (
                      <MessageSquareWarning size={13} color={badgeColor} />
                    )}
                    <span>{isWebhook ? 'WEBHOOK' : 'SMS ALERT'}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(alert.createdAt).toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>

                <div style={{ fontSize: 12, lineHeight: 1.4 }}>{alert.message}</div>

                <div
                  className="mono"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    color: 'var(--text-secondary)'
                  }}
                >
                  <span>To: {alert.recipient}</span>
                  <span style={{ color: alert.delivery?.status === 'failed' ? '#fb7185' : '#34d399' }}>
                    {alert.delivery?.status || 'delivered'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
