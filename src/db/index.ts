import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from './schema.ts';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

export let db: any = null;
export let isSimulated = false;

// Determine connection method
if (connectionString && connectionString.includes('neon.tech')) {
  try {
    const pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
    console.log('⚡ Neon Serverless Pool initialized successfully.');
  } catch (error) {
    console.error('❌ Failed to initialize Neon Connection Pool. Falling back to simulation.', error);
    isSimulated = true;
  }
} else if (connectionString && !connectionString.includes('placeholder')) {
  try {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString });
    const { drizzle: drizzleNode } = await import('drizzle-orm/node-postgres');
    db = drizzleNode(pool, { schema });
    console.log('⚡ Local PostgreSQL Node-Client initialized successfully.');
  } catch (error) {
    console.error('❌ Local PostgreSQL database connection failed. Falling back to simulation.', error);
    isSimulated = true;
  }
} else {
  console.log('⚠️ No active DATABASE_URL provided. Operating in high-density SIMULATION mode.');
  isSimulated = true;
}
