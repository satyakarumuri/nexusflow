const config = require('../config');

/** Optional: subscribe to an MQTT topic and feed the same ingest pipeline. */
function startMqtt(ingest) {
  if (!config.mqttUrl) return null;
  const mqtt = require('mqtt');
  const client = mqtt.connect(config.mqttUrl);
  client.on('connect', () => {
    client.subscribe(config.mqttTopic);
    console.log(`[mqtt] subscribed to ${config.mqttTopic} on ${config.mqttUrl}`);
  });
  client.on('message', (_topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());
      ingest.ingest(Array.isArray(data) ? data : data.readings || [data]);
    } catch (err) {
      console.warn('[mqtt] bad payload:', err.message);
    }
  });
  client.on('error', (err) => console.error('[mqtt]', err.message));
  return client;
}

module.exports = { startMqtt };
