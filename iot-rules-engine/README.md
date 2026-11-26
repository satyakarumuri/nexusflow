# Rulebook: a no-code rules engine for IoT streams (MERN)

**Problem:** hard-coding logic like `if (temperature > 80) alert()` means a developer must change and redeploy
code for every business-rule change, and a plain MERN app struggles to store high-frequency machine data
while also running user-defined logic against the live stream.

**Solution:** rules are *data*, not code. Operators build them in the UI; the backend interprets them against
every incoming reading, in memory, while telemetry is stored in a MongoDB **time-series collection**.

```
 Devices ──HTTP / MQTT──▶ Ingest service ──┬─▶ buffer ──batched insertMany──▶ MongoDB time-series (TTL)
 (or simulator)           (validate)       ├─▶ in-memory sliding windows ─▶ Rule engine ─▶ Alert + actions
                                           └─▶ Socket.IO ─▶ React live dashboard
                                                                 ▲
 Rule builder (React) ──REST──▶ Rules collection ──hot reload────┘   (no redeploy)
```

## Why it scales where a naive MERN app doesn't

| Concern | Naive approach | This project |
|---|---|---|
| Storing readings | one `insertOne` per reading into a normal collection | readings buffered and written with `insertMany({ordered:false})` (500 docs or 500 ms) into a **time-series collection** (`timeField: ts`, `metaField: meta.deviceId`) with automatic TTL retention |
| Evaluating rules | query Mongo for recent data on every reading | per-device/metric **sliding windows in memory**; zero DB reads on the hot path |
| Changing logic | edit code, redeploy | rules are JSON documents, **hot-reloaded** into the engine when saved |
| Charts over long ranges | return millions of rows | server-side `$dateTrunc` downsampling to ~150 points |
| UI updates | re-render on every message | socket events batched into 2 renders per second |
| Safety of user logic | `eval` / user code | JSON interpreted by a fixed operator table; strict validation; no code execution |

## Rule model

```json
{
  "name": "Overheating",
  "severity": "critical",
  "target": { "type": "deviceType", "value": "boiler" },
  "condition": {
    "all": [
      { "metric": "temperature", "operator": ">", "value": 80 },
      { "any": [
        { "metric": "vibration", "agg": "avg", "windowSeconds": 30, "operator": ">", "value": 6 },
        { "metric": "pressure", "operator": "between", "value": [100, 160] }
      ]}
    ]
  },
  "durationSeconds": 10,
  "cooldownSeconds": 60,
  "message": "{{device}} is at {{temperature}}°C",
  "actions": [
    { "type": "command", "name": "cooling_on", "params": { "level": "high" } },
    { "type": "webhook", "url": "https://example.com/hook" }
  ]
}
```

* **Operators:** `> >= < <= == != between in`, combined with `all` (AND), `any` (OR), `not`.
* **Aggregates:** `last` (default), `avg`, `min`, `max`, `sum`, `count` over `windowSeconds`.
* **Targets:** all devices, one device, or a device type.
* **`durationSeconds`:** condition must hold continuously (ignores spikes).
* **`cooldownSeconds`:** minimum gap between alerts; while the problem persists you are re-notified after it. `0` = once per episode.
* **Every trigger creates an Alert** and pushes it live to the UI. Extra **actions**: queue a *command* for the device (it polls `GET /api/devices/:id/commands/pending`) or call a *webhook*.
* Alerts are marked **resolved** automatically when the condition clears.

## Quick start

### Option A: Docker (everything)
```bash
docker compose up --build              # Mongo + API + UI
docker compose --profile demo up       # also start the simulated device fleet
```
UI: http://localhost:8080 · API: http://localhost:4000

### Option B: local dev
Requires Node 18+ and MongoDB 5.0+ (time-series collections and `$dateTrunc`).
```bash
# terminal 1: API
cd backend && cp .env.example .env && npm install && npm run dev

# terminal 2: UI
cd frontend && npm install && npm run dev        # http://localhost:5173

# terminal 3: fake devices
cd backend && npm run simulate -- --devices 6 --rate 2
```
Open **Rules** and edit or create a rule while data is flowing. The change takes effect on the next reading.
Four example rules are seeded on first start (disable with `SEED_DEFAULT_RULES=false`).

### Try the closed loop
The simulator randomly injects faults. When *Overheating* fires, the rule queues a `cooling_on` command; the simulated
device picks it up, cools down, and the alert resolves. You can watch all of this on the **Live monitor** and **Alerts** pages.

## Sending your own data
```bash
curl -X POST http://localhost:4000/api/telemetry -H 'content-type: application/json' -d '{
  "deviceId": "boiler-99", "type": "boiler",
  "metrics": { "temperature": 91.5, "pressure": 110 }
}'
```
Accepts one reading, an array, or `{ "readings": [...] }` (max 1000/request). `ts` is optional (ms epoch or ISO string).
Set `INGEST_API_KEY` to require an `x-api-key` header. Set `MQTT_URL` to also consume an MQTT topic.

## API summary
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/telemetry` | ingest readings |
| GET | `/api/telemetry/:deviceId/series?metric=&from=&to=&points=` | downsampled history |
| GET | `/api/telemetry/:deviceId/latest` | raw recent readings |
| GET | `/api/devices` | device registry (auto-created on first reading) |
| GET/POST/PUT/DELETE | `/api/rules`, `/api/rules/:id` | manage rules |
| PATCH | `/api/rules/:id/toggle` | enable/disable |
| POST | `/api/rules/test` | dry-run a rule against sample readings |
| GET | `/api/alerts`, POST `/api/alerts/:id/ack`, `/api/alerts/ack-all` | alerts |
| GET | `/api/devices/:deviceId/commands/pending`, POST `/api/commands/:id/ack` | downlink commands |
| GET | `/api/stats`, `/api/health` | dashboard stats / health |

Socket.IO events: `telemetry`, `alert`, `alert:resolved`, `command`, `device:status`.

## Project layout
```
backend/
  src/engine/      evaluator.js (pure), windowStore.js, ruleEngine.js, validate.js
  src/services/    ingest.js (buffering + pipeline), actions.js, deviceMonitor.js, mqtt.js
  src/models/      Telemetry (time-series), Rule, Alert, Device, Command
  src/routes/      telemetry, rules, alerts, devices
  src/simulator/   simulate.js
  test/            engine.test.js  (npm test, no database needed)
frontend/src/      App, hooks.js (live socket state), components/ (Dashboard, RulesPage, RuleBuilder, ConditionEditor, AlertsPage)
docker-compose.yml
```

## Tests
```bash
cd backend && npm test
```
Covers thresholds, sustained duration, windowed averages, AND/OR/NOT, cooldown, target filtering,
per-device state and rule validation.

## Production notes / extensions
* **Auth:** the UI/API are open for demo purposes. Add JWT or API-key auth and per-tenant rule scoping before exposing publicly. Use `INGEST_API_KEY` and `WEBHOOK_ALLOWED_HOSTS` (SSRF guard) at minimum.
* **Scaling out:** rule state lives in process memory. To run several API instances, partition devices by `deviceId` (e.g. MQTT shared subscriptions or a Kafka key) so each device is always handled by one instance.
* **Restart behaviour:** windows are rebuilt from new data; a restart briefly resets "must stay true for" timers. Preload windows from the last N minutes of `telemetry` if you need strict continuity.
* **Retention/rollups:** raw data expires after `TELEMETRY_RETENTION_DAYS`; add a scheduled `$merge` into an hourly-rollup collection for long-term trends.
* **Ideas:** rate-of-change operator, "no data for N minutes" rules, email/Slack actions, rule versioning/audit log.
