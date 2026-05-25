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
    await pool.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
    `);

    console.log('✅ Public schema wiped and recreated successfully.');
    console.log('🎉 Database fully reset! Now run: npm run db:push && npm run db:seed');
  } catch (error) {
    console.error('❌ Reset failed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
