import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from './schema.ts';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const isVercelRuntime = Boolean(process.env.VERCEL);

export let db: any = null;
export let isSimulated = true;
export let dbDriver: 'simulation' | 'neon' | 'postgres' = 'simulation';

async function initDb() {
  if (!connectionString) {
    console.warn('⚠️ No DATABASE_URL provided — running in SIMULATION mode.');
    isSimulated = true;
    dbDriver = 'simulation';
    return;
  }

  try {
    if (isVercelRuntime) {
      const pool = new Pool({ connectionString });
      db = drizzle(pool, { schema });
      isSimulated = false;
      dbDriver = 'neon';
      console.log('⚡ Vercel runtime detected. Neon Serverless Pool initialized successfully.');
      return;
    }

    if (connectionString.includes('neon.tech')) {
      const pool = new Pool({ connectionString });
      db = drizzle(pool, { schema });
      isSimulated = false;
      dbDriver = 'neon';
      console.log('⚡ Neon Serverless Pool initialized successfully.');
      return;
    }

    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString });
    const { drizzle: drizzleNode } = await import('drizzle-orm/node-postgres');
    db = drizzleNode(pool, { schema });
    isSimulated = false;
    dbDriver = 'postgres';
    console.log('⚡ Postgres client initialized successfully.');
    return;
  } catch (err) {
    console.error('❌ Database initialization failed — falling back to simulation mode.', err);
    db = null;
    isSimulated = true;
    dbDriver = 'simulation';
  }
}

await initDb();
