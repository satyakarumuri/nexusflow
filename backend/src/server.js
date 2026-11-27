import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';

import { connectDb, closeDb, getTimeSeriesStats } from './config/db.js';
import { initWebSocketServer, broadcast, closeWebSocketServer, getConnectedClientCount } from './ws/wsServer.js';
import {
  startIngestionPipeline,
  stopIngestionPipeline,
  getIngestionMetrics
} from './services/ingestionService.js';
import {
  initRuleManager,
  disposeAllPipelines,
  getActivePipelineCount
} from './services/ruleManager.js';
import { stopInProcessSimulator } from './simulator/telemetrySimulator.js';

import telemetryRoutes from './routes/telemetryRoutes.js';
import ruleRoutes from './routes/ruleRoutes.js';
import alertRoutes, { webhookRouter } from './routes/alertRoutes.js';
import simulatorRoutes from './routes/simulatorRoutes.js';

const PORT = Number.parseInt(process.env.PORT || '4000', 10);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'nexusflow-backend',
    uptimeSec: Math.round(process.uptime())
  });
});

app.use('/api/telemetry', telemetryRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/webhooks', webhookRouter);
app.use('/api/simulator', simulatorRoutes);

const httpServer = http.createServer(app);
let statsTickTimer = null;

async function bootstrap() {
  await connectDb();
  initWebSocketServer(httpServer);
  startIngestionPipeline();
  await initRuleManager();

  statsTickTimer = setInterval(async () => {
    if (getConnectedClientCount() === 0) {
      return;
    }
    try {
      const storage = await getTimeSeriesStats();
      broadcast('stats', {
        ingestion: getIngestionMetrics(),
        storage,
        runtime: {
          activePipelines: getActivePipelineCount(),
          wsClients: getConnectedClientCount()
        }
      });
    } catch {
      // Ignore transient stats polling errors
    }
  }, 1500);

  httpServer.listen(PORT, () => {
    console.log(`[NexusFlow] Server listening on http://localhost:${PORT}`);
    console.log(`[NexusFlow] WebSocket stream ready at ws://localhost:${PORT}/ws`);
  });
}

async function shutdown(signal) {
  console.log(`\n[NexusFlow] Received ${signal}, shutting down gracefully...`);
  if (statsTickTimer) {
    clearInterval(statsTickTimer);
  }
  stopInProcessSimulator();
  disposeAllPipelines();
  await stopIngestionPipeline();
  await closeWebSocketServer();
  await new Promise((resolve) => httpServer.close(resolve));
  await closeDb();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap().catch((err) => {
  console.error('[NexusFlow] Startup failed:', err);
  process.exit(1);
});
