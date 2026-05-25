import { sendJson, ensureTelemetryData, isSimulated, db, anomalyTable, productsTable, simDb } from '../_utils';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    await ensureTelemetryData();

    let activeAnomaliesCount = 0, criticalSeverityCount = 0, highReturnRatioCount = 0, totalRevenueStalled = 0;

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
            if (latestSnap) totalRevenueStalled += parseFloat(product.price) * latestSnap.quantityOnHand;
          }
        }
      });
    } else {
      const activeAnomalies = await db.select({ id: anomalyTable.id, productId: anomalyTable.productId, anomalyType: anomalyTable.anomalyType, severity: anomalyTable.severity, productPrice: productsTable.price }).from(anomalyTable).leftJoin(productsTable, eq(anomalyTable.productId, productsTable.id)).where(eq(anomalyTable.isResolved, false));
      activeAnomaliesCount = activeAnomalies.length;
      criticalSeverityCount = activeAnomalies.filter((a: any) => a.severity === 'critical').length;
      highReturnRatioCount = activeAnomalies.filter((a: any) => a.anomalyType === 'Excessive Return Ratio').length;
      const { sql } = await import('drizzle-orm');
      const stalledSum = await db.execute(sql`SELECT COALESCE(SUM(p.price * snap.quantity_on_hand), 0) as stalled FROM anomaly_logs al JOIN products p ON p.id = al.product_id LEFT JOIN LATERAL (SELECT quantity_on_hand FROM inventory_snapshots WHERE product_id = p.id ORDER BY snapshot_at DESC LIMIT 1) snap ON true WHERE al.anomaly_type = 'Zero Sales with Stock' AND al.is_resolved = false;`);
      totalRevenueStalled = parseFloat((stalledSum.rows[0] as any)?.stalled || '0');
    }

    return sendJson(res, 200, { activeAnomalies: activeAnomaliesCount, criticalSeverity: criticalSeverityCount, highReturnRatioRisks: highReturnRatioCount, totalRevenueStalled: Math.round(totalRevenueStalled) });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message });
  }
}
