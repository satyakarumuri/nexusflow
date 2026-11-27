import { Router } from 'express';
import { getCollections } from '../config/db.js';

const router = Router();
const recentWebhookDeliveries = [];

router.get('/', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, Number.parseInt(req.query.limit || '50', 10) || 50));
    const { alerts } = getCollections();
    const docs = await alerts.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
    res.json({ alerts: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    const { alerts } = getCollections();
    const result = await alerts.deleteMany({});
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export const webhookRouter = Router();

/**
 * Built-in local webhook receiver so users can verify outbound Webhook Action nodes immediately.
 */
webhookRouter.post('/test-receiver', (req, res) => {
  const entry = {
    receivedAt: new Date().toISOString(),
    payload: req.body
  };
  recentWebhookDeliveries.unshift(entry);
  if (recentWebhookDeliveries.length > 50) {
    recentWebhookDeliveries.pop();
  }
  res.status(200).json({ ok: true, receivedAt: entry.receivedAt });
});

webhookRouter.get('/test-receiver', (req, res) => {
  res.json({ deliveries: recentWebhookDeliveries });
});

export default router;
