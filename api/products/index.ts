import { sendJson, parseBody, ensureTelemetryData, isSimulated, db, productsTable, simDb } from '../_utils';
import { eq, or, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const getUrl = (req: any) => new URL(req.url || '/', 'http://localhost');

export default async function handler(req: any, res: any) {
  try {
    const url = getUrl(req);
    const { logger } = await import('../../src/utils/logger');

    if (req.method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const offset = (page - 1) * limit;
      const search = url.searchParams.get('search') || '';
      const category = url.searchParams.get('category') || '';

      await ensureTelemetryData();

      if (isSimulated || !db) {
        let filtered = [...simDb.products];
        if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
        if (category) filtered = filtered.filter(p => p.category === category);
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        const total = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);
        return sendJson(res, 200, { products: paginated, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
      }

      const whereConditions: any[] = [];
      if (search) whereConditions.push(or(sql`LOWER(${productsTable.name}) LIKE ${'%' + search.toLowerCase() + '%'}`, sql`LOWER(${productsTable.sku}) LIKE ${'%' + search.toLowerCase() + '%'}`));
      if (category) whereConditions.push(eq(productsTable.category, category));
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
      const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(whereClause);
      const total = Number(countResult?.count || 0);
      const results = await db.select().from(productsTable).where(whereClause).orderBy(productsTable.name).limit(limit).offset(offset);
      return sendJson(res, 200, { products: results, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    }

    if (req.method === 'POST') {
      const { sku, name, category, status, price } = await parseBody(req);
      if (!sku || !name || !category || !price) return sendJson(res, 400, { error: 'Missing required configuration parameters.' });

      logger.info({ sku, name }, 'Creating new product SKU');
      if (isSimulated || !db) {
        if (simDb.products.some(p => p.sku === sku)) return sendJson(res, 400, { error: `SKU '${sku}' already registered in catalogue.` });
        const newProduct = { id: uuidv4(), sku, name, category, status: status || 'active', price: parseFloat(price).toFixed(2), createdAt: new Date() };
        simDb.products.push(newProduct);
        return sendJson(res, 201, { success: true, product: newProduct });
      }
      const [inserted] = await db.insert(productsTable).values({ sku, name, category, status: status || 'active', price: parseFloat(price).toFixed(2) }).returning();
      return sendJson(res, 201, { success: true, product: inserted });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message });
  }
}
