import { sendJson, parseBody, isSimulated, db, productsTable, simDb } from '../_utils';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  try {
    const { id } = req.query;
    const { logger } = await import('../../src/utils/logger');

    if (req.method === 'PATCH') {
      const { sku, name, category, status, price } = await parseBody(req);
      logger.info({ id }, 'Updating product parameters');

      if (isSimulated || !db) {
        const idx = simDb.products.findIndex(p => p.id === id);
        if (idx === -1) return sendJson(res, 404, { error: 'Product SKU not found in catalogue.' });
        const updated = { ...simDb.products[idx], sku: sku !== undefined ? sku : simDb.products[idx].sku, name: name !== undefined ? name : simDb.products[idx].name, category: category !== undefined ? category : simDb.products[idx].category, status: status !== undefined ? status : simDb.products[idx].status, price: price !== undefined ? parseFloat(price).toFixed(2) : simDb.products[idx].price };
        simDb.products[idx] = updated;
        return sendJson(res, 200, { success: true, product: updated });
      }

      const updateFields: any = {};
      if (sku !== undefined) updateFields.sku = sku;
      if (name !== undefined) updateFields.name = name;
      if (category !== undefined) updateFields.category = category;
      if (status !== undefined) updateFields.status = status;
      if (price !== undefined) updateFields.price = parseFloat(price).toFixed(2);
      const [updated] = await db.update(productsTable).set(updateFields).where(eq(productsTable.id, id as string)).returning();
      if (!updated) return sendJson(res, 404, { error: 'Product SKU not found in catalogue.' });
      return sendJson(res, 200, { success: true, product: updated });
    }

    if (req.method === 'DELETE') {
      logger.info({ id }, 'Deleting product SKU from database');
      if (isSimulated || !db) {
        const idx = simDb.products.findIndex(p => p.id === id);
        if (idx === -1) return sendJson(res, 404, { error: 'Product SKU not found in catalogue.' });
        simDb.products.splice(idx, 1);
        return sendJson(res, 200, { success: true, message: 'Product SKU successfully retired.' });
      }
      const [deleted] = await db.delete(productsTable).where(eq(productsTable.id, id as string)).returning();
      if (!deleted) return sendJson(res, 404, { error: 'Product SKU not found in catalogue.' });
      return sendJson(res, 200, { success: true, message: 'Product SKU successfully retired.' });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message });
  }
}
