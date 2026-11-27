import { useReactFlow } from '@xyflow/react';
import { Webhook } from 'lucide-react';
import { NodeWrapper } from './NodeWrapper';

export function WebhookActionNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();

  return (
    <NodeWrapper
      id={id}
      title={data.label || 'HTTP Webhook'}
      icon={Webhook}
      accentColor="#ec4899"
      selected={selected}
      pulsing={data.pulsing}
      hasOutput={false}
      badge={data.method || 'POST'}
    >
      <div className="nf-field">
        <label>Endpoint URL</label>
        <input
          className="nodrag mono"
          type="text"
          value={data.url || '/api/webhooks/test-receiver'}
          onChange={(e) => updateNodeData(id, { url: e.target.value })}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 6 }}>
        <div className="nf-field">
          <label>Method</label>
          <select
            className="nodrag mono"
            value={data.method || 'POST'}
            onChange={(e) => updateNodeData(id, { method: e.target.value })}
          >
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
          </select>
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
      </div>
    </NodeWrapper>
  );
}
