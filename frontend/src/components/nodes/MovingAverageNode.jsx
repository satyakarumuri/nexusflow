import { useReactFlow } from '@xyflow/react';
import { Activity } from 'lucide-react';
import { NodeWrapper } from './NodeWrapper';

export function MovingAverageNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();
  const liveBadge = data.lastValue !== undefined ? `avg ${data.lastValue}` : null;

  return (
    <NodeWrapper
      id={id}
      title={data.label || 'Moving Average'}
      icon={Activity}
      accentColor="#8b5cf6"
      selected={selected}
      pulsing={data.pulsing}
      badge={liveBadge}
    >
      <div className="nf-field">
        <label>Window Size (N samples)</label>
        <input
          className="nodrag mono"
          type="number"
          min={1}
          max={500}
          value={data.windowSize ?? 5}
          onChange={(e) =>
            updateNodeData(id, { windowSize: Math.max(1, Number(e.target.value) || 1) })
          }
        />
      </div>
    </NodeWrapper>
  );
}
