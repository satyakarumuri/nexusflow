import { db } from './db.js';

let timer = null;
const samples = [
  { deviceId: 'sensor-temp-01', metric: 'temperature', base: 31, spread: 17, unit: '°C' },
  { deviceId: 'sensor-hum-02', metric: 'humidity', base: 48, spread: 42, unit: '%' },
  { deviceId: 'sensor-air-03', metric: 'air_quality', base: 65, spread: 80, unit: 'AQI' }
];

export function startSimulator(ingest) {
  if (timer) return false;
  timer = setInterval(() => {
    for (const sample of samples) {
      const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(sample.deviceId);
      if (!device) continue;
      const value = Number((sample.base + Math.random() * sample.spread).toFixed(1));
      ingest({ deviceId: sample.deviceId, metric: sample.metric, value, unit: sample.unit });
    }
  }, 2500);
  return true;
}
export function stopSimulator() {
  if (!timer) return false;
  clearInterval(timer);
  timer = null;
  return true;
}
export function simulatorRunning() { return Boolean(timer); }
