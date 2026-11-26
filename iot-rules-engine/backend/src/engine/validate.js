const { OPERATORS, AGGREGATES, isLeaf } = require('./evaluator');

const SEVERITIES = ['info', 'warning', 'critical'];
const TARGETS = ['all', 'device', 'deviceType'];
const ACTIONS = ['webhook', 'command'];
const METRIC_RE = /^[A-Za-z0-9_]{1,64}$/;
const MAX_DEPTH = 5;
const MAX_LEAVES = 25;

function validateCondition(node, errors, state = { depth: 0, leaves: 0 }, path = 'condition') {
  if (!node || typeof node !== 'object') return errors.push(`${path}: must be an object`);
  if (state.depth > MAX_DEPTH) return errors.push(`${path}: nesting deeper than ${MAX_DEPTH}`);

  const group = ['all', 'any'].find((k) => k in node);
  if (group) {
    if (!Array.isArray(node[group]) || node[group].length === 0) {
      return errors.push(`${path}.${group}: needs at least one condition`);
    }
    node[group].forEach((c, i) =>
      validateCondition(c, errors, { depth: state.depth + 1, leaves: state.leaves }, `${path}.${group}[${i}]`)
    );
    return undefined;
  }
  if ('not' in node) return validateCondition(node.not, errors, { depth: state.depth + 1, leaves: state.leaves }, `${path}.not`);

  if (!isLeaf(node)) return errors.push(`${path}: expected all/any/not or a metric condition`);
  if (!METRIC_RE.test(String(node.metric))) errors.push(`${path}.metric: letters, digits, underscore only`);
  if (!OPERATORS[node.operator]) errors.push(`${path}.operator: must be one of ${Object.keys(OPERATORS).join(' ')}`);
  if (node.agg && !AGGREGATES.includes(node.agg)) errors.push(`${path}.agg: must be one of ${AGGREGATES.join(', ')}`);
  if (node.agg && node.agg !== 'last' && !(Number(node.windowSeconds) > 0)) {
    errors.push(`${path}.windowSeconds: required (> 0) when agg is ${node.agg}`);
  }
  if (node.operator === 'between') {
    if (!Array.isArray(node.value) || node.value.length !== 2 || node.value.some((x) => typeof x !== 'number')) {
      errors.push(`${path}.value: between needs [min, max]`);
    }
  } else if (node.operator === 'in') {
    if (!Array.isArray(node.value) || node.value.length === 0) errors.push(`${path}.value: in needs a non-empty list`);
  } else if (node.value === undefined || node.value === null || node.value === '') {
    errors.push(`${path}.value: required`);
  }
  return undefined;
}

function countLeaves(node) {
  if (!node || typeof node !== 'object') return 0;
  if (isLeaf(node)) return 1;
  const kids = node.all || node.any || (node.not ? [node.not] : []);
  return kids.reduce((n, c) => n + countLeaves(c), 0);
}

/** Returns { errors: string[], value: cleaned rule } */
function validateRule(body) {
  const errors = [];
  const b = body || {};
  if (!b.name || typeof b.name !== 'string' || !b.name.trim()) errors.push('name: required');
  if (b.severity && !SEVERITIES.includes(b.severity)) errors.push(`severity: one of ${SEVERITIES.join(', ')}`);

  const target = b.target || { type: 'all', value: '' };
  if (!TARGETS.includes(target.type)) errors.push(`target.type: one of ${TARGETS.join(', ')}`);
  if (target.type !== 'all' && !String(target.value || '').trim()) errors.push('target.value: required for this target type');

  validateCondition(b.condition, errors);
  if (errors.length === 0 && countLeaves(b.condition) > MAX_LEAVES) errors.push(`condition: more than ${MAX_LEAVES} conditions`);

  for (const k of ['durationSeconds', 'cooldownSeconds']) {
    if (b[k] !== undefined && !(Number(b[k]) >= 0)) errors.push(`${k}: must be >= 0`);
  }

  const actions = Array.isArray(b.actions) ? b.actions : [];
  actions.forEach((a, i) => {
    if (!a || !ACTIONS.includes(a.type)) return errors.push(`actions[${i}].type: one of ${ACTIONS.join(', ')}`);
    if (a.type === 'webhook') {
      try {
        const u = new URL(a.url);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error('proto');
      } catch {
        errors.push(`actions[${i}].url: must be a valid http(s) URL`);
      }
    }
    if (a.type === 'command' && !String(a.name || '').trim()) errors.push(`actions[${i}].name: required`);
    return undefined;
  });

  const value = {
    name: (b.name || '').trim(),
    description: b.description || '',
    enabled: b.enabled !== false,
    severity: b.severity || 'warning',
    target: { type: target.type, value: target.type === 'all' ? '' : String(target.value || '').trim() },
    condition: b.condition,
    durationSeconds: Number(b.durationSeconds) || 0,
    cooldownSeconds: Number(b.cooldownSeconds) || 0,
    actions: actions.map((a) =>
      a.type === 'webhook'
        ? { type: 'webhook', url: a.url }
        : { type: 'command', name: a.name, params: a.params && typeof a.params === 'object' ? a.params : {} }
    ),
    message: b.message || '',
  };
  return { errors, value };
}

module.exports = { validateRule, validateCondition };
