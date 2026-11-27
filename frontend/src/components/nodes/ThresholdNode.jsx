import { useReactFlow } from '@xyflow/react';
import { Gauge } from 'lucide-react';
import { NodeWrapper } from './NodeWrapper';

const OPERATORS = ['>', '>=', '<', '<=', '==', '!='];

export function ThresholdNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();

  return (
    <NodeWrapper
      id={id}
      title={data.label || 'Threshold'}
      icon={Gauge}
      accentColor="#f59e0b"
      selected={selected}
      pulsing={data.pulsing}
      badge={data.lastValue !== undefined ? `${data.lastValue}` : null}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '78px 1fr', gap: 6 }}>
        <div className="nf-field">
          <label>Op</label>
          <select
            className="nodrag mono"
            value={data.operator || '>'}
            onChange={(e) => updateNodeData(id, { operator: e.target.value })}
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>

        <div className="nf-field">
          <label>Target Value</label>
          <input
            className="nodrag mono"
            type="number"
            step="any"
            value={data.thresholdValue ?? 80}
            onChange={(e) => updateNodeData(id, { thresholdValue: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="nf-field">
        <label>Cooldown (ms)</label>
        <input
          className="nodrag mono"
          type="number"
          min={0}
          step={500}
          value={data.cooldownMs ?? 3000}
          onChange={(e) =>
            updateNodeData(id, { cooldownMs: Math.max(0, Number(e.target.value) || 0) })
          }
        />
      </div>
    </NodeWrapper>
  );
}
