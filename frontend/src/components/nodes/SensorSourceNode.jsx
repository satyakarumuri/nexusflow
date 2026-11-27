import { useReactFlow } from '@xyflow/react';
import { Cpu } from 'lucide-react';
import { NodeWrapper } from './NodeWrapper';

const DEVICES = [
  { value: 'turbine-01', label: 'turbine-01 (Steam Turbine)' },
  { value: 'compressor-02', label: 'compressor-02 (Air Compressor)' },
  { value: 'cnc-mill-03', label: 'cnc-mill-03 (CNC Spindle)' },
  { value: 'boiler-04', label: 'boiler-04 (Thermal Boiler)' },
  { value: '*', label: '* (All Devices)' }
];

const METRICS = [
  { value: 'temperature', label: 'Temperature (°C)' },
  { value: 'vibration', label: 'Vibration (mm/s)' },
  { value: 'pressure', label: 'Pressure (kPa)' },
  { value: 'rpm', label: 'RPM' },
  { value: 'power', label: 'Power (kW)' }
];

export function SensorSourceNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();
  const liveBadge = data.lastValue !== undefined ? `${data.lastValue}` : null;

  return (
    <NodeWrapper
      id={id}
      title={data.label || 'Sensor Source'}
      icon={Cpu}
      accentColor="#22d3ee"
      selected={selected}
      pulsing={data.pulsing}
      hasInput={false}
      hasOutput
      badge={liveBadge}
    >
      <div className="nf-field">
        <label>Device ID</label>
        <select
          className="nodrag"
          value={data.deviceId || 'turbine-01'}
          onChange={(e) => updateNodeData(id, { deviceId: e.target.value })}
        >
          {DEVICES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="nf-field">
        <label>Metric Stream</label>
        <select
          className="nodrag"
          value={data.metric || 'temperature'}
          onChange={(e) => updateNodeData(id, { metric: e.target.value })}
        >
          {METRICS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </NodeWrapper>
  );
}
