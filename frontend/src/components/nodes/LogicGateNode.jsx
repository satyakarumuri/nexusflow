import { useReactFlow } from '@xyflow/react';
import { GitMerge } from 'lucide-react';
import { NodeWrapper } from './NodeWrapper';

export function LogicGateNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();

  return (
    <NodeWrapper
      id={id}
      title={data.label || 'Logic Gate'}
      icon={GitMerge}
      accentColor="#10b981"
      selected={selected}
      pulsing={data.pulsing}
      badge={data.gateType || 'AND'}
    >
      <div className="nf-field">
        <label>Gate Mode</label>
        <select
          className="nodrag"
          value={data.gateType || 'AND'}
          onChange={(e) => updateNodeData(id, { gateType: e.target.value })}
        >
          <option value="AND">AND (All Inputs Active)</option>
          <option value="OR">OR (Any Input Active)</option>
        </select>
      </div>

      {(data.gateType || 'AND') === 'AND' && (
        <div className="nf-field">
          <label>Correlation Window (ms)</label>
          <input
            className="nodrag mono"
            type="number"
            min={500}
            step={500}
            value={data.windowMs ?? 5000}
            onChange={(e) =>
              updateNodeData(id, { windowMs: Math.max(500, Number(e.target.value) || 5000) })
            }
          />
        </div>
      )}
    </NodeWrapper>
  );
}
