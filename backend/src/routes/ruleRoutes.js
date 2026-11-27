import { Router } from 'express';
import {
  listRules,
  getRuleById,
  createOrUpdateRule,
  deployRule,
  deactivateRule,
  deleteRule,
  previewCompileGraph
} from '../services/ruleManager.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const rules = await listRules();
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/compile-preview', (req, res) => {
  try {
    const { graph } = req.body || {};
    const plan = previewCompileGraph(graph);
    res.json(plan);
  } catch (err) {
    res.status(400).json({ valid: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rule = await getRuleById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found.' });
    }
    res.json({ rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { ruleId, name, description, graph, active = true } = req.body || {};
    const result = await createOrUpdateRule({ ruleId, name, description, graph, active });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, graph, active = true } = req.body || {};
    const result = await createOrUpdateRule({
      ruleId: req.params.id,
      name,
      description,
      graph,
      active
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/deploy', async (req, res) => {
  try {
    const result = await deployRule(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Rule not found.' });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    const result = await deactivateRule(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Rule not found.' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteRule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found.' });
    }
    res.json({ deleted: true, ruleId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
