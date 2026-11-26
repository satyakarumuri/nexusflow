export const OPERATORS = [
  ['>', 'is above'],
  ['>=', 'is at least'],
  ['<', 'is below'],
  ['<=', 'is at most'],
  ['==', 'equals'],
  ['!=', 'does not equal'],
  ['between', 'is between'],
  ['in', 'is one of'],
];
export const AGGS = [
  ['last', 'latest value'],
  ['avg', 'average'],
  ['min', 'minimum'],
  ['max', 'maximum'],
  ['sum', 'sum'],
  ['count', 'number of readings'],
];

export const newLeaf = () => ({ metric: 'temperature', agg: 'last', windowSeconds: 30, operator: '>', raw: '80' });
export const newGroup = () => ({ all: [newLeaf()] });

const toVal = (s) => {
  const t = String(s).trim();
  return t !== '' && Number.isFinite(Number(t)) ? Number(t) : t;
};

/** API condition -> editable condition (adds a `raw` text field per leaf). */
export function hydrate(n) {
  if (n.all) return { all: n.all.map(hydrate) };
  if (n.any) return { any: n.any.map(hydrate) };
  if (n.not) return { not: hydrate(n.not) };
  return {
    metric: n.metric,
    agg: n.agg || 'last',
    windowSeconds: n.windowSeconds || 30,
    operator: n.operator,
    raw: Array.isArray(n.value) ? n.value.join(', ') : String(n.value ?? ''),
  };
}

/** Editable condition -> API condition. */
export function dehydrate(n) {
  if (n.all) return { all: n.all.map(dehydrate) };
  if (n.any) return { any: n.any.map(dehydrate) };
  if (n.not) return { not: dehydrate(n.not) };
  let value;
  if (n.operator === 'between') value = String(n.raw).split(',').map((x) => Number(x.trim()));
  else if (n.operator === 'in') value = String(n.raw).split(',').map(toVal).filter((x) => x !== '');
  else value = toVal(n.raw);
  const leaf = { metric: n.metric.trim(), operator: n.operator, value };
  if (n.agg && n.agg !== 'last') {
    leaf.agg = n.agg;
    leaf.windowSeconds = Number(n.windowSeconds) || 0;
  }
  return leaf;
}

export function metricsIn(n, out = new Set()) {
  if (n.all || n.any) (n.all || n.any).forEach((c) => metricsIn(c, out));
  else if (n.not) metricsIn(n.not, out);
  else if (n.metric) out.add(n.metric);
  return out;
}

const opText = (op) => (OPERATORS.find((o) => o[0] === op) || [op, op])[1];

export function describe(n) {
  if (n.all) return n.all.map((c) => (c.all || c.any ? `(${describe(c)})` : describe(c))).join(' and ');
  if (n.any) return n.any.map((c) => (c.all || c.any ? `(${describe(c)})` : describe(c))).join(' or ');
  if (n.not) return `not (${describe(n.not)})`;
  const subject = n.agg && n.agg !== 'last' ? `${n.agg} of ${n.metric} over ${n.windowSeconds}s` : n.metric;
  const val = Array.isArray(n.value) ? (n.operator === 'between' ? n.value.join(' and ') : n.value.join(', ')) : n.value;
  return `${subject} ${opText(n.operator)} ${val}`;
}

export const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const fmtDateTime = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const ago = (t) => {
  if (!t) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};
