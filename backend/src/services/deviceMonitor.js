const Device = require('../models/Device');
const config = require('../config');

/** Marks silent devices offline so the dashboard reflects reality. */
function startDeviceMonitor(io) {
  return setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - config.offlineAfterSeconds * 1000);
      const stale = await Device.find({ status: 'online', lastSeen: { $lt: cutoff } }, 'deviceId').lean();
      if (stale.length === 0) return;
      await Device.updateMany({ deviceId: { $in: stale.map((d) => d.deviceId) } }, { $set: { status: 'offline' } });
      for (const d of stale) io.emit('device:status', { deviceId: d.deviceId, status: 'offline' });
    } catch (err) {
      console.error('[monitor]', err.message);
    }
  }, 10_000);
}

module.exports = { startDeviceMonitor };
