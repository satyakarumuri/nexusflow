# NexusFlow — Visual IoT Telemetry & Dynamic RxJS Rule Engine

> **Team Project:** IoT Telemetry Processing and Rule Automation.

NexusFlow is a real-time, no-code visual rule engine and IoT telemetry platform built with **React**, **React Flow**, **Recharts**, **Node.js / Express**, **RxJS**, **WebSockets**, and **MongoDB 5.0+ Time-Series** collections.

Factory floor managers can visually wire **Data Sources** (`Turbine Sensor`) → **Math Operations** (`Moving Average Filter`, `Math Transform`, `Threshold`, `AND/OR Logic Gate`) → **Action Triggers** (`SMS Alert`, `HTTP Webhook`), compile the visual graph directly into concurrent in-memory RxJS `Observable` pipelines, and watch live telemetry streams, glowing canvas wires, and anomaly alerts in real time.

---

## Architecture

```
  Hardware / Simulator ──POST /api/telemetry──▶ Express Ingestion API
                                                   │
                        ┌──────────────────────────┴──────────────────────────┐
                        ▼                                                     ▼
         Async Batch Buffer (insertMany)                         RxJS telemetry$ Subject
                        │                                                     │
                        ▼                                                     ▼
      MongoDB 5.0+ Time-Series (`telemetry`)               Dynamic Stream Compiler (`streamCompiler.js`)
                                                                  │                       │
                                                                  ▼                       ▼
                                                       WebSocket `edge_pulse`    SMS / Webhook Actions
                                                          (Glowing Wires)       (`alerts` + WS `alert`)
```

### Project Structure
- `docker-compose.yml` — MongoDB 7.0 container configured for native Time-Series collections.
- `backend/` — Express API, MongoDB Time-Series setup, RxJS Stream Compiler, WebSocket server, Hardware Simulator, and 5,000+ writes/sec Ingestion Audit benchmark.
- `frontend/` — Vite + React 18 + `@xyflow/react` visual pipeline builder, custom glowing edges, `GraphInspector` JSON/DAG verifier, Recharts live telemetry dashboard, and real-time alert feed.

---

## Prerequisites
- **Node.js** 18+ (for built-in `fetch` and `node --test`)
- **MongoDB 5.0+** (Docker Compose included, or a local/Atlas MongoDB 5.0+ instance)

---

## Quick Start

### 1. Start MongoDB 5.0+ (via Docker Compose)
```bash
docker compose up -d
```

### 2. Configure & Start Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
The backend starts on `http://localhost:4000` (WebSocket at `ws://localhost:4000/ws`) and automatically:
1. Verifies MongoDB >= 5.0 and creates the native Time-Series collection `telemetry` (`timeField: "timestamp"`, `metaField: "meta"`, `granularity: "seconds"`).
2. Seeds and compiles the starter **"Turbine Overheat Protection"** rule (`Turbine Sensor → Moving Average (5) → > 80°C → SMS Alert`).

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

### 4. Test the End-to-End Flow
1. Click **Start Stream** in the dashboard (or **Start Simulator** on the canvas) to stream live telemetry from `turbine-01`, `compressor-02`, `cnc-mill-03`, and `boiler-04`.
2. Watch the connection wires on the React Flow canvas **glow** as data flows through the compiled RxJS operators and watch the live **Recharts** graph update.
3. Click **Inject Overheat** to spike `turbine-01` temperature above 90°C for 8 seconds. Once the 5-sample moving average crosses `80°C`, an **SMS Alert** fires in the **Live Alerts** panel.
4. Click **JSON** in the top bar to inspect the serialized React Flow JSON and backend topological RxJS execution plan.

---

## Verification Scripts

### Unit Tests (RxJS Stream Compiler)
```bash
cd backend
npm test
```

### Mid-Project Ingestion Audit (5,000+ writes/sec Benchmark)
Ensure MongoDB is running, then execute:
```bash
cd backend
npm run benchmark
```
This inserts 50,000 synthetic telemetry points in concurrent batches into the `telemetry` Time-Series collection and reports sustained writes/sec, disk storage added, and MongoDB Time-Series compression ratio.

### Standalone Hardware Telemetry Simulator (CLI)
```bash
cd backend
npm run simulate
```
Streams batched HTTP telemetry to `POST /api/telemetry` and periodically injects overheat spikes on `turbine-01`.
