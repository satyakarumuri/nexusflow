const mongoose = require('mongoose');

/**
 * A rule is DATA, not code. `condition` is a JSON tree:
 *   { all: [ <node>, ... ] } | { any: [ <node>, ... ] } | { not: <node> }
 *   leaf: { metric, operator, value, agg?, windowSeconds? }
 * Changing business logic = editing a document. No redeploy.
 */
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
    target: {
      type: { type: String, enum: ['all', 'device', 'deviceType'], default: 'all' },
      value: { type: String, default: '' },
    },
    condition: { type: mongoose.Schema.Types.Mixed, required: true },
    durationSeconds: { type: Number, default: 0, min: 0 },
    cooldownSeconds: { type: Number, default: 0, min: 0 },
    actions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    message: { type: String, default: '' },
    triggerCount: { type: Number, default: 0 },
    lastTriggeredAt: Date,
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.models.Rule || mongoose.model('Rule', schema);
