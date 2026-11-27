const mongoose = require('mongoose');

/** Downlink command queued by a rule action; devices poll and acknowledge. */
const schema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    ruleId: mongoose.Schema.Types.ObjectId,
    status: { type: String, enum: ['pending', 'done'], default: 'pending', index: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.models.Command || mongoose.model('Command', schema);
