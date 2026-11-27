import { NODE_LIBRARY, PIPELINE_PRESETS } from '../data/presets';
import { Sparkles, Plus } from 'lucide-react';

export function NodePalette({ onAddNode, onLoadPreset }) {
  const handleDragStart = (event, item) => {
    event.dataTransfer.setData('application/nexusflow-node', JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}
    >
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
          NODE LIBRARY
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
          Drag onto canvas or click + to add
        </div>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {NODE_LIBRARY.map((group) => (
          <div key={group.category} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: group.accent
              }}
            >
              {group.category}
            </div>

            {group.items.map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: `3px solid ${group.accent}`,
                  borderRadius: 8,
                  padding: '8px 10px',
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {item.description}
                  </div>
                </div>
                <button
                  type="button"
                  title="Add node to canvas"
                  onClick={() => onAddNode(item)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-secondary)',
                    borderRadius: 6,
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <Plus size={13} />
                </button>
              </div>
            ))}
          </div>
        ))}

        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--accent-amber)'
            }}
          >
            <Sparkles size={13} />
            Starter Templates
          </div>

          {PIPELINE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onLoadPreset(preset)}
              style={{
                textAlign: 'left',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 8,
                padding: '8px 10px',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>{preset.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
