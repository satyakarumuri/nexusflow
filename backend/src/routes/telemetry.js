const express = require('express');
const Telemetry = require('../models/Telemetry');
const Device = require('../models/Device');
const config = require('../config');
const { wrap } = require('./util');

module.exports = (ingest) => {
  const router = express.Router();

  const auth = (req, res, next) => {
    if (config.ingestApiKey && req.get('x-api-key') !== config.ingestApiKey) return res.status(401).json({ error: 'invalid api key' });
    return next();
  };

  // Single reading, array of readings, or { readings: [...] }. Max 1000 per call.
  router.post('/', auth, (req, res) => {
    const list = Array.isArray(req.body) ? req.body : Array.isArray(req.body?.readings) ? req.body.readings : [req.body];
    if (list.length > 1000) return res.status(413).json({ error: 'max 1000 readings per request' });
    const accepted = ingest.ingest(list);
    return res.status(202).json({ accepted, rejected: list.length - accepted });
  });

  // Downsampled series for charts: ?metric=temperature&from=ISO&to=ISO&points=120
  router.get('/:deviceId/series', wrap(async (req, res) => {
    const metric = String(req.query.metric || '');
    if (!/^[A-Za-z0-9_]{1,64}$/.test(metric)) return res.status(400).json({ error: 'metric required' });
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 15 * 60 * 1000);
    if (Number.isNaN(+from) || Number.isNaN(+to) || from >= to) return res.status(400).json({ error: 'bad time range' });
    const points = Math.min(Math.max(parseInt(req.query.points, 10) || 120, 10), 1000);
    const binMs = Math.max(1000, Math.ceil((to - from) / points / 1000) * 1000);

    const rows = await Telemetry.aggregate([
      { $match: { 'meta.deviceId': req.params.deviceId, ts: { $gte: from, $lte: to }, [`metrics.${metric}`]: { $exists: true } } },
      {
        $group: {
          _id: { $dateTrunc: { date: '$ts', unit: 'millisecond', binSize: binMs } },
          avg: { $avg: `$metrics.${metric}` },
          min: { $min: `$metrics.${metric}` },
          max: { $max: `$metrics.${metric}` },
          n: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, ts: '$_id', avg: 1, min: 1, max: 1, n: 1 } },
    ]);
    res.json({ deviceId: req.params.deviceId, metric, binMs, points: rows });
  }));

  router.get('/:deviceId/latest', wrap(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const rows = await Telemetry.find({ 'meta.deviceId': req.params.deviceId }).sort({ ts: -1 }).limit(limit).lean();
    res.json(rows);
  }));

  router.get('/:deviceId/metrics', wrap(async (req, res) => {
    const d = await Device.findOne({ deviceId: req.params.deviceId }, 'lastMetrics').lean();
    res.json(Object.keys(d?.lastMetrics || {}));
  }));

  return router;
};
