/**
 * In-memory sliding windows per (device, metric). The rule engine evaluates
 * against this, so rules never need a database round-trip per reading.
 */
class WindowStore {
  constructor({ maxWindowMs = 60 * 60 * 1000, maxPoints = 20000 } = {}) {
    this.maxWindowMs = maxWindowMs;
    this.maxPoints = maxPoints;
    this.series = new Map();
  }

  _key(deviceId, metric) {
    return `${deviceId}\u0000${metric}`;
  }

  push(deviceId, metric, t, v) {
    const key = this._key(deviceId, metric);
    let s = this.series.get(key);
    if (!s) {
      s = [];
      this.series.set(key, s);
    }
    s.push({ t, v });
    const cutoff = t - this.maxWindowMs;
    let drop = 0;
    while (drop < s.length && s[drop].t < cutoff) drop++;
    if (drop > 0) s.splice(0, drop);
    if (s.length > this.maxPoints) s.splice(0, s.length - this.maxPoints);
  }

  /** agg: last | avg | min | max | sum | count */
  aggregate(deviceId, metric, agg, windowSeconds, now) {
    const s = this.series.get(this._key(deviceId, metric));
    if (!s || s.length === 0) return undefined;
    if (!agg || agg === 'last') return s[s.length - 1].v;

    const from = now - (windowSeconds || 0) * 1000;
    let count = 0, sum = 0, min = Infinity, max = -Infinity;
    for (let i = s.length - 1; i >= 0; i--) {
      const p = s[i];
      if (p.t < from) break;
      if (p.t > now) continue;
      count++;
      sum += p.v;
      if (p.v < min) min = p.v;
      if (p.v > max) max = p.v;
    }
    if (agg === 'count') return count;
    if (count === 0) return undefined;
    switch (agg) {
      case 'avg': return sum / count;
      case 'sum': return sum;
      case 'min': return min;
      case 'max': return max;
      default: return undefined;
    }
  }

  forgetDevice(deviceId) {
    const prefix = `${deviceId}\u0000`;
    for (const k of this.series.keys()) if (k.startsWith(prefix)) this.series.delete(k);
  }
}

module.exports = { WindowStore };
