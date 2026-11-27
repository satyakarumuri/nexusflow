import { ingestTelemetry } from '../services/ingestionService.js';

const DEVICES = [
  {
    deviceId: 'turbine-01',
    deviceType: 'steam-turbine',
    location: 'floor-a',
    baselines: { temperature: 65, vibration: 2.1, pressure: 105, rpm: 1500, power: 420 }
  },
  {
    deviceId: 'compressor-02',
    deviceType: 'air-compressor',
    location: 'floor-a',
    baselines: { temperature: 58, vibration: 1.6, pressure: 140, rpm: 1200, power: 210 }
  },
  {
    deviceId: 'cnc-mill-03',
    deviceType: 'cnc-spindle',
    location: 'floor-b',
    baselines: { temperature: 48, vibration: 0.9, pressure: 98, rpm: 3200, power: 135 }
  },
  {
    deviceId: 'boiler-04',
    deviceType: 'thermal-boiler',
    location: 'floor-c',
    baselines: { temperature: 74, vibration: 1.2, pressure: 165, rpm: 900, power: 610 }
  }
];

let simInterval = null;
let tickCounter = 0;
const activeSpikes = new Map();

function jitter(amplitude) {
  return (Math.random() - 0.5) * 2 * amplitude;
}

/**
 * Builds a single simulated telemetry sample for a device, applying any active anomaly spike.
 */
export function generateDeviceReading(device, step) {
  const now = Date.now();
  const wave = Math.sin(step / 8);
  const metrics = {
    temperature: Number((device.baselines.temperature + wave * 2.5 + jitter(1.2)).toFixed(2)),
    vibration: Number(Math.max(0.1, device.baselines.vibration + wave * 0.25 + jitter(0.18)).toFixed(2)),
    pressure: Number((device.baselines.pressure + wave * 1.8 + jitter(0.9)).toFixed(2)),
    rpm: Math.round(device.baselines.rpm + wave * 18 + jitter(10)),
    power: Number((device.baselines.power + wave * 12 + jitter(6)).toFixed(1))
  };

  const spikeKey = device.deviceId;
  const spike = activeSpikes.get(spikeKey);
  if (spike) {
    if (now > spike.expiresAt) {
      activeSpikes.delete(spikeKey);
    } else {
      metrics[spike.metric] = Number((spike.value + jitter(1.5)).toFixed(2));
    }
  }

  return {
    deviceId: device.deviceId,
    deviceType: device.deviceType,
    location: device.location,
    timestamp: new Date(now).toISOString(),
    metrics
  };
}

/**
 * Starts the in-process hardware telemetry simulator feeding ingestionService directly.
 */
export function startInProcessSimulator({ intervalMs = 500 } = {}) {
  if (simInterval) {
    return getSimulatorStatus();
  }

  const safeInterval = Math.max(50, Math.min(5000, Number(intervalMs) || 500));
  simInterval = setInterval(() => {
    tickCounter += 1;
    const batch = DEVICES.map((d) => generateDeviceReading(d, tickCounter));
    ingestTelemetry(batch).catch((err) => {
      console.error('[simulator] Ingestion error:', err.message);
    });
  }, safeInterval);

  return getSimulatorStatus();
}

/**
 * Stops the in-process hardware telemetry simulator.
 */
export function stopInProcessSimulator() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
  return getSimulatorStatus();
}

/**
 * Injects a temporary anomaly spike for a device metric (e.g. turbine-01 temperature = 92°C).
 */
export function injectAnomalySpike({
  deviceId = 'turbine-01',
  metric = 'temperature',
  value = 92,
  durationMs = 8000
} = {}) {
  const expiresAt = Date.now() + Math.max(1000, Number(durationMs) || 8000);
  activeSpikes.set(deviceId, {
    metric,
    value: Number(value),
    expiresAt
  });
  return {
    deviceId,
    metric,
    value: Number(value),
    expiresAt: new Date(expiresAt).toISOString()
  };
}

export function getSimulatorStatus() {
  return {
    running: Boolean(simInterval),
    devices: DEVICES.map((d) => d.deviceId),
    activeSpikes: Array.from(activeSpikes.entries()).map(([deviceId, s]) => ({
      deviceId,
      metric: s.metric,
      value: s.value,
      expiresAt: new Date(s.expiresAt).toISOString()
    }))
  };
}

// Standalone CLI execution (`npm run simulate`)
const isCli =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());

if (isCli) {
  const targetUrl = process.env.API_URL || 'http://127.0.0.1:4000/api/telemetry';
  const batchIntervalMs = Number.parseInt(process.env.SIM_INTERVAL_MS || '250', 10);
  console.log(`[NexusFlow Simulator] Streaming telemetry to ${targetUrl} every ${batchIntervalMs}ms...`);

  let step = 0;
  setInterval(async () => {
    step += 1;
    // Periodically inject an overheat spike on turbine-01 every ~40 ticks
    if (step % 40 === 20) {
      injectAnomalySpike({ deviceId: 'turbine-01', metric: 'temperature', value: 91, durationMs: 5000 });
      console.log('[NexusFlow Simulator] Injected overheat spike on turbine-01 (~91°C)');
    }

    const readings = DEVICES.map((d) => generateDeviceReading(d, step));
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readings })
      });
      if (!res.ok) {
        console.error(`[NexusFlow Simulator] HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('[NexusFlow Simulator] Connection error:', err.message);
    }
  }, batchIntervalMs);
}
