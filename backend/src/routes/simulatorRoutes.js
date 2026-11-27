import { Router } from 'express';
import {
  startInProcessSimulator,
  stopInProcessSimulator,
  injectAnomalySpike,
  getSimulatorStatus
} from '../simulator/telemetrySimulator.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json(getSimulatorStatus());
});

router.post('/start', (req, res) => {
  const { intervalMs } = req.body || {};
  res.json(startInProcessSimulator({ intervalMs }));
});

router.post('/stop', (req, res) => {
  res.json(stopInProcessSimulator());
});

router.post('/spike', (req, res) => {
  const { deviceId, metric, value, durationMs } = req.body || {};
  const spike = injectAnomalySpike({ deviceId, metric, value, durationMs });
  res.json({ spike, status: getSimulatorStatus() });
});

export default router;
