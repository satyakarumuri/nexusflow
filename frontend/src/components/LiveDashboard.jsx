import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { Play, Square, Flame, Database, Zap, Activity } from 'lucide-react';

const DEVICES = ['turbine-01', 'compressor-02', 'cnc-mill-03', 'boiler-04'];
const METRICS = [
  { key: 'temperature', label: 'Temperature (°C)', color: '#22d3ee', warnLine: 80 },
  { key: 'vibration', label: 'Vibration (mm/s)', color: '#f59e0b', warnLine: 4 },
  { key: 'pressure', label: 'Pressure (kPa)', color: '#8b5cf6', warnLine: null },
  { key: 'rpm', label: 'RPM', color: '#10b981', warnLine: null },
  { key: 'power', label: 'Power (kW)', color: '#ec4899', warnLine: null }
];

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function LiveDashboard({
  telemetryByDevice,
  selectedDevice,
  onSelectDevice,
  selectedMetric,
  onSelectMetric,
  stats,
  simRunning,
  onStartSim,
  onStopSim,
  onInjectSpike
}) {
  const metricInfo = METRICS.find((m) => m.key === selectedMetric) || METRICS[0];

  const chartData = useMemo(() => {
    const list = telemetryByDevice[selectedDevice] || [];
    return list.map((pt) => ({
      time: new Date(pt.timestamp).toLocaleTimeString([], {
        hour12: false,
        minute: '2-digit',
        second: '2-digit'
      }),
      value: pt.metrics?.[selectedMetric] ?? null
    }));
  }, [telemetryByDevice, selectedDevice, selectedMetric]);

  const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : '--';
  const ingestion = stats?.ingestion || {};
  const storage = stats?.storage || {};
  const runtime = stats?.runtime || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', padding: 16 }}>
      {/* Top KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
          gap: 12
        }}
      >
        <KpiCard
          icon={Zap}
          accent="#22d3ee"
          label="INGESTION THROUGHPUT"
          value={`${(ingestion.writesPerSec || 0).toLocaleString()} /s`}
          sub={`Total: ${(ingestion.totalIngested || 0).toLocaleString()} pts`}
        />
        <KpiCard
          icon={Database}
          accent="#10b981"
          label="MONGODB TIME-SERIES"
          value={`${(storage.count || 0).toLocaleString()} docs`}
          sub={`Disk: ${formatBytes(storage.storageSizeBytes)} (${storage.compressionRatio || 1}x)`}
        />
        <KpiCard
          icon={Activity}
          accent="#8b5cf6"
          label="ACTIVE RXJS PIPELINES"
          value={`${runtime.activePipelines ?? 0}`}
          sub={`Flush latency: ${ingestion.lastFlushLatencyMs ?? 0} ms`}
        />
        <div
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 8
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            HARDWARE SIMULATOR
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!simRunning ? (
              <button type="button" className="nf-btn nf-btn-primary" onClick={onStartSim}>
                <Play size={13} /> Start Stream
              </button>
            ) : (
              <button type="button" className="nf-btn nf-btn-danger" onClick={onStopSim}>
                <Square size={13} /> Stop Stream
              </button>
            )}
            <button
              type="button"
              className="nf-btn nf-btn-amber"
              onClick={onInjectSpike}
              title="Spike turbine-01 temperature above 90°C for 8 seconds"
            >
              <Flame size={13} /> Inject Overheat
            </button>
          </div>
        </div>
      </div>

      {/* Live Recharts Telemetry Card */}
      <div
        style={{
          flex: 1,
          minHeight: 280,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              Real-Time Stream: <span className="mono" style={{ color: metricInfo.color }}>{selectedDevice}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Latest {metricInfo.label}:{' '}
              <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                {latestValue}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={selectedDevice}
              onChange={(e) => onSelectDevice(e.target.value)}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-strong)',
                borderRadius: 7,
                color: 'var(--text-primary)',
                padding: '6px 10px',
                fontSize: 12
              }}
            >
              {DEVICES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={selectedMetric}
              onChange={(e) => onSelectMetric(e.target.value)}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-strong)',
                borderRadius: 7,
                color: 'var(--text-primary)',
                padding: '6px 10px',
                fontSize: 12
              }}
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nfMetricGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricInfo.color} stopOpacity={0.38} />
                  <stop offset="95%" stopColor={metricInfo.color} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2b42" />
              <XAxis dataKey="time" stroke="#627391" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis stroke="#627391" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0b111d',
                  border: '1px solid #2e4063',
                  borderRadius: 8,
                  fontSize: 12
                }}
              />
              {metricInfo.warnLine !== null && (
                <ReferenceLine
                  y={metricInfo.warnLine}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{
                    value: `Threshold ${metricInfo.warnLine}`,
                    fill: '#fda4af',
                    fontSize: 11,
                    position: 'insideTopRight'
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke={metricInfo.color}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#nfMetricGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, accent, label, value, sub }) {
  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <Icon size={15} color={accent} />
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</div>
    </div>
  );
}
