const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rule', index: true },
    ruleName: String,
    deviceId: { type: String, index: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
    message: String,
    values: { type: mongoose.Schema.Types.Mixed, default: [] },
    ts: { type: Date, default: Date.now, index: true },
    resolvedAt: Date,
    acknowledged: { type: Boolean, default: false, index: true },
  },
  { versionKey: false }
);

module.exports = mongoose.models.Alert || mongoose.model('Alert', schema);
