import { sendJson, parseBody, ensureTelemetryData, isSimulated, db, anomalyTable, productsTable, simDb } from '../_utils';
import { eq, desc, and, sql } from 'drizzle-orm';

const getUrl = (req: any) => new URL(req.url || '/', 'http://localhost');

export default async function handler(req: any, res: any) {
  try {
    const url = getUrl(req);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const severity = url.searchParams.get('severity') || '';
    const isResolvedParam = url.searchParams.get('isResolved');
    const anomalyType = url.searchParams.get('anomalyType') || '';

    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

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
      const logsWithProduct = paginated.map(log => ({
        ...log,
        product: simDb.products.find(p => p.id === log.productId) || null
      }));
      return sendJson(res, 200, { logs: logsWithProduct, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    }

    const whereConditions: any[] = [];
    if (severity) whereConditions.push(eq(anomalyTable.severity, severity as any));
    if (isResolvedParam === 'true') whereConditions.push(eq(anomalyTable.isResolved, true));
    if (isResolvedParam === 'false') whereConditions.push(eq(anomalyTable.isResolved, false));
    if (anomalyType) whereConditions.push(sql`LOWER(${anomalyTable.anomalyType}) LIKE ${'%' + anomalyType.toLowerCase() + '%'}`);

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(anomalyTable).where(whereClause);
    const total = Number(countResult?.count || 0);
    const results = await db.select({ id: anomalyTable.id, productId: anomalyTable.productId, anomalyType: anomalyTable.anomalyType, severity: anomalyTable.severity, description: anomalyTable.description, isResolved: anomalyTable.isResolved, detectedAt: anomalyTable.detectedAt, resolvedAt: anomalyTable.resolvedAt, product: { id: productsTable.id, sku: productsTable.sku, name: productsTable.name, price: productsTable.price, category: productsTable.category } }).from(anomalyTable).leftJoin(productsTable, eq(anomalyTable.productId, productsTable.id)).where(whereClause).orderBy(desc(anomalyTable.detectedAt)).limit(limit).offset(offset);

    return sendJson(res, 200, { logs: results, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message });
  }
}
