const Alert = require('../models/Alert');
const Rule = require('../models/Rule');
const Command = require('../models/Command');
const config = require('../config');

function render(template, ctx) {
  return String(template).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => (ctx[k] !== undefined ? String(ctx[k]) : ''));
}

function defaultMessage(rule, trace) {
  const hit = trace.filter((t) => t.ok).map((t) => {
    const w = t.agg !== 'last' ? `${t.agg}(${t.metric}, ${t.windowSeconds}s)` : t.metric;
    const a = typeof t.actual === 'number' ? Math.round(t.actual * 100) / 100 : t.actual;
    return `${w} = ${a}`;
  });
  return hit.length ? hit.join(', ') : 'Condition met';
}

function webhookAllowed(url) {
  if (config.webhookAllowedHosts.length === 0) return true;
  try {
    return config.webhookAllowedHosts.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Every trigger creates an Alert, then runs the rule's extra actions. */
async function handleTrigger(trigger, io, latestMetrics = {}) {
  const { rule, deviceId, ts, values } = trigger;
  const ctx = { device: deviceId, rule: rule.name, severity: rule.severity, ...latestMetrics };
  const message = rule.message ? render(rule.message, ctx) : defaultMessage(rule, values);

  const alert = await Alert.create({
    ruleId: rule._id,
    ruleName: rule.name,
    deviceId,
    severity: rule.severity,
    message,
    values,
    ts: new Date(ts),
  });
  Rule.updateOne({ _id: rule._id }, { $inc: { triggerCount: 1 }, $set: { lastTriggeredAt: new Date(ts) } }).catch(() => {});
  io.emit('alert', alert.toObject());

  for (const action of rule.actions || []) {
    try {
      if (action.type === 'webhook') {
        if (!webhookAllowed(action.url)) {
          console.warn(`[actions] webhook host not allowed: ${action.url}`);
          continue;
        }
        await fetch(action.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ alertId: alert._id, rule: rule.name, severity: rule.severity, deviceId, message, values, ts }),
          signal: AbortSignal.timeout(5000),
        });
      } else if (action.type === 'command') {
        const cmd = await Command.create({ deviceId, name: action.name, params: action.params || {}, ruleId: rule._id });
        io.emit('command', cmd.toObject());
      }
    } catch (err) {
      console.error(`[actions] ${action.type} failed for rule "${rule.name}":`, err.message);
    }
  }
  return alert;
}

async function handleResolved(resolved, io) {
  const { rule, deviceId, ts } = resolved;
  await Alert.updateMany(
    { ruleId: rule._id, deviceId, resolvedAt: { $exists: false } },
    { $set: { resolvedAt: new Date(ts) } }
  );
  io.emit('alert:resolved', { ruleId: String(rule._id), deviceId, ts });
}

module.exports = { handleTrigger, handleResolved };
