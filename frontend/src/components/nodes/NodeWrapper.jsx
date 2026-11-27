import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

/**
 * Shared frame for NexusFlow visual pipeline nodes with typed input/output handles.
 */
export function NodeWrapper({
  id,
  title,
  icon: Icon,
  accentColor = '#22d3ee',
  selected,
  pulsing,
  hasInput = true,
  hasOutput = true,
  badge,
  children
}) {
  const { deleteElements } = useReactFlow();

  return (
    <div
      className={`nf-node ${selected ? 'selected' : ''} ${pulsing ? 'pulsing' : ''}`}
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      {hasInput && <Handle type="target" position={Position.Left} />}

      <div className="nf-node-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: accentColor }}>
          {Icon && <Icon size={14} />}
          <span style={{ color: 'var(--text-primary)' }}>{title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {badge && (
            <span
              className="mono"
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 999,
                background: 'rgba(34, 211, 238, 0.14)',
                color: '#67e8f9',
                border: '1px solid rgba(34, 211, 238, 0.35)'
              }}
            >
              {badge}
            </span>
          )}
          <button
            type="button"
            className="nodrag"
            title="Remove node"
            onClick={() => deleteElements({ nodes: [{ id }] })}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="nf-node-body">{children}</div>

      {hasOutput && <Handle type="source" position={Position.Right} />}
    </div>
  );
}
