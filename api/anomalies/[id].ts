import { sendJson, parseBody, isSimulated, db, anomalyTable, productsTable, simDb } from '../_utils';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  try {
    const { id } = req.query;
    const { logger } = await import('../../src/utils/logger');

    if (req.method !== 'PATCH') return sendJson(res, 405, { error: 'Method not allowed' });

    const { isResolved } = await parseBody(req);
    if (isResolved === undefined) return sendJson(res, 400, { error: "Missing required parameter 'isResolved'." });

    logger.info({ id, isResolved }, 'Updating anomaly resolution status');
    const resolvedAt = isResolved ? new Date() : null;

    if (isSimulated || !db) {
      const index = simDb.anomalyLogs.findIndex(l => l.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'Anomaly log not found.' });
      simDb.anomalyLogs[index].isResolved = isResolved;
      simDb.anomalyLogs[index].resolvedAt = resolvedAt;
      const product = simDb.products.find(p => p.id === simDb.anomalyLogs[index].productId);
      return sendJson(res, 200, { success: true, log: { ...simDb.anomalyLogs[index], product: product ? { id: product.id, sku: product.sku, name: product.name } : null } });
    }

    const [updated] = await db.update(anomalyTable).set({ isResolved, resolvedAt }).where(eq(anomalyTable.id, id as string)).returning();
    if (!updated) return sendJson(res, 404, { error: 'Anomaly log not found.' });
    const [product] = await db.select({ id: productsTable.id, sku: productsTable.sku, name: productsTable.name }).from(productsTable).where(eq(productsTable.id, updated.productId));
    return sendJson(res, 200, { success: true, log: { ...updated, product } });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message });
  }
}
