const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    name: String,
    type: { type: String, default: 'generic' },
    status: { type: String, enum: ['online', 'offline'], default: 'online' },
    lastSeen: Date,
    lastMetrics: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.models.Device || mongoose.model('Device', schema);
