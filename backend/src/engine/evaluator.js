/**
 * Pure, side-effect-free condition evaluator. Rules are interpreted from JSON;
 * nothing is ever eval()'d, so user-defined logic is safe to accept from the UI.
 */
const OPERATORS = {
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  between: (a, b) => Array.isArray(b) && a >= b[0] && a <= b[1],
  in: (a, b) => Array.isArray(b) && b.includes(a),
};

const AGGREGATES = ['last', 'avg', 'min', 'max', 'sum', 'count'];

function isLeaf(node) {
  return node && typeof node === 'object' && 'metric' in node;
}

/**
 * @param node  condition tree
 * @param resolve (leaf) => number|undefined   supplies the actual value
 * @returns {{ ok: boolean, trace: object[] }}  trace = every leaf's observed value
 */
function evaluate(node, resolve) {
  const trace = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return false;
    if (Array.isArray(n.all)) {
      const results = n.all.map(walk); // no short-circuit: we want a full trace
      return results.length > 0 && results.every(Boolean);
    }
    if (Array.isArray(n.any)) {
      const results = n.any.map(walk);
      return results.some(Boolean);
    }
    if (n.not) return !walk(n.not);
    if (isLeaf(n)) {
      const actual = resolve(n);
      const fn = OPERATORS[n.operator];
      const valid = actual !== undefined && actual !== null && !(typeof actual === 'number' && Number.isNaN(actual));
      const ok = valid && fn ? Boolean(fn(actual, n.value)) : false;
      trace.push({
        metric: n.metric,
        agg: n.agg || 'last',
        windowSeconds: n.windowSeconds || 0,
        operator: n.operator,
        expected: n.value,
        actual: valid ? actual : null,
        ok,
      });
      return ok;
    }
    return false;
  };
  const ok = walk(node);
  return { ok, trace };
}

module.exports = { evaluate, OPERATORS, AGGREGATES, isLeaf };
