const { evaluate } = require('./evaluator');
const { WindowStore } = require('./windowStore');

function matchesTarget(target, reading) {
  if (!target || target.type === 'all') return true;
  if (target.type === 'device') return reading.deviceId === target.value;
  if (target.type === 'deviceType') return reading.type === target.value;
  return false;
}

/**
 * Streaming rule engine.
 *   reading = { deviceId, type, ts(ms), metrics: { name: number } }
 * process(reading) -> { triggered: [...], resolved: [...] }
 *
 * Per (rule, device) it tracks:
 *   since      - when the condition became continuously true
 *   active     - an alert has fired for this episode
 *   lastFired  - for cooldown / re-notify
 */
class RuleEngine {
  constructor({ windows = new WindowStore() } = {}) {
    this.windows = windows;
    this.rules = [];
    this.state = new Map();
  }

  setRules(rules) {
    this.rules = (rules || []).filter((r) => r.enabled !== false);
    const live = new Set(this.rules.map((r) => String(r._id ?? r.id)));
    for (const key of this.state.keys()) {
      if (!live.has(key.split('|')[0])) this.state.delete(key);
    }
  }

  process(reading) {
    const { deviceId, ts } = reading;
    for (const [metric, v] of Object.entries(reading.metrics)) {
      if (typeof v === 'number' && Number.isFinite(v)) this.windows.push(deviceId, metric, ts, v);
    }

    const triggered = [];
    const resolved = [];

    for (const rule of this.rules) {
      if (!matchesTarget(rule.target, reading)) continue;
      const rid = String(rule._id ?? rule.id);
      const key = `${rid}|${deviceId}`;
      let st = this.state.get(key);
      if (!st) {
        st = { since: null, active: false, lastFired: -Infinity };
        this.state.set(key, st);
      }

      const { ok, trace } = evaluate(rule.condition, (leaf) =>
        this.windows.aggregate(deviceId, leaf.metric, leaf.agg, leaf.windowSeconds, ts)
      );

      if (ok) {
        if (st.since === null) st.since = ts;
        const held = ts - st.since;
        const durMs = (rule.durationSeconds || 0) * 1000;
        const cooldownMs = (rule.cooldownSeconds || 0) * 1000;
        if (held >= durMs) {
          const due = ts - st.lastFired >= cooldownMs;
          if (!st.active && due) {
            st.active = true;
            st.lastFired = ts;
            triggered.push({ rule, deviceId, ts, values: trace, renotify: false });
          } else if (st.active && cooldownMs > 0 && due) {
            st.lastFired = ts;
            triggered.push({ rule, deviceId, ts, values: trace, renotify: true });
          }
        }
      } else {
        if (st.active) resolved.push({ rule, deviceId, ts });
        st.since = null;
        st.active = false;
      }
    }
    return { triggered, resolved };
  }
}

module.exports = { RuleEngine, matchesTarget };
