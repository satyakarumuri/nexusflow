export const NODE_LIBRARY = [
  {
    category: 'Data Sources',
    accent: '#22d3ee',
    items: [
      {
        type: 'sensorSource',
        label: 'Sensor Data Source',
        description: 'Subscribe to live device metric stream',
        defaultData: {
          label: 'Turbine Sensor',
          deviceId: 'turbine-01',
          metric: 'temperature',
          unit: '°C'
        }
      }
    ]
  },
  {
    category: 'Math Operations',
    accent: '#8b5cf6',
    items: [
      {
        type: 'movingAverage',
        label: 'Moving Average Filter',
        description: 'Sliding window smoothing over N points',
        defaultData: {
          label: 'Moving Average',
          windowSize: 5
        }
      },
      {
        type: 'mathTransform',
        label: 'Math Transform',
        description: 'Scale, offset, °C/°F, or rate of change',
        defaultData: {
          label: 'Math Transform',
          operation: 'cToF',
          operand: 1
        }
      },
      {
        type: 'threshold',
        label: 'Threshold Comparator',
        description: 'Gate stream by comparison & cooldown',
        defaultData: {
          label: 'Threshold Check',
          operator: '>',
          thresholdValue: 80,
          cooldownMs: 3000
        }
      },
      {
        type: 'logicGate',
        label: 'AND / OR Logic Gate',
        description: 'Combine multiple upstream conditions',
        defaultData: {
          label: 'Logic Gate',
          gateType: 'AND',
          windowMs: 5000
        }
      }
    ]
  },
  {
    category: 'Action Triggers',
    accent: '#f43f5e',
    items: [
      {
        type: 'smsAlert',
        label: 'SMS Alert',
        description: 'Send real-time SMS notification',
        defaultData: {
          label: 'SMS Alert',
          phoneNumber: '+1-555-0199',
          severity: 'critical',
          cooldownMs: 3000,
          messageTemplate: 'ALERT [{{ruleName}}]: {{deviceId}} {{metric}} = {{value}}'
        }
      },
      {
        type: 'webhookAction',
        label: 'HTTP Webhook',
        description: 'Dispatch JSON payload to external API',
        defaultData: {
          label: 'Webhook Trigger',
          url: '/api/webhooks/test-receiver',
          method: 'POST',
          severity: 'warning',
          cooldownMs: 3000,
          messageTemplate: 'Webhook [{{ruleName}}]: {{deviceId}} {{metric}} = {{value}}'
        }
      }
    ]
  }
];

export const PIPELINE_PRESETS = [
  {
    id: 'turbine-overheat',
    name: 'Turbine Overheat Protection',
    description: 'Turbine Sensor → Moving Avg (5) → > 80°C → SMS Alert',
    graph: {
      nodes: [
        {
          id: 'p1-sensor',
          type: 'sensorSource',
          position: { x: 60, y: 150 },
          data: { label: 'Turbine Sensor', deviceId: 'turbine-01', metric: 'temperature', unit: '°C' }
        },
        {
          id: 'p1-mavg',
          type: 'movingAverage',
          position: { x: 350, y: 150 },
          data: { label: 'Moving Average Filter', windowSize: 5 }
        },
        {
          id: 'p1-thresh',
          type: 'threshold',
          position: { x: 640, y: 150 },
          data: { label: 'Overheat (>80°C)', operator: '>', thresholdValue: 80, cooldownMs: 3000 }
        },
        {
          id: 'p1-sms',
          type: 'smsAlert',
          position: { x: 930, y: 150 },
          data: {
            label: 'SMS Alert',
            phoneNumber: '+1-555-0199',
            severity: 'critical',
            cooldownMs: 3000,
            messageTemplate: 'ALERT [{{ruleName}}]: {{deviceId}} {{metric}} reached {{value}}°C!'
          }
        }
      ],
      edges: [
        { id: 'p1-e1', source: 'p1-sensor', target: 'p1-mavg', type: 'glowing' },
        { id: 'p1-e2', source: 'p1-mavg', target: 'p1-thresh', type: 'glowing' },
        { id: 'p1-e3', source: 'p1-thresh', target: 'p1-sms', type: 'glowing' }
      ]
    }
  },
  {
    id: 'multi-sensor-webhook',
    name: 'Vibration + Temp Correlation Webhook',
    description: 'Temp > 75°C AND Vibration > 2.2 mm/s → Outbound Webhook',
    graph: {
      nodes: [
        {
          id: 'p2-temp',
          type: 'sensorSource',
          position: { x: 40, y: 60 },
          data: { label: 'Turbine Temp', deviceId: 'turbine-01', metric: 'temperature', unit: '°C' }
        },
        {
          id: 'p2-vib',
          type: 'sensorSource',
          position: { x: 40, y: 280 },
          data: { label: 'Turbine Vibration', deviceId: 'turbine-01', metric: 'vibration', unit: 'mm/s' }
        },
        {
          id: 'p2-t1',
          type: 'threshold',
          position: { x: 340, y: 60 },
          data: { label: 'Temp > 75°C', operator: '>', thresholdValue: 75, cooldownMs: 1000 }
        },
        {
          id: 'p2-t2',
          type: 'threshold',
          position: { x: 340, y: 280 },
          data: { label: 'Vibration > 2.2', operator: '>', thresholdValue: 2.2, cooldownMs: 1000 }
        },
        {
          id: 'p2-and',
          type: 'logicGate',
          position: { x: 640, y: 170 },
          data: { label: 'Correlated Fault (AND)', gateType: 'AND', windowMs: 4000 }
        },
        {
          id: 'p2-hook',
          type: 'webhookAction',
          position: { x: 940, y: 170 },
          data: {
            label: 'Maintenance Webhook',
            url: '/api/webhooks/test-receiver',
            method: 'POST',
            severity: 'critical',
            cooldownMs: 3000,
            messageTemplate: 'Correlated fault on {{deviceId}} ({{metric}}={{value}})'
          }
        }
      ],
      edges: [
        { id: 'p2-e1', source: 'p2-temp', target: 'p2-t1', type: 'glowing' },
        { id: 'p2-e2', source: 'p2-vib', target: 'p2-t2', type: 'glowing' },
        { id: 'p2-e3', source: 'p2-t1', target: 'p2-and', type: 'glowing' },
        { id: 'p2-e4', source: 'p2-t2', target: 'p2-and', type: 'glowing' },
        { id: 'p2-e5', source: 'p2-and', target: 'p2-hook', type: 'glowing' }
      ]
    }
  }
];
