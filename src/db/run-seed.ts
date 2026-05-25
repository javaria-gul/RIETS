import * as dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from './schema';
import { generateMockData } from './mockGenerator';

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is required in environment for seeding.');
    process.exit(1);
  }

  console.log('🔌 Connecting to database for seeding...');

  let db: any;

  try {
    if (connectionString.includes('neon.tech')) {
      const pool = new Pool({ connectionString });
      db = drizzle(pool, { schema });
    } else {
      const { default: pg } = await import('pg');
      const pool = new pg.Pool({ connectionString });
      const { drizzle: drizzleNode } = await import('drizzle-orm/node-postgres');
      db = drizzleNode(pool, { schema });
    }
  } catch (err) {
    console.error('❌ Failed to create DB client for seeding:', err);
    process.exit(1);
  }

  const { products, transactions, snapshots } = generateMockData();

  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  try {
    console.log('🧹 Truncating tables (anomaly_logs, inventory_snapshots, sales_transactions, products)...');
    await db.execute(`TRUNCATE TABLE anomaly_logs, inventory_snapshots, sales_transactions, products RESTART IDENTITY CASCADE;`);
    console.log('✅ Tables truncated.');

    console.log(`📥 Seeding ${products.length} products...`);
    for (const ch of chunk(products, 200)) {
      await db.insert(schema.products).values(ch);
    }
    console.log('✅ Products seeded.');

    console.log(`📥 Seeding ${snapshots.length} inventory snapshots...`);
    for (const ch of chunk(snapshots, 500)) {
      await db.insert(schema.inventorySnapshots).values(ch);
    }
    console.log('✅ Snapshots seeded.');

    console.log(`📥 Seeding ${transactions.length} transactions...`);
    for (const ch of chunk(transactions, 1000)) {
      await db.insert(schema.salesTransactions).values(ch);
    }
    console.log('✅ Transactions seeded.');

    console.log('🎉 Database seeding finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

run();
