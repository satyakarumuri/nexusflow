import { v4 as uuidv4 } from 'uuid';
import { getCollections } from '../config/db.js';
import { broadcast } from '../ws/wsServer.js';

const PORT = process.env.PORT || 4000;

/**
 * Interpolates {{key}} placeholders in an alert message template.
 */
export function renderAlertTemplate(template, context) {
  const fallback = `Anomaly on ${context.deviceId} (${context.metric}): ${context.value}`;
  if (!template || typeof template !== 'string') {
    return fallback;
  }

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    if (context[key] === undefined || context[key] === null) {
      return '';
    }
    if (typeof context[key] === 'number') {
      return Number(context[key].toFixed(2));
    }
    return String(context[key]);
  });
}

/**
 * Dispatches a mock SMS alert, persists it to MongoDB, and broadcasts over WebSocket.
 */
export async function triggerSmsAlert({
  ruleId,
  ruleName,
  nodeId,
  phoneNumber = '+1-555-0199',
  severity = 'critical',
  messageTemplate,
  reading
}) {
  const message = renderAlertTemplate(messageTemplate, {
    ruleName,
    deviceId: reading.deviceId,
    metric: reading.metric,
    value: reading.value
  });

  const alertDoc = {
    alertId: uuidv4(),
    channel: 'sms',
    ruleId,
    ruleName,
    nodeId,
    severity,
    recipient: phoneNumber,
    deviceId: reading.deviceId,
    metric: reading.metric,
    value: Number(reading.value.toFixed(3)),
    message,
    delivery: {
      provider: 'MockSMS-Gateway',
      status: 'delivered',
      dispatchedAt: new Date()
    },
    createdAt: new Date()
  };

  await persistAndBroadcastAlert(alertDoc);
  return alertDoc;
}

/**
 * Dispatches an outbound HTTP webhook, logs delivery result to MongoDB, and broadcasts over WebSocket.
 */
export async function triggerWebhookAction({
  ruleId,
  ruleName,
  nodeId,
  url = '/api/webhooks/test-receiver',
  method = 'POST',
  severity = 'warning',
  messageTemplate,
  reading
}) {
  const resolvedUrl = url.startsWith('/') ? `http://127.0.0.1:${PORT}${url}` : url;
  const message = renderAlertTemplate(messageTemplate, {
    ruleName,
    deviceId: reading.deviceId,
    metric: reading.metric,
    value: reading.value
  });

  const payload = {
    event: 'nexusflow.rule.triggered',
    ruleId,
    ruleName,
    severity,
    deviceId: reading.deviceId,
    metric: reading.metric,
    value: Number(reading.value.toFixed(3)),
    message,
    timestamp: new Date().toISOString()
  };

  let status = 'delivered';
  let statusCode = 200;
  let errorDetail = null;

  try {
    const response = await fetch(resolvedUrl, {
      method: method.toUpperCase(),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000)
    });
    statusCode = response.status;
    if (!response.ok) {
      status = 'failed';
      errorDetail = `HTTP ${response.status}`;
    }
  } catch (err) {
    status = 'failed';
    statusCode = 0;
    errorDetail = err.message;
  }

  const alertDoc = {
    alertId: uuidv4(),
    channel: 'webhook',
    ruleId,
    ruleName,
    nodeId,
    severity,
    recipient: url,
    deviceId: reading.deviceId,
    metric: reading.metric,
    value: payload.value,
    message,
    delivery: {
      provider: 'HTTP-Webhook',
      method: method.toUpperCase(),
      status,
      statusCode,
      error: errorDetail,
      dispatchedAt: new Date()
    },
    createdAt: new Date()
  };

  await persistAndBroadcastAlert(alertDoc);
  return alertDoc;
}

async function persistAndBroadcastAlert(alertDoc) {
  try {
    const { alerts } = getCollections();
    await alerts.insertOne(alertDoc);
  } catch (err) {
    console.error('[alertService] Failed to persist alert:', err.message);
  }

  broadcast('alert', alertDoc);
}
