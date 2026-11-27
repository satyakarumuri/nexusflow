import test from 'node:test';
import assert from 'node:assert/strict';
import { Subject } from 'rxjs';
import { compileRuleGraph, validateAndAnalyzeGraph } from '../src/engine/streamCompiler.js';

function makeReading(deviceId, metric, value, tsOffsetMs = 0) {
  return {
    timestamp: new Date(Date.now() + tsOffsetMs),
    meta: { deviceId, deviceType: 'turbine', location: 'floor-a' },
    metrics: { [metric]: value }
  };
}

test('compiles Sensor -> MovingAverage -> Threshold -> SMS Alert pipeline', () => {
  const telemetry$ = new Subject();
  const triggered = [];
  const pulses = [];

  const graph = {
    nodes: [
      {
        id: 's1',
        type: 'sensorSource',
        data: { deviceId: 'turbine-01', metric: 'temperature' }
      },
      {
        id: 'm1',
        type: 'movingAverage',
        data: { windowSize: 3 }
      },
      {
        id: 't1',
        type: 'threshold',
        data: { operator: '>', thresholdValue: 80, cooldownMs: 0 }
      },
      {
        id: 'a1',
        type: 'smsAlert',
        data: { phoneNumber: '+1-555-0100', cooldownMs: 0 }
      }
    ],
    edges: [
      { id: 'e1', source: 's1', target: 'm1' },
      { id: 'e2', source: 'm1', target: 't1' },
      { id: 'e3', source: 't1', target: 'a1' }
    ]
  };

  const compiled = compileRuleGraph({
    ruleId: 'test-rule-1',
    ruleName: 'Overheat',
    graph,
    telemetry$,
    pulseThrottleMs: 0,
    onAction: (node, packet) => triggered.push({ nodeId: node.id, value: packet.value }),
    onEdgePulse: (pulse) => pulses.push(pulse)
  });

  // Other device should be ignored
  telemetry$.next(makeReading('compressor-02', 'temperature', 99));
  assert.equal(triggered.length, 0);

  // Moving average over 3 samples: 70 -> avg 70; 75 -> avg 72.5; 98 -> avg (70+75+98)/3 = 81 > 80
  telemetry$.next(makeReading('turbine-01', 'temperature', 70));
  telemetry$.next(makeReading('turbine-01', 'temperature', 75));
  assert.equal(triggered.length, 0);

  telemetry$.next(makeReading('turbine-01', 'temperature', 98));
  assert.equal(triggered.length, 1);
  assert.equal(triggered[0].nodeId, 'a1');
  assert.equal(Math.round(triggered[0].value), 81);
  assert.ok(pulses.length > 0);

  compiled.dispose();
});

test('supports MathTransform (cToF) and WebhookAction', () => {
  const telemetry$ = new Subject();
  const actions = [];

  const graph = {
    nodes: [
      { id: 's1', type: 'sensorSource', data: { deviceId: '*', metric: 'temperature' } },
      { id: 'math1', type: 'mathTransform', data: { operation: 'cToF' } },
      { id: 't1', type: 'threshold', data: { operator: '>=', thresholdValue: 212, cooldownMs: 0 } },
      { id: 'w1', type: 'webhookAction', data: { url: '/api/webhooks/test-receiver', cooldownMs: 0 } }
    ],
    edges: [
      { id: 'e1', source: 's1', target: 'math1' },
      { id: 'e2', source: 'math1', target: 't1' },
      { id: 'e3', source: 't1', target: 'w1' }
    ]
  };

  const compiled = compileRuleGraph({
    ruleId: 'test-rule-2',
    graph,
    telemetry$,
    onAction: (node, packet) => actions.push(packet.value)
  });

  telemetry$.next(makeReading('boiler-04', 'temperature', 90)); // 194 F
  assert.equal(actions.length, 0);

  telemetry$.next(makeReading('boiler-04', 'temperature', 100)); // 212 F
  assert.equal(actions.length, 1);
  assert.equal(actions[0], 212);

  compiled.dispose();
});

test('supports multi-input LogicGate AND combining two sensors', () => {
  const telemetry$ = new Subject();
  const actions = [];

  const graph = {
    nodes: [
      { id: 's-temp', type: 'sensorSource', data: { deviceId: 'turbine-01', metric: 'temperature' } },
      { id: 's-vib', type: 'sensorSource', data: { deviceId: 'turbine-01', metric: 'vibration' } },
      { id: 't-temp', type: 'threshold', data: { operator: '>', thresholdValue: 80, cooldownMs: 0 } },
      { id: 't-vib', type: 'threshold', data: { operator: '>', thresholdValue: 4, cooldownMs: 0 } },
      { id: 'gate', type: 'logicGate', data: { gateType: 'AND', windowMs: 5000 } },
      { id: 'sms', type: 'smsAlert', data: { cooldownMs: 0 } }
    ],
    edges: [
      { id: 'e1', source: 's-temp', target: 't-temp' },
      { id: 'e2', source: 's-vib', target: 't-vib' },
      { id: 'e3', source: 't-temp', target: 'gate' },
      { id: 'e4', source: 't-vib', target: 'gate' },
      { id: 'e5', source: 'gate', target: 'sms' }
    ]
  };

  const compiled = compileRuleGraph({
    ruleId: 'test-rule-and',
    graph,
    telemetry$,
    onAction: () => actions.push(true)
  });

  telemetry$.next(makeReading('turbine-01', 'temperature', 85));
  assert.equal(actions.length, 0);

  telemetry$.next(makeReading('turbine-01', 'vibration', 5.2));
  assert.equal(actions.length, 1);

  compiled.dispose();
});

test('rejects cyclic graphs during validation', () => {
  const cyclicGraph = {
    nodes: [
      { id: 's1', type: 'sensorSource', data: {} },
      { id: 'm1', type: 'movingAverage', data: { windowSize: 3 } },
      { id: 't1', type: 'threshold', data: { operator: '>', thresholdValue: 50 } },
      { id: 'a1', type: 'smsAlert', data: {} }
    ],
    edges: [
      { id: 'e1', source: 's1', target: 'm1' },
      { id: 'e2', source: 'm1', target: 't1' },
      { id: 'e3', source: 't1', target: 'm1' },
      { id: 'e4', source: 't1', target: 'a1' }
    ]
  };

  assert.throws(() => validateAndAnalyzeGraph(cyclicGraph), /Cycle detected/);
});
