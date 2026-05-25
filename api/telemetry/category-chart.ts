import { sendJson, ensureTelemetryData, isSimulated, db, simDb } from '../_utils';
import { sql } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    await ensureTelemetryData();
    const categories = ['Electronics', 'Apparel', 'Grocery', 'Home', 'Beauty'];
    const chartData: Array<{ category: string; sales: number; returns: number }> = [];

    if (isSimulated || !db) {
      for (const cat of categories) {
        const catProds = simDb.products.filter(p => p.category === cat);
        const prodIds = new Set(catProds.map(p => p.id));
        const catTrans = simDb.transactions.filter(t => prodIds.has(t.productId));
        const sales = catTrans.filter(t => t.transactionType === 'sale').reduce((sum, t) => sum + parseFloat(t.amount) * t.quantity, 0);
        const returns = catTrans.filter(t => t.transactionType === 'return' || t.transactionType === 'refund').reduce((sum, t) => sum + parseFloat(t.amount) * t.quantity, 0);
        chartData.push({ category: cat, sales: Math.round(sales), returns: Math.round(returns) });
      }
    } else {
      const rawResult = await db.execute(sql`SELECT p.category, COALESCE(SUM(CASE WHEN t.transaction_type = 'sale' THEN t.amount * t.quantity ELSE 0 END), 0) as sales, COALESCE(SUM(CASE WHEN t.transaction_type IN ('return', 'refund') THEN t.amount * t.quantity ELSE 0 END), 0) as returns FROM sales_transactions t JOIN products p ON p.id = t.product_id GROUP BY p.category`);
      for (const row of rawResult.rows as any[]) {
        chartData.push({ category: row.category, sales: Math.round(parseFloat(row.sales as string)), returns: Math.round(parseFloat(row.returns as string)) });
      }
    }

    return sendJson(res, 200, chartData);
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message });
  }
}
