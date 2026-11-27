const Telemetry = require('../models/Telemetry');
const Device = require('../models/Device');
const config = require('../config');

/**
 * High-frequency ingestion pipeline:
 *   normalize -> (1) buffer for batched time-series insert
 *             -> (2) update device cache (flushed with one bulkWrite)
 *             -> (3) run rule engine in memory
 *             -> (4) broadcast live over Socket.IO
 * The HTTP/MQTT handler returns immediately; Mongo writes never block the stream.
 */
class IngestService {
  constructor({ engine, io, onTrigger, onResolved }) {
    this.engine = engine;
    this.io = io;
    this.onTrigger = onTrigger;
    this.onResolved = onResolved;
    this.buffer = [];
    this.devices = new Map();
    this.total = 0;
    this.windowCount = 0;
    this.rate = 0;
    this.flushing = false;
  }

  start() {
    this.flushTimer = setInterval(() => this.flush().catch((e) => console.error('[ingest] flush', e.message)), config.flushMs);
    this.deviceTimer = setInterval(() => this.flushDevices().catch((e) => console.error('[ingest] devices', e.message)), 2000);
    this.rateTimer = setInterval(() => {
      this.rate = this.windowCount / 5;
      this.windowCount = 0;
    }, 5000);
  }

  async stop() {
    clearInterval(this.flushTimer);
    clearInterval(this.deviceTimer);
    clearInterval(this.rateTimer);
    await this.flush();
    await this.flushDevices();
  }

  static normalize(raw, now = Date.now()) {
    if (!raw || typeof raw !== 'object') return null;
    const deviceId = String(raw.deviceId || '').trim();
    if (!deviceId || deviceId.length > 128) return null;
    const metrics = {};
    for (const [k, v] of Object.entries(raw.metrics || {})) {
      if (!/^[A-Za-z0-9_]{1,64}$/.test(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v)) metrics[k] = v;
      else if (typeof v === 'boolean') metrics[k] = v ? 1 : 0;
    }
    if (Object.keys(metrics).length === 0) return null;
    let ts = raw.ts === undefined ? now : typeof raw.ts === 'number' ? raw.ts : Date.parse(raw.ts);
    if (!Number.isFinite(ts)) ts = now;
    return { deviceId, type: String(raw.type || 'generic').slice(0, 64), ts, metrics };
  }

  ingest(rawList) {
    let accepted = 0;
    for (const raw of rawList) {
      const r = IngestService.normalize(raw);
      if (!r) continue;
      accepted++;
      this.buffer.push({ ts: new Date(r.ts), meta: { deviceId: r.deviceId, type: r.type }, metrics: r.metrics });
      this.devices.set(r.deviceId, { type: r.type, lastSeen: new Date(r.ts), metrics: { ...(this.devices.get(r.deviceId)?.metrics || {}), ...r.metrics } });

      const { triggered, resolved } = this.engine.process(r);
      const latest = this.devices.get(r.deviceId).metrics;
      for (const t of triggered) this.onTrigger(t, latest);
      for (const x of resolved) this.onResolved(x);

      this.io.emit('telemetry', { deviceId: r.deviceId, type: r.type, ts: r.ts, metrics: r.metrics });
    }
    this.total += accepted;
    this.windowCount += accepted;
    if (this.buffer.length >= config.batchSize) this.flush().catch((e) => console.error('[ingest] flush', e.message));
    return accepted;
  }

  async flush() {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    const batch = this.buffer;
    this.buffer = [];
    try {
      await Telemetry.collection.insertMany(batch, { ordered: false });
    } catch (err) {
      console.error(`[ingest] insertMany failed (${batch.length} docs):`, err.message);
    } finally {
      this.flushing = false;
    }
  }

  async flushDevices() {
    if (this.devices.size === 0) return;
    const snapshot = [...this.devices.entries()];
    this.devices.clear();
    const ops = snapshot.map(([deviceId, d]) => {
      const set = { type: d.type, status: 'online', lastSeen: d.lastSeen };
      for (const [k, v] of Object.entries(d.metrics)) set[`lastMetrics.${k}`] = v;
      return { updateOne: { filter: { deviceId }, update: { $set: set, $setOnInsert: { name: deviceId } }, upsert: true } };
    });
    await Device.bulkWrite(ops, { ordered: false });
  }
}

module.exports = { IngestService };
