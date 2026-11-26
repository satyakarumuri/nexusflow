const test = require('node:test');
const assert = require('node:assert/strict');
const { RuleEngine } = require('../src/engine/ruleEngine');
const { validateRule } = require('../src/engine/validate');

const T0 = 1_700_000_000_000;
const reading = (sec, metrics, deviceId = 'd1', type = 'boiler') => ({ deviceId, type, ts: T0 + sec * 1000, metrics });

function engineWith(rule) {
  const e = new RuleEngine();
  e.setRules([{ _id: 'r1', enabled: true, target: { type: 'all' }, durationSeconds: 0, cooldownSeconds: 0, ...rule }]);
  return e;
}

test('simple threshold fires once, then resolves', () => {
  const e = engineWith({ condition: { metric: 'temperature', operator: '>', value: 80 } });
  assert.equal(e.process(reading(0, { temperature: 70 })).triggered.length, 0);
  assert.equal(e.process(reading(1, { temperature: 85 })).triggered.length, 1);
  assert.equal(e.process(reading(2, { temperature: 90 })).triggered.length, 0); // same episode
  assert.equal(e.process(reading(3, { temperature: 60 })).resolved.length, 1);
  assert.equal(e.process(reading(4, { temperature: 95 })).triggered.length, 1); // new episode
});

test('duration: must hold continuously', () => {
  const e = engineWith({ durationSeconds: 5, condition: { metric: 'temperature', operator: '>', value: 80 } });
  assert.equal(e.process(reading(0, { temperature: 85 })).triggered.length, 0);
  assert.equal(e.process(reading(3, { temperature: 85 })).triggered.length, 0);
  assert.equal(e.process(reading(4, { temperature: 70 })).triggered.length, 0); // broken
  assert.equal(e.process(reading(5, { temperature: 85 })).triggered.length, 0);
  assert.equal(e.process(reading(10, { temperature: 85 })).triggered.length, 1);
});

test('windowed average smooths single spikes', () => {
  const e = engineWith({ condition: { metric: 'vibration', agg: 'avg', windowSeconds: 10, operator: '>', value: 7 } });
  for (let s = 0; s < 8; s++) assert.equal(e.process(reading(s, { vibration: 2 })).triggered.length, 0);
  assert.equal(e.process(reading(8, { vibration: 20 })).triggered.length, 0); // avg ~4
  let fired = 0;
  for (let s = 9; s < 14; s++) fired += e.process(reading(s, { vibration: 20 })).triggered.length;
  assert.equal(fired, 1);
});

test('compound AND / OR / NOT', () => {
  const e = engineWith({
    condition: {
      all: [
        { metric: 'pressure', operator: '>', value: 100 },
        { any: [{ metric: 'temperature', operator: '>', value: 70 }, { metric: 'rpm', operator: 'between', value: [0, 10] }] },
        { not: { metric: 'maintenance', operator: '==', value: 1 } },
      ],
    },
  });
  assert.equal(e.process(reading(0, { pressure: 110, temperature: 50, rpm: 500, maintenance: 0 })).triggered.length, 0);
  assert.equal(e.process(reading(1, { pressure: 110, temperature: 75, rpm: 500, maintenance: 0 })).triggered.length, 1);
});

test('cooldown re-notifies while condition persists', () => {
  const e = engineWith({ cooldownSeconds: 10, condition: { metric: 'temperature', operator: '>', value: 80 } });
  assert.equal(e.process(reading(0, { temperature: 90 })).triggered.length, 1);
  assert.equal(e.process(reading(5, { temperature: 90 })).triggered.length, 0);
  assert.equal(e.process(reading(11, { temperature: 90 })).triggered.length, 1);
});

test('target filtering by device and type', () => {
  const e = engineWith({ target: { type: 'deviceType', value: 'chiller' }, condition: { metric: 'temperature', operator: '>', value: 80 } });
  assert.equal(e.process(reading(0, { temperature: 90 }, 'd1', 'boiler')).triggered.length, 0);
  assert.equal(e.process(reading(0, { temperature: 90 }, 'd2', 'chiller')).triggered.length, 1);
});

test('state is tracked per device', () => {
  const e = engineWith({ condition: { metric: 'temperature', operator: '>', value: 80 } });
  assert.equal(e.process(reading(0, { temperature: 90 }, 'a')).triggered.length, 1);
  assert.equal(e.process(reading(0, { temperature: 90 }, 'b')).triggered.length, 1);
});

test('validation rejects bad rules and accepts good ones', () => {
  assert.ok(validateRule({}).errors.length > 0);
  assert.ok(validateRule({ name: 'x', condition: { metric: 'a b', operator: '>', value: 1 } }).errors.length > 0);
  assert.ok(validateRule({ name: 'x', condition: { metric: 't', agg: 'avg', operator: '>', value: 1 } }).errors.length > 0);
  assert.ok(validateRule({ name: 'x', condition: { metric: 't', operator: 'eval', value: 1 } }).errors.length > 0);
  const ok = validateRule({
    name: 'Hot', severity: 'critical',
    condition: { all: [{ metric: 'temperature', operator: '>', value: 80 }] },
    actions: [{ type: 'webhook', url: 'https://example.com/hook' }, { type: 'command', name: 'cooling_on' }],
  });
  assert.deepEqual(ok.errors, []);
});
