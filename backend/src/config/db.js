import { MongoClient } from 'mongodb';

let client = null;
let db = null;

/**
 * Parses major version from MongoDB buildInfo version string (e.g., "7.0.12" -> 7).
 */
function parseMajorVersion(versionStr = '') {
  const major = Number.parseInt(String(versionStr).split('.')[0], 10);
  return Number.isNaN(major) ? 0 : major;
}

/**
 * Connects to MongoDB 5.0+ and initializes native Time-Series and metadata collections.
 */
export async function connectDb({
  uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  dbName = process.env.MONGODB_DB || 'nexusflow',
  ttlSeconds = Number.parseInt(process.env.TELEMETRY_TTL_SECONDS || '2592000', 10)
} = {}) {
  if (db) {
    return db;
  }

  client = new MongoClient(uri, {
    maxPoolSize: 50,
    minPoolSize: 5,
    retryWrites: true
  });

  await client.connect();
  db = client.db(dbName);

  const buildInfo = await db.command({ buildInfo: 1 });
  const majorVersion = parseMajorVersion(buildInfo.version);
  if (majorVersion < 5) {
    throw new Error(
      `MongoDB 5.0+ is required for native Time-Series collections (detected ${buildInfo.version}).`
    );
  }

  await ensureCollections(db, ttlSeconds);
  return db;
}

/**
 * Ensures the native Time-Series telemetry collection and rule/alert collections exist with indexes.
 */
async function ensureCollections(database, ttlSeconds) {
  const existing = await database.listCollections({}, { nameOnly: true }).toArray();
  const names = new Set(existing.map((c) => c.name));

  if (!names.has('telemetry')) {
    const options = {
      timeseries: {
        timeField: 'timestamp',
        metaField: 'meta',
        granularity: 'seconds'
      }
    };
    if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
      options.expireAfterSeconds = ttlSeconds;
    }
    await database.createCollection('telemetry', options);
  }

  if (!names.has('rules')) {
    await database.createCollection('rules');
  }

  if (!names.has('alerts')) {
    await database.createCollection('alerts');
  }

  const telemetryCol = database.collection('telemetry');
  await telemetryCol.createIndex({ 'meta.deviceId': 1, timestamp: -1 });

  const rulesCol = database.collection('rules');
  await rulesCol.createIndex({ updatedAt: -1 });

  const alertsCol = database.collection('alerts');
  await alertsCol.createIndex({ createdAt: -1 });
  await alertsCol.createIndex({ ruleId: 1, createdAt: -1 });
}

/**
 * Returns the active MongoDB database instance.
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDb() first.');
  }
  return db;
}

/**
 * Returns typed collection handles for telemetry, rules, and alerts.
 */
export function getCollections() {
  const database = getDb();
  return {
    telemetry: database.collection('telemetry'),
    rules: database.collection('rules'),
    alerts: database.collection('alerts')
  };
}

/**
 * Collects storage footprint & compression metrics for the Time-Series telemetry collection.
 */
export async function getTimeSeriesStats() {
  const database = getDb();
  const [statsDoc] = await database
    .collection('telemetry')
    .aggregate([{ $collStats: { storageStats: { scale: 1 } } }])
    .toArray();

  const storage = statsDoc?.storageStats || {};
  const count = storage.count ?? 0;
  const uncompressedSize = storage.size ?? 0;
  const storageSize = storage.storageSize ?? 0;
  const totalIndexSize = storage.totalIndexSize ?? 0;
  const compressionRatio =
    storageSize > 0 && uncompressedSize > 0
      ? Number((uncompressedSize / storageSize).toFixed(2))
      : 1;

  return {
    collection: 'telemetry',
    isTimeSeries: true,
    count,
    avgObjSizeBytes: Math.round(storage.avgObjSize ?? 0),
    uncompressedSizeBytes: uncompressedSize,
    storageSizeBytes: storageSize,
    totalIndexSizeBytes: totalIndexSize,
    compressionRatio
  };
}

/**
 * Gracefully closes the MongoDB client connection.
 */
export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
