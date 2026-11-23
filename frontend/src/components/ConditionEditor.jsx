import React from 'react';
import { AGGS, OPERATORS, newGroup, newLeaf } from '../lib.js';

export default function ConditionEditor({ node, onChange, onRemove, depth = 0 }) {
  if (node.not) {
    return (
      <div className="group not">
        <div className="group-head">
          <span>None of these can be true</span>
          {onRemove && <button type="button" className="link" onClick={onRemove}>Remove</button>}
        </div>
        <ConditionEditor node={node.not} onChange={(c) => onChange({ not: c })} depth={depth + 1} />
      </div>
    );
  }

  const kind = node.all ? 'all' : node.any ? 'any' : null;
  if (kind) {
    const kids = node[kind];
    const setKids = (next) => onChange({ [kind]: next });
    return (
      <div className={`group ${depth > 0 ? 'nested' : ''}`}>
        <div className="group-head">
          <span>
            Trigger when{' '}
            <select value={kind} onChange={(e) => onChange({ [e.target.value]: kids })} aria-label="Match mode">
              <option value="all">all</option>
              <option value="any">any</option>
            </select>{' '}
            of these are true
          </span>
          {onRemove && <button type="button" className="link" onClick={onRemove}>Remove group</button>}
        </div>
        {kids.map((k, i) => (
          <ConditionEditor
            key={i}
            node={k}
            depth={depth + 1}
            onChange={(c) => setKids(kids.map((x, j) => (j === i ? c : x)))}
            onRemove={kids.length > 1 ? () => setKids(kids.filter((_, j) => j !== i)) : undefined}
          />
        ))}
        <div className="group-add">
          <button type="button" className="btn small" onClick={() => setKids([...kids, newLeaf()])}>Add condition</button>
          {depth < 3 && <button type="button" className="btn small" onClick={() => setKids([...kids, newGroup()])}>Add group</button>}
        </div>
      </div>
    );
  }

  // leaf
  const set = (patch) => onChange({ ...node, ...patch });
  const hint = node.operator === 'between' ? 'min, max' : node.operator === 'in' ? 'a, b, c' : 'value';
  return (
    <div className="leaf">
      <select value={node.agg} onChange={(e) => set({ agg: e.target.value })} aria-label="Measure">
        {AGGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <span>of</span>
      <input list="metric-list" value={node.metric} onChange={(e) => set({ metric: e.target.value })} placeholder="metric" aria-label="Metric" className="mono" />
      {node.agg !== 'last' && (
        <>
          <span>over the last</span>
          <input type="number" min="1" value={node.windowSeconds} onChange={(e) => set({ windowSeconds: e.target.value })} className="num" aria-label="Window in seconds" />
          <span>seconds</span>
        </>
      )}
      <select value={node.operator} onChange={(e) => set({ operator: e.target.value })} aria-label="Comparison">
        {OPERATORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input value={node.raw} onChange={(e) => set({ raw: e.target.value })} placeholder={hint} aria-label="Value" className="mono val" />
      {onRemove && <button type="button" className="link" onClick={onRemove}>Remove</button>}
    </div>
  );
}
