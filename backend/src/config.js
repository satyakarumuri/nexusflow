require('dotenv').config();

const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

module.exports = {
  port: num(process.env.PORT, 4000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/iot_rules',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  ingestApiKey: process.env.INGEST_API_KEY || '',
  retentionDays: num(process.env.TELEMETRY_RETENTION_DAYS, 30),
  batchSize: num(process.env.INGEST_BATCH_SIZE, 500),
  flushMs: num(process.env.INGEST_FLUSH_MS, 500),
  offlineAfterSeconds: num(process.env.OFFLINE_AFTER_SECONDS, 30),
  mqttUrl: process.env.MQTT_URL || '',
  mqttTopic: process.env.MQTT_TOPIC || 'iot/telemetry',
  webhookAllowedHosts: (process.env.WEBHOOK_ALLOWED_HOSTS || '')
    .split(',').map((s) => s.trim()).filter(Boolean),
  seedDefaultRules: process.env.SEED_DEFAULT_RULES !== 'false',
};
