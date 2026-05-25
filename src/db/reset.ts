import * as dotenv from 'dotenv';
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ No DATABASE_URL found in .env');
    process.exit(1);
  }

  console.log('🔥 Connecting to Neon PostgreSQL to DROP all existing tables...');
  const pool = new Pool({ connectionString });

  try {
    // Drop all tables in correct dependency order (children first)
    await pool.query(`
      DROP TABLE IF EXISTS anomaly_logs CASCADE;
      DROP TABLE IF EXISTS inventory_snapshots CASCADE;
      DROP TABLE IF EXISTS sales_transactions CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    console.log('✅ All tables dropped successfully.');

    // Drop all custom enums
    await pool.query(`
      DROP TYPE IF EXISTS user_role CASCADE;
      DROP TYPE IF EXISTS product_status CASCADE;
      DROP TYPE IF EXISTS transaction_type CASCADE;
      DROP TYPE IF EXISTS anomaly_severity CASCADE;
    `);
    console.log('✅ All custom enums dropped successfully.');

    console.log('🎉 Database fully reset! Now run: npm run db:push && npm run db:seed');
  } catch (error) {
    console.error('❌ Reset failed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
