import { eq, desc, and, or, sql } from 'drizzle-orm';
import { db, isSimulated } from '../src/db/index.ts';
import { products as productsTable, salesTransactions as transactionsTable, inventorySnapshots as snapshotsTable, anomalyLogs as anomalyTable } from '../src/db/schema.ts';
import { generateMockData } from '../src/db/mockGenerator.ts';
import { simDb } from '../src/db/simulation.ts';
import { runDetectionAudit } from '../src/services/detection.ts';
import { logger } from '../src/utils/logger.ts';
import { v4 as uuidv4 } from 'uuid';

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

let telemetryBootstrapPromise: Promise<void> | null = null;

async function ensureTelemetryData() {
  if (telemetryBootstrapPromise) return telemetryBootstrapPromise;

  telemetryBootstrapPromise = (async () => {
    if (isSimulated || !db) {
      if (simDb.anomalyLogs.length === 0) {
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
      await runDetectionAudit();
    }
  })();

  try {
    await telemetryBootstrapPromise;
  } finally {
    telemetryBootstrapPromise = null;
  }
}

const sendJson = (res: any, status: number, payload: any) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const parseBody = async (req: any) => {
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

const getUrl = (req: any) => new URL(req.url || '/', 'http://localhost');

export default async function handler(req: any, res: any) {
  try {
    const url = getUrl(req);
    const segments = url.pathname.split('/').filter(Boolean);
    const method = String(req.method || 'GET').toUpperCase();

    if (segments[0] !== 'api') {
      return sendJson(res, 404, { error: 'Not found' });
    }

    if (segments.length === 3 && segments[1] === 'detection' && segments[2] === 'run' && method === 'POST') {
      logger.info('API Triggered: Exception Audit Sweeper');
      const auditResult = await runDetectionAudit();
      logger.info({ auditResult }, 'Exception Audit completed successfully');
      return sendJson(res, 200, auditResult);
    }

    if (segments.length === 3 && segments[1] === 'telemetry' && segments[2] === 'system' && method === 'GET') {
      const now = new Date();
      const baseCpu = 25 + Math.sin(Date.now() / 20000) * 12;
      const cpuRandom = Math.random() * 4;
      const cpuUsage = Math.min(100, Math.max(0, baseCpu + cpuRandom)).toFixed(1);

      const baseMemory = 1120 + Math.sin(Date.now() / 40000) * 80;
      const memoryRandom = Math.random() * 15;
      const memoryUsed = (baseMemory + memoryRandom).toFixed(0);

      const activeConnections = isSimulated || !db ? 0 : 1;

      return sendJson(res, 200, {
        cpu: parseFloat(cpuUsage),
        memory: {
          usedMB: parseInt(memoryUsed),
          totalMB: 4096,
          percentage: parseFloat(((parseInt(memoryUsed) / 4096) * 100).toFixed(1))
        },
        dbConnections: activeConnections,
        dbStatus: isSimulated ? 'Simulation' : 'Operational',
        neonPoolStatus: isSimulated ? 'Offline Fallback' : 'Stable',
        timestamp: now.toISOString()
      });
    }

    if (segments.length === 3 && segments[1] === 'telemetry' && segments[2] === 'summary' && method === 'GET') {
      await ensureTelemetryData();

      let activeAnomaliesCount = 0;
      let criticalSeverityCount = 0;
      let highReturnRatioCount = 0;
      let totalRevenueStalled = 0;

      if (isSimulated || !db) {
        const activeAnomalies = simDb.anomalyLogs.filter(l => !l.isResolved);
        activeAnomaliesCount = activeAnomalies.length;
        criticalSeverityCount = activeAnomalies.filter(l => l.severity === 'critical').length;
        highReturnRatioCount = activeAnomalies.filter(l => l.anomalyType === 'Excessive Return Ratio').length;

        activeAnomalies.forEach(anomaly => {
          if (anomaly.anomalyType === 'Zero Sales with Stock') {
            const product = simDb.products.find(p => p.id === anomaly.productId);
            if (product) {
              const snaps = simDb.snapshots.filter(s => s.productId === product.id);
              const latestSnap = snaps.length > 0 ? snaps.reduce((l, c) => c.snapshotAt > l.snapshotAt ? c : l, snaps[0]) : null;
              if (latestSnap) {
                totalRevenueStalled += parseFloat(product.price) * latestSnap.quantityOnHand;
              }
            }
          }
        });
      } else {
        const activeAnomalies = await db
          .select({
            id: anomalyTable.id,
            productId: anomalyTable.productId,
            anomalyType: anomalyTable.anomalyType,
            severity: anomalyTable.severity,
            productPrice: productsTable.price
          })
          .from(anomalyTable)
          .leftJoin(productsTable, eq(anomalyTable.productId, productsTable.id))
          .where(eq(anomalyTable.isResolved, false));

        activeAnomaliesCount = activeAnomalies.length;
        criticalSeverityCount = activeAnomalies.filter((a: any) => a.severity === 'critical').length;
        highReturnRatioCount = activeAnomalies.filter((a: any) => a.anomalyType === 'Excessive Return Ratio').length;

        const stalledSum = await db.execute(sql`
          SELECT COALESCE(SUM(p.price * snap.quantity_on_hand), 0) as stalled
          FROM anomaly_logs al
          JOIN products p ON p.id = al.product_id
          LEFT JOIN LATERAL (
            SELECT quantity_on_hand
            FROM inventory_snapshots
            WHERE product_id = p.id
            ORDER BY snapshot_at DESC
            LIMIT 1
          ) snap ON true
          WHERE al.anomaly_type = 'Zero Sales with Stock' AND al.is_resolved = false;
        `);

        totalRevenueStalled = parseFloat((stalledSum.rows[0] as any)?.stalled || '0');
      }

      return sendJson(res, 200, {
        activeAnomalies: activeAnomaliesCount,
        criticalSeverity: criticalSeverityCount,
        highReturnRatioRisks: highReturnRatioCount,
        totalRevenueStalled: Math.round(totalRevenueStalled)
      });
    }

    if (segments.length === 3 && segments[1] === 'telemetry' && segments[2] === 'category-chart' && method === 'GET') {
      await ensureTelemetryData();
      const categories = ['Electronics', 'Apparel', 'Grocery', 'Home', 'Beauty'];
      const chartData: Array<{ category: string; sales: number; returns: number }> = [];

      if (isSimulated || !db) {
        for (const cat of categories) {
          const catProds = simDb.products.filter(p => p.category === cat);
          const prodIds = new Set(catProds.map(p => p.id));
          const catTrans = simDb.transactions.filter(t => prodIds.has(t.productId));

          const sales = catTrans
            .filter(t => t.transactionType === 'sale')
            .reduce((sum, t) => sum + parseFloat(t.amount) * t.quantity, 0);

          const returns = catTrans
            .filter(t => t.transactionType === 'return' || t.transactionType === 'refund')
            .reduce((sum, t) => sum + parseFloat(t.amount) * t.quantity, 0);

          chartData.push({ category: cat, sales: Math.round(sales), returns: Math.round(returns) });
        }
      } else {
        const rawResult = await db.execute(sql`
          SELECT 
            p.category,
            COALESCE(SUM(CASE WHEN t.transaction_type = 'sale' THEN t.amount * t.quantity ELSE 0 END), 0) as sales,
            COALESCE(SUM(CASE WHEN t.transaction_type IN ('return', 'refund') THEN t.amount * t.quantity ELSE 0 END), 0) as returns
          FROM sales_transactions t
          JOIN products p ON p.id = t.product_id
          GROUP BY p.category
        `);

        for (const row of rawResult.rows as any[]) {
          chartData.push({
            category: row.category,
            sales: Math.round(parseFloat(row.sales as string)),
            returns: Math.round(parseFloat(row.returns as string))
          });
        }
      }

      return sendJson(res, 200, chartData);
    }

    if (segments.length === 2 && segments[1] === 'anomalies' && method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const offset = (page - 1) * limit;
      const severity = url.searchParams.get('severity') || '';
      const isResolvedParam = url.searchParams.get('isResolved');
      const anomalyType = url.searchParams.get('anomalyType') || '';

      logger.info({ page, limit, severity, isResolved: isResolvedParam, anomalyType }, 'Fetching exception logs');

      await ensureTelemetryData();

      if (isSimulated || !db) {
        let filtered = [...simDb.anomalyLogs];

        if (severity) filtered = filtered.filter(l => l.severity === severity);
        if (isResolvedParam === 'true') filtered = filtered.filter(l => l.isResolved === true);
        if (isResolvedParam === 'false') filtered = filtered.filter(l => l.isResolved === false);
        if (anomalyType) filtered = filtered.filter(l => l.anomalyType.toLowerCase().includes(anomalyType.toLowerCase()));

        filtered.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

        const total = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);
        const logsWithProduct = paginated.map(log => {
          const product = simDb.products.find(p => p.id === log.productId);
          return {
            ...log,
            product: product ? { id: product.id, sku: product.sku, name: product.name, price: product.price, category: product.category } : null
          };
        });

        return sendJson(res, 200, {
          logs: logsWithProduct,
          pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
      }

      const whereConditions: any[] = [];
      if (severity) whereConditions.push(eq(anomalyTable.severity, severity as any));
      if (isResolvedParam === 'true') whereConditions.push(eq(anomalyTable.isResolved, true));
      if (isResolvedParam === 'false') whereConditions.push(eq(anomalyTable.isResolved, false));
      if (anomalyType) whereConditions.push(sql`LOWER(${anomalyTable.anomalyType}) LIKE ${'%' + anomalyType.toLowerCase() + '%'}`);

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(anomalyTable)
        .where(whereClause);

      const total = Number(countResult?.count || 0);

      const results = await db
        .select({
          id: anomalyTable.id,
          productId: anomalyTable.productId,
          anomalyType: anomalyTable.anomalyType,
          severity: anomalyTable.severity,
          description: anomalyTable.description,
          isResolved: anomalyTable.isResolved,
          detectedAt: anomalyTable.detectedAt,
          resolvedAt: anomalyTable.resolvedAt,
          product: {
            id: productsTable.id,
            sku: productsTable.sku,
            name: productsTable.name,
            price: productsTable.price,
            category: productsTable.category
          }
        })
        .from(anomalyTable)
        .leftJoin(productsTable, eq(anomalyTable.productId, productsTable.id))
        .where(whereClause)
        .orderBy(desc(anomalyTable.detectedAt))
        .limit(limit)
        .offset(offset);

      return sendJson(res, 200, {
        logs: results,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      });
    }

    if (segments.length === 3 && segments[1] === 'anomalies' && method === 'PATCH') {
      const id = segments[2];
      const { isResolved } = await parseBody(req);

      if (isResolved === undefined) {
        return sendJson(res, 400, { error: "Missing required parameter 'isResolved'." });
      }

      logger.info({ id, isResolved }, 'Updating anomaly resolution status');
      const resolvedAt = isResolved ? new Date() : null;

      if (isSimulated || !db) {
        const index = simDb.anomalyLogs.findIndex(l => l.id === id);
        if (index === -1) return sendJson(res, 404, { error: 'Anomaly log not found.' });

        simDb.anomalyLogs[index].isResolved = isResolved;
        simDb.anomalyLogs[index].resolvedAt = resolvedAt;

        const product = simDb.products.find(p => p.id === simDb.anomalyLogs[index].productId);
        return sendJson(res, 200, {
          success: true,
          log: {
            ...simDb.anomalyLogs[index],
            product: product ? { id: product.id, sku: product.sku, name: product.name } : null
          }
        });
      }

      const [updated] = await db
        .update(anomalyTable)
        .set({ isResolved, resolvedAt })
        .where(eq(anomalyTable.id, id))
        .returning();

      if (!updated) return sendJson(res, 404, { error: 'Anomaly log not found.' });

      const [product] = await db
        .select({ id: productsTable.id, sku: productsTable.sku, name: productsTable.name })
        .from(productsTable)
        .where(eq(productsTable.id, updated.productId));

      return sendJson(res, 200, {
        success: true,
        log: {
          ...updated,
          product
        }
      });
    }

    if (segments.length === 2 && segments[1] === 'products' && method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const offset = (page - 1) * limit;
      const search = url.searchParams.get('search') || '';
      const category = url.searchParams.get('category') || '';

      await ensureTelemetryData();

      if (isSimulated || !db) {
        let filtered = [...simDb.products];
        if (search) {
          filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
        }
        if (category) filtered = filtered.filter(p => p.category === category);
        filtered.sort((a, b) => a.name.localeCompare(b.name));

        const total = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);

        return sendJson(res, 200, {
          products: paginated,
          pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
      }

      const whereConditions: any[] = [];
      if (search) {
        whereConditions.push(
          or(
            sql`LOWER(${productsTable.name}) LIKE ${'%' + search.toLowerCase() + '%'}`,
            sql`LOWER(${productsTable.sku}) LIKE ${'%' + search.toLowerCase() + '%'}`
          )
        );
      }
      if (category) whereConditions.push(eq(productsTable.category, category));

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(productsTable)
        .where(whereClause);

      const total = Number(countResult?.count || 0);

      const results = await db
        .select()
        .from(productsTable)
        .where(whereClause)
        .orderBy(productsTable.name)
        .limit(limit)
        .offset(offset);

      return sendJson(res, 200, {
        products: results,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      });
    }

    if (segments.length === 2 && segments[1] === 'products' && method === 'POST') {
      const { sku, name, category, status, price } = await parseBody(req);

      if (!sku || !name || !category || !price) {
        return sendJson(res, 400, { error: 'Missing required configuration parameters.' });
      }

      logger.info({ sku, name }, 'Creating new product SKU');

      if (isSimulated || !db) {
        const exists = simDb.products.some(p => p.sku === sku);
        if (exists) {
          return sendJson(res, 400, { error: `SKU '${sku}' already registered in catalogue.` });
        }

        const newProduct = {
          id: uuidv4(),
          sku,
          name,
          category,
          status: status || 'active',
          price: parseFloat(price).toFixed(2),
          createdAt: new Date()
        };
        simDb.products.push(newProduct);
        return sendJson(res, 201, { success: true, product: newProduct });
      }

      const [inserted] = await db
        .insert(productsTable)
        .values({
          sku,
          name,
          category,
          status: status || 'active',
          price: parseFloat(price).toFixed(2)
        })
        .returning();

      return sendJson(res, 201, { success: true, product: inserted });
    }

    if (segments.length === 3 && segments[1] === 'products' && method === 'PATCH') {
      const id = segments[2];
      const { sku, name, category, status, price } = await parseBody(req);

      logger.info({ id }, 'Updating product parameters');

      if (isSimulated || !db) {
        const idx = simDb.products.findIndex(p => p.id === id);
        if (idx === -1) return sendJson(res, 404, { error: 'Product SKU not found in catalogue.' });

        const updated = {
          ...simDb.products[idx],
          sku: sku !== undefined ? sku : simDb.products[idx].sku,
          name: name !== undefined ? name : simDb.products[idx].name,
          category: category !== undefined ? category : simDb.products[idx].category,
          status: status !== undefined ? status : simDb.products[idx].status,
          price: price !== undefined ? parseFloat(price).toFixed(2) : simDb.products[idx].price
        };

        simDb.products[idx] = updated;
        return sendJson(res, 200, { success: true, product: updated });
      }

      const updateFields: any = {};
      if (sku !== undefined) updateFields.sku = sku;
      if (name !== undefined) updateFields.name = name;
      if (category !== undefined) updateFields.category = category;
      if (status !== undefined) updateFields.status = status;
      if (price !== undefined) updateFields.price = parseFloat(price).toFixed(2);

      const [updated] = await db
        .update(productsTable)
        .set(updateFields)
        .where(eq(productsTable.id, id))
        .returning();

      if (!updated) return sendJson(res, 404, { error: 'Product SKU not found in catalogue.' });

      return sendJson(res, 200, { success: true, product: updated });
    }

    if (segments.length === 3 && segments[1] === 'products' && method === 'DELETE') {
      const id = segments[2];
      logger.info({ id }, 'Deleting product SKU from database');

      if (isSimulated || !db) {
        const idx = simDb.products.findIndex(p => p.id === id);
        if (idx === -1) return sendJson(res, 404, { error: 'Product SKU not found in catalogue.' });
        simDb.products.splice(idx, 1);
        return sendJson(res, 200, { success: true, message: 'Product SKU successfully retired.' });
      }

      const [deleted] = await db
        .delete(productsTable)
        .where(eq(productsTable.id, id))
        .returning();

      if (!deleted) return sendJson(res, 404, { error: 'Product SKU not found in catalogue.' });

      return sendJson(res, 200, { success: true, message: 'Product SKU successfully retired.' });
    }

    return sendJson(res, 404, { error: 'API route not found' });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Serverless API error');
    return sendJson(res, 500, { error: error.message });
  }
}
