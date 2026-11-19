import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'nexusflow.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'online',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT DEFAULT '',
  recorded_at TEXT NOT NULL,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry(device_id, recorded_at);
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold REAL NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER,
  device_id TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  value REAL NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(rule_id) REFERENCES rules(id) ON DELETE SET NULL,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);
`);

const now = () => new Date().toISOString();
const deviceCount = db.prepare('SELECT COUNT(*) AS count FROM devices').get().count;
if (deviceCount === 0) {
  const insert = db.prepare('INSERT INTO devices (id,name,type,location,status,created_at) VALUES (?,?,?,?,?,?)');
  const seed = db.transaction(() => {
    insert.run('sensor-temp-01','Temperature Sensor 01','Temperature','Server Room','online',now());
    insert.run('sensor-hum-02','Humidity Sensor 02','Humidity','Greenhouse A','online',now());
    insert.run('sensor-air-03','Air Quality Sensor 03','Air Quality','Main Office','offline',now());
  });
  seed();
}
const ruleCount = db.prepare('SELECT COUNT(*) AS count FROM rules').get().count;
if (ruleCount === 0) {
  const insert = db.prepare('INSERT INTO rules (name,metric,operator,threshold,severity,enabled,created_at) VALUES (?,?,?,?,?,?,?)');
  insert.run('High temperature','temperature','>',40,'critical',1,now());
  insert.run('Low humidity','humidity','<',30,'warning',1,now());
  insert.run('Poor air quality','air_quality','>',100,'warning',1,now());
}
export { db, now };
