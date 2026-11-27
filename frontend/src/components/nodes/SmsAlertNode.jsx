import { useReactFlow } from '@xyflow/react';
import { MessageSquareWarning } from 'lucide-react';
import { NodeWrapper } from './NodeWrapper';

export function SmsAlertNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();

  return (
    <NodeWrapper
      id={id}
      title={data.label || 'SMS Alert'}
      icon={MessageSquareWarning}
      accentColor="#f43f5e"
      selected={selected}
      pulsing={data.pulsing}
      hasOutput={false}
      badge={data.severity || 'critical'}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 6 }}>
        <div className="nf-field">
          <label>Recipient Phone</label>
          <input
            className="nodrag mono"
            type="text"
            value={data.phoneNumber || '+1-555-0199'}
            onChange={(e) => updateNodeData(id, { phoneNumber: e.target.value })}
          />
        </div>
        <div className="nf-field">
          <label>Severity</label>
          <select
            className="nodrag"
            value={data.severity || 'critical'}
            onChange={(e) => updateNodeData(id, { severity: e.target.value })}
          >
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      <div className="nf-field">
        <label>Message Template</label>
        <textarea
          className="nodrag"
          rows={2}
          value={
            data.messageTemplate ||
            'ALERT [{{ruleName}}]: {{deviceId}} {{metric}} reached {{value}}!'
          }
          onChange={(e) => updateNodeData(id, { messageTemplate: e.target.value })}
        />
      </div>
    </NodeWrapper>
  );
}
