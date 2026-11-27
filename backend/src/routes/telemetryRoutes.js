import { Router } from 'express';
import { getCollections, getTimeSeriesStats } from '../config/db.js';
import { ingestTelemetry, getIngestionMetrics } from '../services/ingestionService.js';
import { getActivePipelineCount } from '../services/ruleManager.js';
import { getConnectedClientCount } from '../ws/wsServer.js';

const router = Router();

/**
 * POST /api/telemetry
 * Accepts either a single telemetry object or { readings: [...] } batch for high-speed ingestion.
 */
router.post('/', async (req, res) => {
  try {
    const payload = Array.isArray(req.body?.readings)
      ? req.body.readings
      : Array.isArray(req.body)
      ? req.body
      : req.body;

    const result = await ingestTelemetry(payload);
    res.status(202).json({
      status: 'accepted',
      ...result
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/telemetry/recent?deviceId=turbine-01&limit=100
 * Queries recent telemetry readings from the MongoDB Time-Series collection.
 */
router.get('/recent', async (req, res) => {
  try {
    const { deviceId, limit = '100', from, to } = req.query;
    const parsedLimit = Math.max(1, Math.min(2000, Number.parseInt(limit, 10) || 100));

    const query = {};
    if (deviceId && deviceId !== 'all' && deviceId !== '*') {
      query['meta.deviceId'] = deviceId;
    }
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const { telemetry } = getCollections();
    const docs = await telemetry
      .find(query)
      .sort({ timestamp: -1 })
      .limit(parsedLimit)
      .toArray();

    // Return chronological order for time-series charts
    docs.reverse();
    res.json({
      count: docs.length,
      readings: docs.map((d) => ({
        deviceId: d.meta?.deviceId,
        deviceType: d.meta?.deviceType,
        timestamp: d.timestamp,
        metrics: d.metrics
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/telemetry/stats
 * Returns live throughput metrics alongside MongoDB Time-Series storage statistics.
 */
router.get('/stats', async (req, res) => {
  try {
    const [storage, ingestion] = await Promise.all([
      getTimeSeriesStats(),
      Promise.resolve(getIngestionMetrics())
    ]);

    res.json({
      ingestion,
      storage,
      runtime: {
        activePipelines: getActivePipelineCount(),
        wsClients: getConnectedClientCount()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
