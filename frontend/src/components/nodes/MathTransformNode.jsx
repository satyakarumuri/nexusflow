import { useReactFlow } from '@xyflow/react';
import { Calculator } from 'lucide-react';
import { NodeWrapper } from './NodeWrapper';

const OPERATIONS = [
  { value: 'cToF', label: '°C → °F', needsOperand: false },
  { value: 'fToC', label: '°F → °C', needsOperand: false },
  { value: 'rateOfChange', label: 'Rate of Change (Δ/s)', needsOperand: false },
  { value: 'add', label: 'Add (+)', needsOperand: true },
  { value: 'subtract', label: 'Subtract (−)', needsOperand: true },
  { value: 'multiply', label: 'Multiply (×)', needsOperand: true },
  { value: 'divide', label: 'Divide (÷)', needsOperand: true },
  { value: 'abs', label: 'Absolute |x|', needsOperand: false }
];

export function MathTransformNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();
  const op = data.operation || 'cToF';
  const currentOp = OPERATIONS.find((o) => o.value === op);

  return (
    <NodeWrapper
      id={id}
      title={data.label || 'Math Transform'}
      icon={Calculator}
      accentColor="#8b5cf6"
      selected={selected}
      pulsing={data.pulsing}
      badge={data.lastValue !== undefined ? `${data.lastValue}` : null}
    >
      <div className="nf-field">
        <label>Operation</label>
        <select
          className="nodrag"
          value={op}
          onChange={(e) => updateNodeData(id, { operation: e.target.value })}
        >
          {OPERATIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {currentOp?.needsOperand && (
        <div className="nf-field">
          <label>Operand</label>
          <input
            className="nodrag mono"
            type="number"
            step="any"
            value={data.operand ?? 1}
            onChange={(e) => updateNodeData(id, { operand: Number(e.target.value) })}
          />
        </div>
      )}
    </NodeWrapper>
  );
}
