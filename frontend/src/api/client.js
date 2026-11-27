const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...JSON_HEADERS,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  // Rules
  listRules: () => request('/api/rules'),
  saveRule: (payload) =>
    request(payload.ruleId ? `/api/rules/${payload.ruleId}` : '/api/rules', {
      method: payload.ruleId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  deployRule: (ruleId) => request(`/api/rules/${ruleId}/deploy`, { method: 'POST' }),
  stopRule: (ruleId) => request(`/api/rules/${ruleId}/stop`, { method: 'POST' }),
  deleteRule: (ruleId) => request(`/api/rules/${ruleId}`, { method: 'DELETE' }),
  previewCompile: (graph) =>
    request('/api/rules/compile-preview', {
      method: 'POST',
      body: JSON.stringify({ graph })
    }),

  // Telemetry & Stats
  getRecentTelemetry: (deviceId = 'turbine-01', limit = 60) =>
    request(`/api/telemetry/recent?deviceId=${encodeURIComponent(deviceId)}&limit=${limit}`),
  getStats: () => request('/api/telemetry/stats'),
  ingestTelemetry: (readings) =>
    request('/api/telemetry', {
      method: 'POST',
      body: JSON.stringify({ readings })
    }),

  // Alerts & Webhooks
  getAlerts: (limit = 50) => request(`/api/alerts?limit=${limit}`),
  clearAlerts: () => request('/api/alerts', { method: 'DELETE' }),
  getTestWebhooks: () => request('/api/webhooks/test-receiver'),

  // Simulator
  getSimulatorStatus: () => request('/api/simulator/status'),
  startSimulator: (intervalMs = 450) =>
    request('/api/simulator/start', {
      method: 'POST',
      body: JSON.stringify({ intervalMs })
    }),
  stopSimulator: () => request('/api/simulator/stop', { method: 'POST' }),
  injectSpike: (payload) =>
    request('/api/simulator/spike', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};
