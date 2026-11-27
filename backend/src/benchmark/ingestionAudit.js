import 'dotenv/config';
import { connectDb, closeDb, getCollections, getTimeSeriesStats } from '../config/db.js';

const TOTAL_DOCS = Number.parseInt(process.env.BENCH_TOTAL_DOCS || '50000', 10);
const BATCH_SIZE = Number.parseInt(process.env.BENCH_BATCH_SIZE || '2500', 10);
const CONCURRENCY = Number.parseInt(process.env.BENCH_CONCURRENCY || '4', 10);

function buildSyntheticBatch(batchIndex, size) {
  const baseTime = Date.now() - (TOTAL_DOCS - batchIndex * size) * 5;
  const devices = ['turbine-01', 'compressor-02', 'cnc-mill-03', 'boiler-04'];
  const docs = new Array(size);

  for (let i = 0; i < size; i += 1) {
    const deviceId = devices[i % devices.length];
    docs[i] = {
      timestamp: new Date(baseTime + i * 5),
      meta: {
        deviceId,
        deviceType: 'benchmark-sensor',
        location: 'floor-a'
      },
      metrics: {
        temperature: 65 + Math.sin(i / 20) * 8,
        vibration: 2.1 + Math.cos(i / 15) * 0.4,
        pressure: 104 + Math.sin(i / 30) * 3,
        rpm: 1500 + (i % 40)
      }
    };
  }
  return docs;
}

async function runIngestionAudit() {
  console.log('=== NexusFlow Mid-Project Review: MongoDB Time-Series Ingestion Audit ===');
  await connectDb();
  const { telemetry } = getCollections();

  const beforeStats = await getTimeSeriesStats();
  const totalBatches = Math.ceil(TOTAL_DOCS / BATCH_SIZE);

  console.log(
    `Inserting ${TOTAL_DOCS.toLocaleString()} telemetry points ` +
      `(${totalBatches} batches x ${BATCH_SIZE}, concurrency=${CONCURRENCY})...`
  );

  let nextBatch = 0;
  let insertedTotal = 0;
  const start = performance.now();

  async function worker() {
    while (true) {
      const batchId = nextBatch;
      nextBatch += 1;
      if (batchId >= totalBatches) {
        return;
      }
      const remaining = TOTAL_DOCS - batchId * BATCH_SIZE;
      const size = Math.min(BATCH_SIZE, remaining);
      const docs = buildSyntheticBatch(batchId, size);
      await telemetry.insertMany(docs, { ordered: false });
      insertedTotal += size;
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const elapsedSec = (performance.now() - start) / 1000;
  const writesPerSec = Math.round(insertedTotal / elapsedSec);

  const afterStats = await getTimeSeriesStats();
  const addedStorageKb = Number(
    ((afterStats.storageSizeBytes - beforeStats.storageSizeBytes) / 1024).toFixed(2)
  );
  const bytesPerPoint =
    insertedTotal > 0
      ? Number(
          ((afterStats.storageSizeBytes - beforeStats.storageSizeBytes) / insertedTotal).toFixed(2)
        )
      : 0;

  console.log('\n--- Results ---');
  console.log(`Documents Inserted : ${insertedTotal.toLocaleString()}`);
  console.log(`Elapsed Time       : ${elapsedSec.toFixed(2)}s`);
  console.log(`Sustained Rate     : ${writesPerSec.toLocaleString()} writes/sec`);
  console.log(`Target (>= 5,000/s): ${writesPerSec >= 5000 ? 'PASS' : 'BELOW TARGET'}`);
  console.log(`Added Disk Storage : ${addedStorageKb} KB (~${bytesPerPoint} bytes/point)`);
  console.log(`Compression Ratio  : ${afterStats.compressionRatio}x`);
  console.log(`Total Collection   : ${afterStats.count.toLocaleString()} docs`);

  await closeDb();
}

runIngestionAudit().catch(async (err) => {
  console.error('Benchmark failed:', err);
  await closeDb();
  process.exit(1);
});
