/**
 * Device fleet simulator.
 *   node src/simulator/simulate.js --devices 6 --rate 2 --api http://localhost:4000
 * Sends batched readings, occasionally injects faults, and obeys "cooling_on"
 * commands queued by rules — closing the loop sensor -> rule -> command -> sensor.
 */
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);
const API = args.api || process.env.API_URL || 'http://localhost:4000';
const COUNT = parseInt(args.devices || '6', 10);
const RATE = parseFloat(args.rate || '1'); // readings per second per device
const KEY = process.env.INGEST_API_KEY || '';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const devices = Array.from({ length: COUNT }, (_, i) => {
  const boiler = i % 3 !== 2;
  return {
    deviceId: `${boiler ? 'boiler' : 'sensor'}-${String(i + 1).padStart(2, '0')}`,
    type: boiler ? 'boiler' : 'sensor',
    temperature: rand(55, 68),
    pressure: rand(70, 90),
    vibration: rand(1, 3),
    humidity: rand(40, 55),
    battery: rand(30, 100),
    fault: null,
    coolingUntil: 0,
  };
});

function step(d, now) {
  if (!d.fault && Math.random() < 0.004) {
    d.fault = { kind: ['heat', 'vibration', 'pressure'][Math.floor(Math.random() * 3)], until: now + rand(15, 40) * 1000 };
    console.log(`[sim] ${d.deviceId} fault: ${d.fault.kind}`);
  }
  if (d.fault && now > d.fault.until) d.fault = null;

  const cooling = now < d.coolingUntil;
  const heat = d.fault?.kind === 'heat' ? 1.4 : 0;
  d.temperature = clamp(d.temperature + rand(-0.8, 0.8) + heat - (cooling ? 2.2 : 0) + (62 - d.temperature) * 0.02, 20, 120);
  d.vibration = clamp(d.vibration + rand(-0.4, 0.4) + (d.fault?.kind === 'vibration' ? 0.7 : 0) + (2 - d.vibration) * 0.05, 0, 15);
  d.pressure = clamp(d.pressure + rand(-1.5, 1.5) + (d.fault?.kind === 'pressure' ? 3 : 0) + (80 - d.pressure) * 0.04, 30, 160);
  d.humidity = clamp(d.humidity + rand(-0.5, 0.5), 10, 95);
  d.battery = clamp(d.battery - 0.02, 0, 100);

  const r = (n) => Math.round(n * 100) / 100;
  const metrics = d.type === 'boiler'
    ? { temperature: r(d.temperature), pressure: r(d.pressure), vibration: r(d.vibration) }
    : { temperature: r(d.temperature - 35), humidity: r(d.humidity), battery: r(d.battery) };
  return { deviceId: d.deviceId, type: d.type, ts: now, metrics };
}

async function send() {
  const now = Date.now();
  const batch = devices.map((d) => step(d, now));
  try {
    const res = await fetch(`${API}/api/telemetry`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(KEY ? { 'x-api-key': KEY } : {}) },
      body: JSON.stringify(batch),
    });
    if (!res.ok) console.warn('[sim] ingest status', res.status);
  } catch (e) {
    console.warn('[sim] cannot reach API:', e.message);
  }
}

async function pollCommands() {
  for (const d of devices) {
    try {
      const cmds = await (await fetch(`${API}/api/devices/${d.deviceId}/commands/pending`)).json();
      for (const c of cmds) {
        console.log(`[sim] ${d.deviceId} <- command ${c.name}`);
        if (c.name === 'cooling_on') d.coolingUntil = Date.now() + 30_000;
        await fetch(`${API}/api/commands/${c._id}/ack`, { method: 'POST' });
      }
    } catch { /* API not ready */ }
  }
}

console.log(`[sim] ${COUNT} devices @ ${RATE} Hz -> ${API}`);
setInterval(send, Math.max(100, 1000 / RATE));
setInterval(pollCommands, 3000);
