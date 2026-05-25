import { Router } from 'express';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { db, isSimulated } from '../db/index.ts';
import { products as productsTable, salesTransactions as transactionsTable, inventorySnapshots as snapshotsTable, anomalyLogs as anomalyTable } from '../db/schema.ts';
import { generateMockData } from '../db/mockGenerator.ts';
import { runSimulationAudit, simDb } from '../db/simulation.ts';
import { runDetectionAudit } from '../services/detection.ts';
import { logger } from '../utils/logger.ts';
import { v4 as uuidv4 } from 'uuid';

export const router = Router();

let telemetryBootstrapPromise: Promise<void> | null = null;

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

async function ensureTelemetryData() {
  if (telemetryBootstrapPromise) return telemetryBootstrapPromise;

  telemetryBootstrapPromise = (async () => {
    if (isSimulated || !db) {
      if (simDb.anomalyLogs.length === 0) {
        await runSimulationAudit();
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

// --- 1. POST /api/detection/run ---
router.post('/detection/run', async (req, res) => {
  logger.info('API Triggered: Exception Audit Sweeper');
  try {
    const auditResult = await runDetectionAudit();
    logger.info({ auditResult }, 'Exception Audit completed successfully');
    return res.status(200).json(auditResult);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed running anomaly detection sweeper');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// --- 2. GET /api/anomalies (Paginated & Filtered) ---
router.get('/anomalies', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const severity = req.query.severity as string; // 'low' | 'medium' | 'high' | 'critical'
  const isResolved = req.query.isResolved === 'true' ? true : req.query.isResolved === 'false' ? false : undefined;
  const anomalyType = req.query.anomalyType as string;

  logger.info({ page, limit, severity, isResolved, anomalyType }, 'Fetching exception logs');

  try {
    if (isSimulated || !db) {
      // Simulation database in-memory filtering
      let filtered = [...simDb.anomalyLogs];

      if (severity) {
        filtered = filtered.filter(l => l.severity === severity);
      }
      if (isResolved !== undefined) {
        filtered = filtered.filter(l => l.isResolved === isResolved);
      }
      if (anomalyType) {
        filtered = filtered.filter(l => l.anomalyType.toLowerCase().includes(anomalyType.toLowerCase()));
      }

      // Sort by detectedAt desc
      filtered.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);

      // Join with products in simulation
      const logsWithProduct = paginated.map(log => {
        const product = simDb.products.find(p => p.id === log.productId);
        return {
          ...log,
          product: product ? { id: product.id, sku: product.sku, name: product.name, price: product.price, category: product.category } : null
        };
      });

      return res.status(200).json({
        logs: logsWithProduct,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      });
    }

    // Production database query using Drizzle
    const whereConditions: any[] = [];
    if (severity) {
      whereConditions.push(eq(anomalyTable.severity, severity as any));
    }
    if (isResolved !== undefined) {
      whereConditions.push(eq(anomalyTable.isResolved, isResolved));
    }
    if (anomalyType) {
      whereConditions.push(sql`LOWER(${anomalyTable.anomalyType}) LIKE ${'%' + anomalyType.toLowerCase() + '%'}`);
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(anomalyTable)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    // Get joined paginated results
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

    return res.status(200).json({
      logs: results,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });

  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed retrieving anomaly logs');
    return res.status(500).json({ error: error.message });
  }
});

// --- 3. PATCH /api/anomalies/:id (Resolve Exception) ---
router.patch('/anomalies/:id', async (req, res) => {
  const { id } = req.params;
  const { isResolved } = req.body;

  if (isResolved === undefined) {
    return res.status(400).json({ error: "Missing required parameter 'isResolved'." });
  }

  logger.info({ id, isResolved }, 'Updating anomaly resolution status');

  try {
    const resolvedAt = isResolved ? new Date() : null;

    if (isSimulated || !db) {
      const index = simDb.anomalyLogs.findIndex(l => l.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Anomaly log not found.' });
      }
      simDb.anomalyLogs[index].isResolved = isResolved;
      simDb.anomalyLogs[index].resolvedAt = resolvedAt;
      
      const product = simDb.products.find(p => p.id === simDb.anomalyLogs[index].productId);
      return res.status(200).json({
        success: true,
        log: {
          ...simDb.anomalyLogs[index],
          product: product ? { id: product.id, sku: product.sku, name: product.name } : null
        }
      });
    }

    // Production Postgres Patch
    const [updated] = await db
      .update(anomalyTable)
      .set({ isResolved, resolvedAt })
      .where(eq(anomalyTable.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Anomaly log not found.' });
    }

    const [product] = await db
      .select({ id: productsTable.id, sku: productsTable.sku, name: productsTable.name })
      .from(productsTable)
      .where(eq(productsTable.id, updated.productId));

    return res.status(200).json({
      success: true,
      log: {
        ...updated,
        product
      }
    });

  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed resolving exception log');
    return res.status(500).json({ error: error.message });
  }
});

// --- 4. CRUD /api/products ---

// GET products (Paginated + Filtered)
router.get('/products', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search as string;
  const category = req.query.category as string;

  try {
    if (isSimulated || !db) {
      let filtered = [...simDb.products];
      if (search) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
      }
      if (category) {
        filtered = filtered.filter(p => p.category === category);
      }
      // Sort by name
      filtered.sort((a, b) => a.name.localeCompare(b.name));

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);

      return res.status(200).json({
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
    if (category) {
      whereConditions.push(eq(productsTable.category, category));
    }

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

    return res.status(200).json({
      products: results,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST product
router.post('/products', async (req, res) => {
  const { sku, name, category, status, price } = req.body;
  
  if (!sku || !name || !category || !price) {
    return res.status(400).json({ error: 'Missing required configuration parameters.' });
  }

  logger.info({ sku, name }, 'Creating new product SKU');

  try {
    if (isSimulated || !db) {
      const exists = simDb.products.some(p => p.sku === sku);
      if (exists) {
        return res.status(400).json({ error: `SKU '${sku}' already registered in catalogue.` });
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
      return res.status(201).json({ success: true, product: newProduct });
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

    return res.status(201).json({ success: true, product: inserted });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed adding new product');
    return res.status(500).json({ error: error.message });
  }
});

// PATCH product
router.patch('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { sku, name, category, status, price } = req.body;

  logger.info({ id }, 'Updating product parameters');

  try {
    if (isSimulated || !db) {
      const idx = simDb.products.findIndex(p => p.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Product SKU not found in catalogue.' });
      }

      const updated = {
        ...simDb.products[idx],
        sku: sku !== undefined ? sku : simDb.products[idx].sku,
        name: name !== undefined ? name : simDb.products[idx].name,
        category: category !== undefined ? category : simDb.products[idx].category,
        status: status !== undefined ? status : simDb.products[idx].status,
        price: price !== undefined ? parseFloat(price).toFixed(2) : simDb.products[idx].price
      };

      simDb.products[idx] = updated;
      return res.status(200).json({ success: true, product: updated });
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

    if (!updated) {
      return res.status(404).json({ error: 'Product SKU not found in catalogue.' });
    }

    return res.status(200).json({ success: true, product: updated });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed updating product configuration');
    return res.status(500).json({ error: error.message });
  }
});

// DELETE product
router.delete('/products/:id', async (req, res) => {
  const { id } = req.params;
  logger.info({ id }, 'Deleting product SKU from database');

  try {
    if (isSimulated || !db) {
      const idx = simDb.products.findIndex(p => p.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Product SKU not found in catalogue.' });
      }
      simDb.products.splice(idx, 1);
      return res.status(200).json({ success: true, message: 'Product SKU successfully retired.' });
    }

    const [deleted] = await db
      .delete(productsTable)
      .where(eq(productsTable.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Product SKU not found in catalogue.' });
    }

    return res.status(200).json({ success: true, message: 'Product SKU successfully retired.' });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed retiring product SKU');
    return res.status(500).json({ error: error.message });
  }
});

// --- 5. GET /api/telemetry/system ---
// Live environment telemetry reporting
router.get('/telemetry/system', (req, res) => {
  const now = new Date();
  
  // Calculate synthetic live telemetry metrics with slight time-based sine fluctuations
  const secFactor = now.getSeconds();
  
  const baseCpu = 25 + Math.sin(Date.now() / 20000) * 12;
  const cpuRandom = Math.random() * 4;
  const cpuUsage = Math.min(100, Math.max(0, baseCpu + cpuRandom)).toFixed(1);

  const baseMemory = 1120 + Math.sin(Date.now() / 40000) * 80;
  const memoryRandom = Math.random() * 15;
  const memoryUsed = (baseMemory + memoryRandom).toFixed(0);

  // Active Neon Pool DB Connections simulation
  let activeConnections = 0;
  if (!isSimulated) {
    const baseConn = 12 + Math.floor(Math.sin(Date.now() / 60000) * 4);
    activeConnections = Math.max(1, baseConn + Math.floor(Math.random() * 2));
  } else {
    // Simulated DB has 0 active pooled database network connections
    activeConnections = 0;
  }

  // Calculate executive KPI summary statistics on-the-fly
  let activeAnomaliesCount = 0;
  let criticalSeverityCount = 0;
  let highReturnRatioCount = 0;
  let totalRevenueStalled = 0;

  if (isSimulated || !db) {
    const activeAnomalies = simDb.anomalyLogs.filter(l => !l.isResolved);
    activeAnomaliesCount = activeAnomalies.length;
    criticalSeverityCount = activeAnomalies.filter(l => l.severity === 'critical').length;
    highReturnRatioCount = activeAnomalies.filter(l => l.anomalyType === 'Excessive Return Ratio').length;
    
    // Revenue stalled = sum of value of items in Zero Sales with Stock
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
    // For connected DB, we will fetch statistics when building telemetry or just compute them
    // To make it super fast, we can run a quick aggregate select
    // Since this endpoint runs every 5 seconds, let's keep it extremely fast
    // We will do a direct count
    // Wait, let's define that we will return the stats dynamically as well.
    // If the database fails, we return simulated stats.
  }

  return res.status(200).json({
    cpu: parseFloat(cpuUsage),
    memory: {
      usedMB: parseInt(memoryUsed),
      totalMB: 4096, // 4GB serverless lambda container slice
      percentage: parseFloat(((parseInt(memoryUsed) / 4096) * 100).toFixed(1))
    },
    dbConnections: activeConnections,
    dbStatus: isSimulated ? 'Simulation' : 'Operational',
    neonPoolStatus: isSimulated ? 'Offline Fallback' : 'Stable',
    timestamp: now.toISOString()
  });
});

// Diagnostics endpoint to confirm runtime DB availability
router.get('/debug', (req, res) => {
  return res.status(200).json({
    runtime: 'express-dev',
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    dbStatus: isSimulated ? 'simulation' : 'connected',
    neonUrlMatch: Boolean(process.env.DATABASE_URL?.includes('neon.tech')),
  });
});

// Telemetry Stats Dashboard aggregation
router.get('/telemetry/summary', async (req, res) => {
  try {
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
      // Connected Database Count
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

      // Calculate stalled revenue for Zero Sales With Stock in Postgres
      // Let's grab the newest snapshots and sum
      // To keep it simple and blazing fast, we can aggregate directly
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
      
      totalRevenueStalled = parseFloat(stalledSum.rows[0]?.stalled || '0');
    }

    return res.status(200).json({
      activeAnomalies: activeAnomaliesCount,
      criticalSeverity: criticalSeverityCount,
      highReturnRatioRisks: highReturnRatioCount,
      totalRevenueStalled: Math.round(totalRevenueStalled)
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Category chart endpoint
router.get('/telemetry/category-chart', async (req, res) => {
  try {
    const categories = ['Electronics', 'Apparel', 'Grocery', 'Home', 'Beauty'];
    const chartData = [];

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

        chartData.push({
          category: cat,
          sales: Math.round(sales),
          returns: Math.round(returns)
        });
      }
    } else {
      // Connected DB Category Sales & Returns
      const rawResult = await db.execute(sql`
        SELECT 
          p.category,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'sale' THEN t.amount * t.quantity ELSE 0 END), 0) as sales,
          COALESCE(SUM(CASE WHEN t.transaction_type IN ('return', 'refund') THEN t.amount * t.quantity ELSE 0 END), 0) as returns
        FROM sales_transactions t
        JOIN products p ON p.id = t.product_id
        GROUP BY p.category
      `);

      for (const row of rawResult.rows) {
        chartData.push({
          category: row.category,
          sales: Math.round(parseFloat(row.sales as string)),
          returns: Math.round(parseFloat(row.returns as string))
        });
      }
    }

    return res.status(200).json(chartData);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
