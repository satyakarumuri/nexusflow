import { db, now } from './db.js';

const operators = {
  '>': (a,b) => a > b,
  '>=': (a,b) => a >= b,
  '<': (a,b) => a < b,
  '<=': (a,b) => a <= b,
  '==': (a,b) => a === b,
  '!=': (a,b) => a !== b
};

export function evaluateRules(reading) {
  const rules = db.prepare('SELECT * FROM rules WHERE enabled = 1 AND metric = ?').all(reading.metric);
  const created = [];
  for (const rule of rules) {
    if (operators[rule.operator]?.(Number(reading.value), Number(rule.threshold))) {
      const message = `${rule.name}: ${reading.metric.replaceAll('_',' ')} is ${reading.value}${reading.unit ? ` ${reading.unit}` : ''} (${rule.operator} ${rule.threshold})`;
      const result = db.prepare(`
        INSERT INTO alerts (rule_id,device_id,message,severity,value,created_at)
        VALUES (?,?,?,?,?,?)
      `).run(rule.id, reading.deviceId, message, rule.severity, reading.value, now());
      created.push(db.prepare('SELECT * FROM alerts WHERE id = ?').get(result.lastInsertRowid));
    }
  }
  return created;
}
