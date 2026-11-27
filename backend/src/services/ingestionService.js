import { Subject } from 'rxjs';
import { getCollections } from '../config/db.js';
import { broadcast } from '../ws/wsServer.js';

export const telemetry$ = new Subject();

const BATCH_FLUSH_MS = Number.parseInt(process.env.BATCH_FLUSH_MS || '100', 10);
const BATCH_MAX_SIZE = Number.parseInt(process.env.BATCH_MAX_SIZE || '1000', 10);

let writeBuffer = [];
let flushTimer = null;
let isFlushing = false;

let totalIngested = 0;
let windowCount = 0;
let writesPerSec = 0;
let lastFlushLatencyMs = 0;
let rateTimer = null;

const lastWsEmitByDevice = new Map();

/**
 * Normalizes a raw telemetry payload into a MongoDB Time-Series document.
 */
export function normalizeTelemetryReading(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Telemetry payload must be an object.');
  }

  const deviceId = String(raw.deviceId || raw.meta?.deviceId || 'turbine-01');
  const deviceType = String(raw.deviceType || raw.meta?.deviceType || 'industrial-sensor');
  const location = String(raw.location || raw.meta?.location || 'zone-a');
  const timestamp = raw.timestamp ? new Date(raw.timestamp) : new Date();

  const metrics = { ...(raw.metrics || {}) };
  if (raw.metric && Number.isFinite(Number(raw.value))) {
    metrics[raw.metric] = Number(raw.value);
  }
  for (const key of ['temperature', 'vibration', 'pressure', 'rpm', 'power']) {
    if (raw[key] !== undefined && Number.isFinite(Number(raw[key]))) {
      metrics[key] = Number(raw[key]);
    }
  }

  if (Object.keys(metrics).length === 0) {
    throw new Error('Telemetry payload must contain at least one numeric metric.');
  }

  return {
    timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
    meta: {
      deviceId,
      deviceType,
      location
    },
    metrics
  };
}

/**
 * Starts background batch flushing and throughput rate tracking.
 */
export function startIngestionPipeline() {
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      flushBuffer().catch((err) => {
        console.error('[ingestionService] Flush error:', err.message);
      });
    }, BATCH_FLUSH_MS);
  }

  if (!rateTimer) {
    rateTimer = setInterval(() => {
      writesPerSec = windowCount;
      windowCount = 0;
    }, 1000);
  }
}

/**
 * Stops timers and flushes any remaining buffered telemetry documents.
 */
export async function stopIngestionPipeline() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  if (rateTimer) {
    clearInterval(rateTimer);
    rateTimer = null;
  }
  await flushBuffer();
}

/**
 * Flushes buffered telemetry documents to MongoDB Time-Series collection in bulk.
 */
export async function flushBuffer() {
  if (isFlushing || writeBuffer.length === 0) {
    return 0;
  }

  isFlushing = true;
  const batch = writeBuffer.splice(0, BATCH_MAX_SIZE);
  const start = performance.now();

  try {
    const { telemetry } = getCollections();
    await telemetry.insertMany(batch, { ordered: false });
    lastFlushLatencyMs = Number((performance.now() - start).toFixed(2));
    return batch.length;
  } finally {
    isFlushing = false;
    if (writeBuffer.length >= BATCH_MAX_SIZE) {
      queueMicrotask(() => {
        flushBuffer().catch((err) => console.error('[ingestionService] Chain flush error:', err.message));
      });
    }
  }
}

/**
 * Ingests a single reading or array of readings into RxJS live streams and the DB write buffer.
 */
export async function ingestTelemetry(payload, { syncFlush = false } = {}) {
  const items = Array.isArray(payload) ? payload : [payload];
  if (items.length === 0) {
    return { accepted: 0 };
  }

  const docs = items.map(normalizeTelemetryReading);

  for (const doc of docs) {
    writeBuffer.push(doc);
    totalIngested += 1;
    windowCount += 1;

    // Feed in-memory RxJS stream compiler immediately
    telemetry$.next(doc);

    // Throttle WebSocket chart updates per device (~10 Hz max per device)
    const now = Date.now();
    const prevEmit = lastWsEmitByDevice.get(doc.meta.deviceId) || 0;
    if (now - prevEmit >= 100) {
      lastWsEmitByDevice.set(doc.meta.deviceId, now);
      broadcast('telemetry', {
        deviceId: doc.meta.deviceId,
        deviceType: doc.meta.deviceType,
        timestamp: doc.timestamp.toISOString(),
        metrics: doc.metrics
      });
    }
  }

  if (syncFlush || writeBuffer.length >= BATCH_MAX_SIZE) {
    await flushBuffer();
  }

  return { accepted: docs.length };
}

/**
 * Returns real-time ingestion throughput & buffer metrics.
 */
export function getIngestionMetrics() {
  return {
    writesPerSec,
    totalIngested,
    bufferDepth: writeBuffer.length,
    lastFlushLatencyMs
  };
}
