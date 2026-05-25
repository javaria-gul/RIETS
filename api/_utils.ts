import { eq, desc, and, or, sql } from 'drizzle-orm';
import { db, isSimulated } from '../src/db/index';
import { products as productsTable, salesTransactions as transactionsTable, inventorySnapshots as snapshotsTable, anomalyLogs as anomalyTable } from '../src/db/schema';
import { generateMockData } from '../src/db/mockGenerator';
import { simDb } from '../src/db/simulation';
import { logger } from '../src/utils/logger';

export const sendJson = (res: any, status: number, payload: any) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

export const parseBody = async (req: any) => {
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise<any>((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
};

export const getUrl = (req: any) => new URL(req.url || '/', 'http://localhost');

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

let telemetryBootstrapPromise: Promise<void> | null = null;

export async function ensureTelemetryData() {
  if (telemetryBootstrapPromise) return telemetryBootstrapPromise;

  telemetryBootstrapPromise = (async () => {
    if (isSimulated || !db) {
      if (simDb.anomalyLogs.length === 0) {
        const { runDetectionAudit } = await import('../src/services/detection');
        await runDetectionAudit();
      }
      return;
    }

    const [productsCount, transactionsCount, snapshotsCount, anomaliesCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(productsTable),
      db.select({ count: sql<number>`count(*)` }).from(transactionsTable),
      db.select({ count: sql<number>`count(*)` }).from(snapshotsTable),
      db.select({ count: sql<number>`count(*)` }).from(anomalyTable),
    ]);

    const productTotal = Number(productsCount[0]?.count || 0);
    const transactionTotal = Number(transactionsCount[0]?.count || 0);
    const snapshotTotal = Number(snapshotsCount[0]?.count || 0);
    const anomalyTotal = Number(anomaliesCount[0]?.count || 0);

    const databaseLooksEmpty = productTotal === 0 || transactionTotal === 0 || snapshotTotal === 0;

    if (databaseLooksEmpty) {
      logger.warn('Telemetry bootstrap detected an empty database. Seeding demo data automatically.');
      const { products, transactions, snapshots } = generateMockData();

      for (const ch of chunk(products, 100)) {
        await db.insert(productsTable).values(ch);
      }
      for (const ch of chunk(snapshots, 500)) {
        await db.insert(snapshotsTable).values(ch);
      }
      for (const ch of chunk(transactions, 1000)) {
        await db.insert(transactionsTable).values(ch);
      }
    }

    if (anomalyTotal === 0 || databaseLooksEmpty) {
      const { runDetectionAudit } = await import('../src/services/detection');
      await runDetectionAudit();
    }
  })();

  try {
    await telemetryBootstrapPromise;
  } finally {
    telemetryBootstrapPromise = null;
  }
}

export { db, isSimulated, productsTable, transactionsTable, snapshotsTable, anomalyTable, simDb };
