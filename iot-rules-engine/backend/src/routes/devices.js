const express = require('express');
const Device = require('../models/Device');
const Command = require('../models/Command');
const { wrap, validId } = require('./util');

const router = express.Router();

router.get('/devices', wrap(async (_req, res) => {
  res.json(await Device.find().sort({ deviceId: 1 }).lean());
}));

// Devices poll this to receive commands queued by rule actions.
router.get('/devices/:deviceId/commands/pending', wrap(async (req, res) => {
  res.json(await Command.find({ deviceId: req.params.deviceId, status: 'pending' }).sort({ createdAt: 1 }).limit(20).lean());
}));

router.post('/commands/:id/ack', validId, wrap(async (req, res) => {
  const c = await Command.findByIdAndUpdate(req.params.id, { status: 'done' }, { new: true }).lean();
  if (!c) return res.status(404).json({ error: 'not found' });
  return res.json(c);
}));

module.exports = router;
