const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const config = require('./config');
const Telemetry = require('./models/Telemetry');
const Rule = require('./models/Rule');
const Device = require('./models/Device');
const Alert = require('./models/Alert');
const { RuleEngine } = require('./engine/ruleEngine');
const { IngestService } = require('./services/ingest');
const { handleTrigger, handleResolved } = require('./services/actions');
const { startDeviceMonitor } = require('./services/deviceMonitor');
const { startMqtt } = require('./services/mqtt');
const { seedDefaultRules } = require('./seed');

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('[db] connected');

  // Create the time-series collection (idempotent).
  try {
    await Telemetry.createCollection();
    console.log('[db] telemetry time-series collection ready');
  } catch (err) {
    if (err.code !== 48 && !/already exists/i.test(err.message)) throw err;
  }

  if (config.seedDefaultRules) await seedDefaultRules();

  const app = express();
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '2mb' }));

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') } });

  const engine = new RuleEngine();
  const refreshRules = async () => {
    engine.setRules(await Rule.find({ enabled: true }).lean());
    console.log(`[engine] ${engine.rules.length} active rules loaded`);
  };
  await refreshRules();

  const ingest = new IngestService({
    engine,
    io,
    onTrigger: (t, latest) => handleTrigger(t, io, latest).catch((e) => console.error('[trigger]', e.message)),
    onResolved: (x) => handleResolved(x, io).catch((e) => console.error('[resolve]', e.message)),
  });
  ingest.start();
  startDeviceMonitor(io);
  startMqtt(ingest);

  app.get('/api/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));
  app.get('/api/stats', async (_req, res, next) => {
    try {
      const [devices, online, rules, openAlerts] = await Promise.all([
        Device.countDocuments(),
        Device.countDocuments({ status: 'online' }),
        Rule.countDocuments({ enabled: true }),
        Alert.countDocuments({ acknowledged: false }),
      ]);
      res.json({ devices, online, rules, openAlerts, ingestedTotal: ingest.total, ingestPerSecond: Math.round(ingest.rate * 10) / 10 });
    } catch (e) { next(e); }
  });
  app.use('/api/telemetry', require('./routes/telemetry')(ingest));
  app.use('/api/rules', require('./routes/rules')(engine, refreshRules));
  app.use('/api/alerts', require('./routes/alerts'));
  app.use('/api', require('./routes/devices'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[http]', err);
    res.status(500).json({ error: 'internal error' });
  });

  server.listen(config.port, () => console.log(`[http] API + WebSocket on :${config.port}`));

  const shutdown = async () => {
    console.log('shutting down...');
    await ingest.stop().catch(() => {});
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
