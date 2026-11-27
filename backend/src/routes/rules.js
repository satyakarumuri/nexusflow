const express = require('express');
const Rule = require('../models/Rule');
const { validateRule } = require('../engine/validate');
const { RuleEngine } = require('../engine/ruleEngine');
const { wrap, validId } = require('./util');

module.exports = (engine, refreshRules) => {
  const router = express.Router();

  router.get('/', wrap(async (_req, res) => {
    res.json(await Rule.find().sort({ createdAt: -1 }).lean());
  }));

  router.post('/', wrap(async (req, res) => {
    const { errors, value } = validateRule(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const rule = await Rule.create(value);
    await refreshRules();
    return res.status(201).json(rule);
  }));

  // Dry-run: replay sample readings through a throw-away engine. Nothing is stored or sent.
  router.post('/test', (req, res) => {
    const { errors, value } = validateRule(req.body?.rule);
    if (errors.length) return res.status(400).json({ errors });
    const readings = Array.isArray(req.body?.readings) ? req.body.readings.slice(0, 2000) : [];
    const sandbox = new RuleEngine();
    sandbox.setRules([{ ...value, _id: 'test' }]);
    const base = Date.now();
    const events = [];
    for (const r of readings) {
      const out = sandbox.process({
        deviceId: String(r.deviceId || 'test-device'),
        type: String(r.type || 'generic'),
        ts: base + (Number(r.tOffsetSec) || 0) * 1000,
        metrics: r.metrics || {},
      });
      for (const t of out.triggered) events.push({ event: 'triggered', tOffsetSec: (t.ts - base) / 1000, values: t.values });
      for (const x of out.resolved) events.push({ event: 'resolved', tOffsetSec: (x.ts - base) / 1000 });
    }
    return res.json({ readings: readings.length, events });
  });

  router.put('/:id', validId, wrap(async (req, res) => {
    const { errors, value } = validateRule(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const rule = await Rule.findByIdAndUpdate(req.params.id, value, { new: true }).lean();
    if (!rule) return res.status(404).json({ error: 'not found' });
    await refreshRules();
    return res.json(rule);
  }));

  router.patch('/:id/toggle', validId, wrap(async (req, res) => {
    const rule = await Rule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'not found' });
    rule.enabled = !rule.enabled;
    await rule.save();
    await refreshRules();
    return res.json(rule);
  }));

  router.delete('/:id', validId, wrap(async (req, res) => {
    await Rule.findByIdAndDelete(req.params.id);
    await refreshRules();
    res.status(204).end();
  }));

  return router;
};
