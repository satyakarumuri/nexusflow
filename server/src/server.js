import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';
import { db, now } from './db.js';
import { evaluateRules } from './ruleEngine.js';
import { startSimulator, stopSimulator, simulatorRunning } from './simulator.js';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 4000);
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const io = new Server(server, { cors: { origin: allowedOrigin, methods: ['GET','POST','PATCH','DELETE'] } });

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '1mb' }));

const wrap = (fn) => (req,res,next) => { try { fn(req,res,next); } catch (err) { next(err); } };
const metricUnits = { temperature:'°C', humidity:'%', air_quality:'AQI' };

function ingestReading(input) {
  const { deviceId, metric } = input;
  const value = Number(input.value);
  if (!deviceId || !metric || !Number.isFinite(value)) throw new Error('deviceId, metric and numeric value are required');
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
  if (!device) throw new Error('Device not found');
  const unit = String(input.unit || metricUnits[metric] || '').slice(0,16);
  const recordedAt = now();
  const result = db.prepare('INSERT INTO telemetry (device_id,metric,value,unit,recorded_at) VALUES (?,?,?,?,?)')
    .run(deviceId, metric, value, unit, recordedAt);
  db.prepare("UPDATE devices SET status='online' WHERE id=?").run(deviceId);
  const reading = { id: Number(result.lastInsertRowid), deviceId, metric, value, unit, recordedAt };
  const alerts = evaluateRules(reading);
  io.emit('telemetry:new', reading);
  for (const alert of alerts) io.emit('alert:new', alert);
  return { reading, alerts };
}

app.get('/api/health', (req,res) => res.json({ status:'ok', service:'NexusFlow API', database:'SQLite', simulator:simulatorRunning() }));

app.get('/api/dashboard/summary', wrap((req,res) => {
  const devices = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='online' THEN 1 ELSE 0 END) AS online FROM devices").get();
  const readings = db.prepare('SELECT COUNT(*) AS total FROM telemetry').get();
  const alerts = db.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN acknowledged=0 THEN 1 ELSE 0 END) AS unacknowledged FROM alerts').get();
  const latest = db.prepare('SELECT recorded_at FROM telemetry ORDER BY id DESC LIMIT 1').get();
  res.json({ devices:devices.total, onlineDevices:devices.online || 0, readings:readings.total, alerts:alerts.total, activeAlerts:alerts.unacknowledged || 0, lastUpdate:latest?.recorded_at || null, simulator:simulatorRunning() });
}));

app.get('/api/devices', wrap((req,res) => {
  const rows = db.prepare(`
    SELECT d.*, (SELECT metric FROM telemetry t WHERE t.device_id=d.id ORDER BY t.id DESC LIMIT 1) AS latest_metric,
    (SELECT value FROM telemetry t WHERE t.device_id=d.id ORDER BY t.id DESC LIMIT 1) AS latest_value,
    (SELECT unit FROM telemetry t WHERE t.device_id=d.id ORDER BY t.id DESC LIMIT 1) AS latest_unit,
    (SELECT recorded_at FROM telemetry t WHERE t.device_id=d.id ORDER BY t.id DESC LIMIT 1) AS last_seen
    FROM devices d ORDER BY d.created_at DESC
  `).all();
  res.json(rows);
}));

app.post('/api/devices', wrap((req,res) => {
  const { name, type, location='' } = req.body;
  if (!name?.trim() || !type?.trim()) return res.status(400).json({ error:'Name and type are required' });
  const id = `device-${Date.now()}`;
  db.prepare('INSERT INTO devices (id,name,type,location,status,created_at) VALUES (?,?,?,?,?,?)')
    .run(id,name.trim(),type.trim(),String(location).trim(),'offline',now());
  const device = db.prepare('SELECT * FROM devices WHERE id=?').get(id);
  io.emit('device:changed', device);
  res.status(201).json(device);
}));

app.patch('/api/devices/:id', wrap((req,res) => {
  const current = db.prepare('SELECT * FROM devices WHERE id=?').get(req.params.id);
  if (!current) return res.status(404).json({ error:'Device not found' });
  const name = req.body.name ?? current.name;
  const location = req.body.location ?? current.location;
  const status = req.body.status ?? current.status;
  if (!['online','offline'].includes(status)) return res.status(400).json({ error:'Invalid status' });
  db.prepare('UPDATE devices SET name=?,location=?,status=? WHERE id=?').run(name,location,status,req.params.id);
  const updated = db.prepare('SELECT * FROM devices WHERE id=?').get(req.params.id);
  io.emit('device:changed', updated);
  res.json(updated);
}));

app.delete('/api/devices/:id', wrap((req,res) => {
  const result = db.prepare('DELETE FROM devices WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error:'Device not found' });
  io.emit('device:deleted', { id:req.params.id });
  res.status(204).end();
}));

app.get('/api/telemetry', wrap((req,res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100),1),1000);
  const deviceId = req.query.deviceId;
  const rows = deviceId
    ? db.prepare('SELECT id,device_id AS deviceId,metric,value,unit,recorded_at AS recordedAt FROM telemetry WHERE device_id=? ORDER BY id DESC LIMIT ?').all(deviceId,limit)
    : db.prepare('SELECT id,device_id AS deviceId,metric,value,unit,recorded_at AS recordedAt FROM telemetry ORDER BY id DESC LIMIT ?').all(limit);
  res.json(rows.reverse());
}));

app.post('/api/telemetry', wrap((req,res) => {
  try { res.status(201).json(ingestReading(req.body)); }
  catch (err) { res.status(400).json({ error:err.message }); }
}));

app.get('/api/rules', wrap((req,res) => res.json(db.prepare('SELECT * FROM rules ORDER BY id DESC').all().map(r => ({...r,enabled:Boolean(r.enabled)})))));

app.post('/api/rules', wrap((req,res) => {
  const { name,metric,operator,threshold,severity='warning' } = req.body;
  if (!name?.trim() || !metric || !['>','>=','<','<=','==','!='].includes(operator) || !Number.isFinite(Number(threshold)) || !['info','warning','critical'].includes(severity))
    return res.status(400).json({ error:'Provide valid name, metric, operator, numeric threshold and severity' });
  const result = db.prepare('INSERT INTO rules (name,metric,operator,threshold,severity,enabled,created_at) VALUES (?,?,?,?,?,1,?)')
    .run(name.trim(),metric,operator,Number(threshold),severity,now());
  res.status(201).json(db.prepare('SELECT * FROM rules WHERE id=?').get(result.lastInsertRowid));
}));

app.patch('/api/rules/:id', wrap((req,res) => {
  const rule = db.prepare('SELECT * FROM rules WHERE id=?').get(req.params.id);
  if (!rule) return res.status(404).json({ error:'Rule not found' });
  const enabled = req.body.enabled === undefined ? rule.enabled : (req.body.enabled ? 1 : 0);
  db.prepare('UPDATE rules SET enabled=? WHERE id=?').run(enabled,req.params.id);
  res.json({ ...db.prepare('SELECT * FROM rules WHERE id=?').get(req.params.id), enabled:Boolean(enabled) });
}));

app.delete('/api/rules/:id', wrap((req,res) => {
  const result = db.prepare('DELETE FROM rules WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error:'Rule not found' });
  res.status(204).end();
}));

app.get('/api/alerts', wrap((req,res) => {
  const rows = db.prepare(`
    SELECT a.*, d.name AS device_name, r.name AS rule_name
    FROM alerts a LEFT JOIN devices d ON d.id=a.device_id LEFT JOIN rules r ON r.id=a.rule_id
    ORDER BY a.id DESC LIMIT 200
  `).all();
  res.json(rows);
}));

app.patch('/api/alerts/:id/acknowledge', wrap((req,res) => {
  const result = db.prepare('UPDATE alerts SET acknowledged=1 WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error:'Alert not found' });
  const alert = db.prepare('SELECT * FROM alerts WHERE id=?').get(req.params.id);
  io.emit('alert:acknowledged', alert);
  res.json(alert);
}));

app.post('/api/simulator/start', (req,res) => {
  const started = startSimulator(ingestReading);
  res.json({ running:true, started });
});
app.post('/api/simulator/stop', (req,res) => {
  const stopped = stopSimulator();
  res.json({ running:false, stopped });
});

app.use((err,req,res,next) => {
  console.error(err);
  res.status(500).json({ error:'Internal server error' });
});

io.on('connection', socket => {
  socket.emit('connection:ready', { connected:true, timestamp:now() });
});

server.listen(PORT, () => console.log(`NexusFlow API + Socket.IO running at http://localhost:${PORT}`));
