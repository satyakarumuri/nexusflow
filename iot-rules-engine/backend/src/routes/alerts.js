const express = require('express');
const Alert = require('../models/Alert');
const { wrap, validId } = require('./util');

const router = express.Router();

router.get('/', wrap(async (req, res) => {
  const q = {};
  if (req.query.acknowledged !== undefined) q.acknowledged = req.query.acknowledged === 'true';
  if (req.query.deviceId) q.deviceId = String(req.query.deviceId);
  if (req.query.severity) q.severity = String(req.query.severity);
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  res.json(await Alert.find(q).sort({ ts: -1 }).limit(limit).lean());
}));

router.post('/ack-all', wrap(async (_req, res) => {
  const r = await Alert.updateMany({ acknowledged: false }, { acknowledged: true });
  res.json({ modified: r.modifiedCount });
}));

router.post('/:id/ack', validId, wrap(async (req, res) => {
  const a = await Alert.findByIdAndUpdate(req.params.id, { acknowledged: true }, { new: true }).lean();
  if (!a) return res.status(404).json({ error: 'not found' });
  return res.json(a);
}));

module.exports = router;
