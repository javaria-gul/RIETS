import { generateMockData, Product, SalesTransaction, InventorySnapshot, AnomalyLog } from './mockGenerator.ts';
import { v4 as uuidv4 } from 'uuid';

const initialData = generateMockData();

export const simDb = {
  users: [
    {
      id: uuidv4(),
      email: 'admin@riets.com',
      passwordHash: '$2b$12$4vD4yA4mZgYhC1QcPlxZue4i6yXkUq8R4kL1T6C7P4a6G7F4y5wZu', // dummy hash
      role: 'admin' as const
    },
    {
      id: uuidv4(),
      email: 'analyst@riets.com',
      passwordHash: '$2b$12$4vD4yA4mZgYhC1QcPlxZue4i6yXkUq8R4kL1T6C7P4a6G7F4y5wZu',
      role: 'analyst' as const
    }
  ],
  products: initialData.products,
  transactions: initialData.transactions,
  snapshots: initialData.snapshots,
  anomalyLogs: [] as AnomalyLog[]
};

// 5 Anomaly Detection Engines in Memory
export function runSimulationAudit(): AnomalyLog[] {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const newLogs: AnomalyLog[] = [];

  // Helper to check idempotency guard (active, unresolved alert within 7 days)
  const isDuplicate = (productId: string, type: string) => {
    return simDb.anomalyLogs.some(log => 
      log.productId === productId && 
      log.anomalyType === type && 
      !log.isResolved && 
      log.detectedAt >= sevenDaysAgo
    );
  };

  // Helper to get latest inventory snapshot for a product
  const getLatestSnapshot = (productId: string) => {
    const snaps = simDb.snapshots.filter(s => s.productId === productId);
    if (snaps.length === 0) return null;
    return snaps.reduce((latest, current) => 
      current.snapshotAt > latest.snapshotAt ? current : latest, snaps[0]
    );
  };

  // --- ENGINE 1: Zero Sales with Stock ---
  // Active products with massive inventory (>100) but zero sales over the last 30 days.
  simDb.products.forEach(product => {
    if (product.status !== 'active') return;
    
    const latestSnap = getLatestSnapshot(product.id);
    if (!latestSnap || latestSnap.quantityOnHand <= 100) return;

    // Check sales in last 30 days
    const hasSales = simDb.transactions.some(t => 
      t.productId === product.id && 
      t.transactionType === 'sale' && 
      t.transactedAt >= thirtyDaysAgo
    );

    if (!hasSales) {
      const type = 'Zero Sales with Stock';
      if (!isDuplicate(product.id, type)) {
        newLogs.push({
          id: uuidv4(),
          productId: product.id,
          anomalyType: type,
          severity: 'critical',
          description: `Product '${product.name}' is active with a massive inventory of ${latestSnap.quantityOnHand} units, but has zero sales registered in the last 30 days.`,
          isResolved: false,
          detectedAt: new Date(),
          resolvedAt: null
        });
      }
    }
  });

  // --- ENGINE 2: Sales Drop ---
  // Variance between current 14 days and prior 14 days. Critical (>75% drop) and High (>50%) metrics.
  simDb.products.forEach(product => {
    // Current period sales (last 14 days)
    const currentSales = simDb.transactions
      .filter(t => t.productId === product.id && t.transactionType === 'sale' && t.transactedAt >= fourteenDaysAgo)
      .reduce((sum, t) => sum + parseFloat(t.amount) * t.quantity, 0);

    // Prior period sales (days -28 to -14)
    const priorSales = simDb.transactions
      .filter(t => t.productId === product.id && t.transactionType === 'sale' && t.transactedAt >= twentyEightDaysAgo && t.transactedAt < fourteenDaysAgo)
      .reduce((sum, t) => sum + parseFloat(t.amount) * t.quantity, 0);

    // We only care if prior sales were significant (e.g. > $100) to avoid noise on products that naturally sell little
    if (priorSales > 100) {
      const dropRatio = (priorSales - currentSales) / priorSales;
      if (dropRatio >= 0.50) {
        const severity = dropRatio >= 0.75 ? 'critical' : 'high';
        const type = 'Significant Sales Drop';
        if (!isDuplicate(product.id, type)) {
          newLogs.push({
            id: uuidv4(),
            productId: product.id,
            anomalyType: type,
            severity: severity as any,
            description: `Product '${product.name}' experienced a ${(dropRatio * 100).toFixed(1)}% sales volume crash in the current 14-day window ($${currentSales.toFixed(2)}) compared to the prior 14 days ($${priorSales.toFixed(2)}).`,
            isResolved: false,
            detectedAt: new Date(),
            resolvedAt: null
          });
        }
      }
    }
  });

  // --- ENGINE 3: Negative Inventory ---
  // Catches negative quantities on latest snapshots.
  simDb.products.forEach(product => {
    const latestSnap = getLatestSnapshot(product.id);
    if (latestSnap && latestSnap.quantityOnHand < 0) {
      const type = 'Negative Inventory Balance';
      if (!isDuplicate(product.id, type)) {
        newLogs.push({
          id: uuidv4(),
          productId: product.id,
          anomalyType: type,
          severity: 'high',
          description: `Product '${product.name}' has a critical administrative exception: current stock level is negative (${latestSnap.quantityOnHand} units) on the latest snapshot.`,
          isResolved: false,
          detectedAt: new Date(),
          resolvedAt: null
        });
      }
    }
  });

  // --- ENGINE 4: Inactive Product Sold ---
  // Joins inactive/discontinued statuses against transaction pools in the last 7 days.
  simDb.products.forEach(product => {
    if (product.status === 'active') return;

    const recentTrans = simDb.transactions.filter(t => 
      t.productId === product.id && 
      t.transactedAt >= sevenDaysAgo
    );

    if (recentTrans.length > 0) {
      const type = 'Inactive Product Sales';
      if (!isDuplicate(product.id, type)) {
        const salesCount = recentTrans.filter(t => t.transactionType === 'sale').length;
        if (salesCount > 0) {
          newLogs.push({
            id: uuidv4(),
            productId: product.id,
            anomalyType: type,
            severity: 'critical',
            description: `Product '${product.name}' has status '${product.status}' but processed ${salesCount} transaction(s) in the last 7 days.`,
            isResolved: false,
            detectedAt: new Date(),
            resolvedAt: null
          });
        }
      }
    }
  });

  // --- ENGINE 5: High Return Ratio ---
  // Return volume exceeding 45% of gross sales volume.
  simDb.products.forEach(product => {
    const prodTrans = simDb.transactions.filter(t => t.productId === product.id);
    
    const grossSalesAmount = prodTrans
      .filter(t => t.transactionType === 'sale')
      .reduce((sum, t) => sum + parseFloat(t.amount) * t.quantity, 0);

    const returnsAmount = prodTrans
      .filter(t => t.transactionType === 'return')
      .reduce((sum, t) => sum + parseFloat(t.amount) * t.quantity, 0);

    if (grossSalesAmount > 200) {
      const returnRatio = returnsAmount / grossSalesAmount;
      if (returnRatio > 0.45) {
        const type = 'Excessive Return Ratio';
        if (!isDuplicate(product.id, type)) {
          newLogs.push({
            id: uuidv4(),
            productId: product.id,
            anomalyType: type,
            severity: 'high',
            description: `Product '${product.name}' has returned goods amounting to $${returnsAmount.toFixed(2)}, which constitutes ${(returnRatio * 100).toFixed(1)}% of gross sales volume ($${grossSalesAmount.toFixed(2)}).`,
            isResolved: false,
            detectedAt: new Date(),
            resolvedAt: null
          });
        }
      }
    }
  });

  // Push new logs to in-memory db
  simDb.anomalyLogs.push(...newLogs);
  return newLogs;
}
