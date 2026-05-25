import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from './schema.ts';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

export let db: any = null;
export let isSimulated = true; // default to safe simulated mode until a real connection is established

async function initDb() {
  if (!connectionString) {
    console.warn('⚠️ No DATABASE_URL provided — running in SIMULATION mode.');
    isSimulated = true;
    return;
  }

  // Try Neon first if the connection string looks like Neon
  try {
    if (connectionString.includes('neon.tech')) {
      const pool = new Pool({ connectionString });
      db = drizzle(pool, { schema });
      isSimulated = false;
      console.log('⚡ Neon Serverless Pool initialized successfully.');
      return;
    }

    // Otherwise try a standard Postgres client (useful for local or other providers)
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString });
    const { drizzle: drizzleNode } = await import('drizzle-orm/node-postgres');
    db = drizzleNode(pool, { schema });
    isSimulated = false;
    console.log('⚡ Postgres client initialized successfully.');
    return;
  } catch (err) {
    console.error('❌ Database initialization failed — falling back to simulation mode.', err);
    db = null;
    isSimulated = true;
  }
}

// Initialize immediately (top-level await allowed in ESM)
await initDb();
