const Rule = require('./models/Rule');

const DEFAULT_RULES = [
  {
    name: 'Overheating',
    description: 'Temperature stays above 80°C for 10 seconds, then start cooling.',
    severity: 'critical',
    condition: { metric: 'temperature', operator: '>', value: 80 },
    durationSeconds: 10,
    cooldownSeconds: 60,
    message: '{{device}} is overheating at {{temperature}}°C',
    actions: [{ type: 'command', name: 'cooling_on', params: { level: 'high' } }],
  },
  {
    name: 'Sustained vibration',
    description: '30-second average vibration above 6 mm/s (ignores single spikes).',
    severity: 'warning',
    condition: { metric: 'vibration', agg: 'avg', windowSeconds: 30, operator: '>', value: 6 },
    cooldownSeconds: 120,
  },
  {
    name: 'Pressure and heat combined',
    description: 'High pressure while the unit is also running warm.',
    severity: 'critical',
    target: { type: 'deviceType', value: 'boiler' },
    condition: { all: [{ metric: 'pressure', operator: '>', value: 100 }, { metric: 'temperature', operator: '>', value: 70 }] },
    cooldownSeconds: 60,
  },
  {
    name: 'Low battery',
    description: 'Battery below 15%.',
    severity: 'info',
    target: { type: 'deviceType', value: 'sensor' },
    condition: { metric: 'battery', operator: '<', value: 15 },
    cooldownSeconds: 600,
  },
];

async function seedDefaultRules() {
  if ((await Rule.estimatedDocumentCount()) > 0) return false;
  await Rule.insertMany(DEFAULT_RULES);
  console.log(`[seed] inserted ${DEFAULT_RULES.length} example rules`);
  return true;
}

if (require.main === module) {
  const mongoose = require('mongoose');
  const config = require('./config');
  mongoose.connect(config.mongoUri).then(async () => {
    await Rule.deleteMany({});
    await Rule.insertMany(DEFAULT_RULES);
    console.log('[seed] rules reset');
    await mongoose.disconnect();
  });
}

module.exports = { seedDefaultRules, DEFAULT_RULES };
