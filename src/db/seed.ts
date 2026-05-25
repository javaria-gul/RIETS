import * as dotenv from 'dotenv';
dotenv.config();

import { db, isSimulated } from './index.ts';
import { products as productsTable, salesTransactions as transactionsTable, inventorySnapshots as snapshotsTable, anomalyLogs as anomalyTable } from './schema.ts';
import { generateMockData } from './mockGenerator.ts';

async function main() {
  if (isSimulated || !db) {
    console.error('❌ Cannot run database seeding. Database connection is inactive or running in simulated mode. Verify your DATABASE_URL in .env');
    process.exit(1);
  }

  console.log('🏁 Starting high-density Database Seeding Engine...');
  const { products, transactions, snapshots } = generateMockData();

  console.log(`📦 Generated dataset telemetry:`);
  console.log(`  - Products: ${products.length}`);
  console.log(`  - Snapshots: ${snapshots.length}`);
  console.log(`  - Transactions: ${transactions.length}`);

  try {
    // Clear existing tables
    console.log('🧹 Purging existing database tables...');
    await db.delete(anomalyTable);
    await db.delete(transactionsTable);
    await db.delete(snapshotsTable);
    await db.delete(productsTable);
    console.log('✅ Tables cleaned successfully.');

    // Chunking function for massive queries
    const chunk = <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    // 1. Insert Products
    console.log('📥 Loading products into database...');
    const productChunks = chunk(products, 100);
    for (const ch of productChunks) {
      await db.insert(productsTable).values(ch);
    }
    console.log(`✅ Products successfully seeded (${products.length} records).`);

    // 2. Insert Snapshots
    console.log('📥 Loading inventory snapshots (chunked)...');
    const snapshotChunks = chunk(snapshots, 500);
    let snapCount = 0;
    for (const ch of snapshotChunks) {
      await db.insert(snapshotsTable).values(ch);
      snapCount += ch.length;
      console.log(`   Seeded ${snapCount}/${snapshots.length} snapshots...`);
    }
    console.log('✅ Inventory snapshots successfully seeded.');

    // 3. Insert Transactions
    console.log('📥 Loading sales transactions (chunked)...');
    const transChunks = chunk(transactions, 1000);
    let transCount = 0;
    for (const ch of transChunks) {
      await db.insert(transactionsTable).values(ch);
      transCount += ch.length;
      console.log(`   Seeded ${transCount}/${transactions.length} transactions...`);
    }
    console.log('✅ Sales transactions successfully seeded.');

    console.log('🎉 Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed with critical error:', error);
    process.exit(1);
  }
}

main();
