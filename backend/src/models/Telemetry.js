const mongoose = require('mongoose');
const config = require('../config');

/**
 * MongoDB native time-series collection.
 *  - timeField : ts
 *  - metaField : meta  (deviceId + type) -> buckets are grouped per device
 *  - TTL       : raw points auto-expire after TELEMETRY_RETENTION_DAYS
 * Time-series collections compress and cluster data by (meta, time), which makes
 * high-frequency inserts and "last N minutes for device X" queries cheap.
 */
const schema = new mongoose.Schema(
  {
    ts: { type: Date, required: true },
    meta: {
      deviceId: { type: String, required: true },
      type: { type: String, default: 'generic' },
    },
    metrics: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    versionKey: false,
    timeseries: { timeField: 'ts', metaField: 'meta', granularity: 'seconds' },
    expireAfterSeconds: config.retentionDays * 24 * 3600,
    autoCreate: false,
    autoIndex: false,
  }
);

module.exports = mongoose.models.Telemetry || mongoose.model('Telemetry', schema, 'telemetry');
