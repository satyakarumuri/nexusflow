const BASE = import.meta.env.VITE_API_URL || '';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'content-type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || (data.errors && data.errors.join('; ')) || `Request failed (${res.status})`);
    err.details = data.errors || [];
    throw err;
  }
  return data;
}

export const API_BASE = BASE;

export const api = {
  stats: () => req('/api/stats'),
  devices: () => req('/api/devices'),
  series: (deviceId, metric, fromMs, points = 150) =>
    req(`/api/telemetry/${encodeURIComponent(deviceId)}/series?metric=${encodeURIComponent(metric)}&from=${new Date(fromMs).toISOString()}&points=${points}`),
  rules: () => req('/api/rules'),
  createRule: (rule) => req('/api/rules', { method: 'POST', body: rule }),
  updateRule: (id, rule) => req(`/api/rules/${id}`, { method: 'PUT', body: rule }),
  toggleRule: (id) => req(`/api/rules/${id}/toggle`, { method: 'PATCH' }),
  deleteRule: (id) => req(`/api/rules/${id}`, { method: 'DELETE' }),
  testRule: (rule, readings) => req('/api/rules/test', { method: 'POST', body: { rule, readings } }),
  alerts: (q = '') => req(`/api/alerts${q}`),
  ackAlert: (id) => req(`/api/alerts/${id}/ack`, { method: 'POST' }),
  ackAll: () => req('/api/alerts/ack-all', { method: 'POST' }),
};
