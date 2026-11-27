import { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Code2 } from 'lucide-react';
import { api } from '../api/client';

export function GraphInspector({ open, onClose, ruleName, nodes, edges }) {
  const [compileResult, setCompileResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const serializedGraph = {
    name: ruleName,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { ...n.data, pulsing: undefined, lastValue: undefined }
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type || 'glowing'
    }))
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .previewCompile({ nodes: serializedGraph.nodes, edges: serializedGraph.edges })
      .then((res) => setCompileResult(res))
      .catch((err) => setCompileResult({ valid: false, error: err.message }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(4, 7, 13, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <div
        style={{
          width: 'min(920px, 95vw)',
          maxHeight: '85vh',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
            <Code2 size={16} color="var(--accent-cyan)" />
            Graph Serialization &amp; RxJS Compiler Verification
          </div>
          <button type="button" className="nf-btn" onClick={onClose}>
            <X size={14} /> Close
          </button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: compileResult?.valid
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(244, 63, 94, 0.12)',
              border: `1px solid ${
                compileResult?.valid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'
              }`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10
            }}
          >
            {compileResult?.valid ? (
              <CheckCircle2 size={18} color="#34d399" style={{ flexShrink: 0, marginTop: 2 }} />
            ) : (
              <AlertTriangle size={18} color="#fb7185" style={{ flexShrink: 0, marginTop: 2 }} />
            )}
            <div style={{ fontSize: 12 }}>
              {loading ? (
                <span>Validating graph against backend RxJS compiler...</span>
              ) : compileResult?.valid ? (
                <div>
                  <strong>Valid RxJS DAG Plan:</strong> Topological execution order{' '}
                  <span className="mono" style={{ color: '#67e8f9' }}>
                    {compileResult.topoOrder?.join(' → ')}
                  </span>
                </div>
              ) : (
                <div>
                  <strong>Validation Error:</strong> {compileResult?.error || 'Unknown error'}
                </div>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              SERIALIZED REACT FLOW JSON PAYLOAD
            </div>
            <pre
              className="mono"
              style={{
                margin: 0,
                padding: 14,
                borderRadius: 8,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                fontSize: 11,
                color: '#a5f3fc',
                overflowX: 'auto',
                maxHeight: '48vh'
              }}
            >
              {JSON.stringify(serializedGraph, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
