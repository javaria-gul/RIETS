import { sql } from 'drizzle-orm';
import { db, isSimulated } from '../db/index.ts';
import { runSimulationAudit, simDb } from '../db/simulation.ts';

export async function runDetectionAudit() {
  if (isSimulated || !db) {
    console.log('⚡ Running Anomaly Core in SIMULATION mode (in-memory state)...');
    const newLogs = runSimulationAudit();
    return {
      success: true,
      mode: 'simulation',
      insertedCount: newLogs.length,
      logs: newLogs,
    };
  }

  console.log('⚡ Running Anomaly Core in PRODUCTION mode executing raw SQL against Postgres...');
  
  // Define 5 Engine SQL Queries
  const engine1Query = sql`
    INSERT INTO anomaly_logs (id, product_id, anomaly_type, severity, description, is_resolved, detected_at, resolved_at)
    SELECT 
      gen_random_uuid() as id,
      p.id as product_id,
      'Zero Sales with Stock' as anomaly_type,
      'critical'::anomaly_severity as severity,
      'Product ''' || p.name || ''' (SKU: ' || p.sku || ') has a massive inventory of ' || snap.quantity_on_hand || ' units, but has zero sales registered in the last 30 days.' as description,
      false as is_resolved,
      NOW() as detected_at,
      NULL as resolved_at
    FROM products p
    LEFT JOIN LATERAL (
      SELECT quantity_on_hand, snapshot_at
      FROM inventory_snapshots
      WHERE product_id = p.id
      ORDER BY snapshot_at DESC
      LIMIT 1
    ) snap ON true
    WHERE p.status = 'active'
      AND snap.quantity_on_hand > 100
      AND NOT EXISTS (
        SELECT 1 FROM sales_transactions t
        WHERE t.product_id = p.id
          AND t.transaction_type = 'sale'
          AND t.transacted_at >= NOW() - INTERVAL '30 days'
      )
      AND NOT EXISTS (
        SELECT 1 FROM anomaly_logs al
        WHERE al.product_id = p.id
          AND al.anomaly_type = 'Zero Sales with Stock'
          AND al.is_resolved = false
          AND al.detected_at >= NOW() - INTERVAL '7 days'
      )
    RETURNING *;
  `;

  const engine2Query = sql`
    INSERT INTO anomaly_logs (id, product_id, anomaly_type, severity, description, is_resolved, detected_at, resolved_at)
    WITH sales_periods AS (
      SELECT 
        product_id,
        COALESCE(SUM(amount * quantity) FILTER (WHERE transacted_at >= NOW() - INTERVAL '14 days'), 0) as current_sales,
        COALESCE(SUM(amount * quantity) FILTER (WHERE transacted_at >= NOW() - INTERVAL '28 days' AND transacted_at < NOW() - INTERVAL '14 days'), 0) as prior_sales
      FROM sales_transactions
      WHERE transaction_type = 'sale'
      GROUP BY product_id
    ),
    variance_calc AS (
      SELECT 
        sp.product_id,
        sp.current_sales,
        sp.prior_sales,
        (sp.prior_sales - sp.current_sales) / sp.prior_sales as drop_ratio
      FROM sales_periods sp
      WHERE sp.prior_sales > 100
    )
    SELECT 
      gen_random_uuid() as id,
      vc.product_id,
      'Significant Sales Drop' as anomaly_type,
      (CASE WHEN vc.drop_ratio >= 0.75 THEN 'critical'::anomaly_severity ELSE 'high'::anomaly_severity END) as severity,
      'Product ''' || p.name || ''' (SKU: ' || p.sku || ') experienced a ' || ROUND((vc.drop_ratio * 100)::numeric, 1) || '% sales volume crash in the current 14-day window ($' || ROUND(vc.current_sales::numeric, 2) || ') compared to the prior 14 days ($' || ROUND(vc.prior_sales::numeric, 2) || ').' as description,
      false as is_resolved,
      NOW() as detected_at,
      NULL as resolved_at
    FROM variance_calc vc
    JOIN products p ON p.id = vc.product_id
    WHERE vc.drop_ratio >= 0.50
      AND NOT EXISTS (
        SELECT 1 FROM anomaly_logs al
        WHERE al.product_id = vc.product_id
          AND al.anomaly_type = 'Significant Sales Drop'
          AND al.is_resolved = false
          AND al.detected_at >= NOW() - INTERVAL '7 days'
      )
    RETURNING *;
  `;

  const engine3Query = sql`
    INSERT INTO anomaly_logs (id, product_id, anomaly_type, severity, description, is_resolved, detected_at, resolved_at)
    SELECT 
      gen_random_uuid() as id,
      p.id as product_id,
      'Negative Inventory Balance' as anomaly_type,
      'high'::anomaly_severity as severity,
      'Product ''' || p.name || ''' (SKU: ' || p.sku || ') has a critical inventory exception: current stock level is negative (' || snap.quantity_on_hand || ' units) on the latest snapshot.' as description,
      false as is_resolved,
      NOW() as detected_at,
      NULL as resolved_at
    FROM products p
    LEFT JOIN LATERAL (
      SELECT quantity_on_hand, snapshot_at
      FROM inventory_snapshots
      WHERE product_id = p.id
      ORDER BY snapshot_at DESC
      LIMIT 1
    ) snap ON true
    WHERE snap.quantity_on_hand < 0
      AND NOT EXISTS (
        SELECT 1 FROM anomaly_logs al
        WHERE al.product_id = p.id
          AND al.anomaly_type = 'Negative Inventory Balance'
          AND al.is_resolved = false
          AND al.detected_at >= NOW() - INTERVAL '7 days'
      )
    RETURNING *;
  `;

  const engine4Query = sql`
    INSERT INTO anomaly_logs (id, product_id, anomaly_type, severity, description, is_resolved, detected_at, resolved_at)
    SELECT 
      gen_random_uuid() as id,
      p.id as product_id,
      'Inactive Product Sales' as anomaly_type,
      'critical'::anomaly_severity as severity,
      'Product ''' || p.name || ''' (SKU: ' || p.sku || ') has status ''' || p.status || ''' but processed sales transactions within the last 7 days.' as description,
      false as is_resolved,
      NOW() as detected_at,
      NULL as resolved_at
    FROM products p
    WHERE p.status IN ('inactive', 'discontinued')
      AND EXISTS (
        SELECT 1 FROM sales_transactions t
        WHERE t.product_id = p.id
          AND t.transacted_at >= NOW() - INTERVAL '7 days'
      )
      AND NOT EXISTS (
        SELECT 1 FROM anomaly_logs al
        WHERE al.product_id = p.id
          AND al.anomaly_type = 'Inactive Product Sales'
          AND al.is_resolved = false
          AND al.detected_at >= NOW() - INTERVAL '7 days'
      )
    RETURNING *;
  `;

  const engine5Query = sql`
    INSERT INTO anomaly_logs (id, product_id, anomaly_type, severity, description, is_resolved, detected_at, resolved_at)
    WITH ratios AS (
      SELECT 
        product_id,
        COALESCE(SUM(amount * quantity) FILTER (WHERE transaction_type = 'sale'), 0) as gross_sales,
        COALESCE(SUM(amount * quantity) FILTER (WHERE transaction_type = 'return'), 0) as returns
      FROM sales_transactions
      GROUP BY product_id
    ),
    high_returns AS (
      SELECT 
        product_id,
        gross_sales,
        returns,
        returns / gross_sales as return_ratio
      FROM ratios
      WHERE gross_sales > 200
    )
    SELECT 
      gen_random_uuid() as id,
      hr.product_id,
      'Excessive Return Ratio' as anomaly_type,
      'high'::anomaly_severity as severity,
      'Product ''' || p.name || ''' (SKU: ' || p.sku || ') has returned goods amounting to $' || ROUND(hr.returns::numeric, 2) || ', which constitutes ' || ROUND((hr.return_ratio * 100)::numeric, 1) || '% of gross sales volume ($' || ROUND(hr.gross_sales::numeric, 2) || ').' as description,
      false as is_resolved,
      NOW() as detected_at,
      NULL as resolved_at
    FROM high_returns hr
    JOIN products p ON p.id = hr.product_id
    WHERE hr.return_ratio > 0.45
      AND NOT EXISTS (
        SELECT 1 FROM anomaly_logs al
        WHERE al.product_id = hr.product_id
          AND al.anomaly_type = 'Excessive Return Ratio'
          AND al.is_resolved = false
          AND al.detected_at >= NOW() - INTERVAL '7 days'
      )
    RETURNING *;
  `;

  try {
    // Run all 5 analytical engines concurrently inside the PG kernel
    console.log('🚀 Executing raw SQL pipelines...');
    const [res1, res2, res3, res4, res5] = await Promise.all([
      db.execute(engine1Query),
      db.execute(engine2Query),
      db.execute(engine3Query),
      db.execute(engine4Query),
      db.execute(engine5Query),
    ]);

    const totalInserted = 
      (res1.rowCount || 0) + 
      (res2.rowCount || 0) + 
      (res3.rowCount || 0) + 
      (res4.rowCount || 0) + 
      (res5.rowCount || 0);

    console.log(`✅ SQL detection sweep complete. Injected ${totalInserted} new anomalies.`);

    return {
      success: true,
      mode: 'production',
      insertedCount: totalInserted,
      details: {
        engine1: res1.rowCount || 0,
        engine2: res2.rowCount || 0,
        engine3: res3.rowCount || 0,
        engine4: res4.rowCount || 0,
        engine5: res5.rowCount || 0,
      }
    };
  } catch (error) {
    console.error('❌ Failed executing analytical SQL engines:', error);
    throw error;
  }
}
