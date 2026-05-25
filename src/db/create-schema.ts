import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from '@neondatabase/serverless';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ No DATABASE_URL found in .env');
    process.exit(1);
  }

  console.log('🔧 Creating schema with raw SQL...');
  const pool = new Pool({ connectionString });

  try {
    // Create enums
    await pool.query(`
      CREATE TYPE user_role AS ENUM ('admin', 'analyst');
      CREATE TYPE product_status AS ENUM ('active', 'inactive', 'discontinued');
      CREATE TYPE transaction_type AS ENUM ('sale', 'return', 'refund');
      CREATE TYPE anomaly_severity AS ENUM ('low', 'medium', 'high', 'critical');
    `);
    console.log('✅ Enums created');

    // Create users table
    await pool.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role user_role DEFAULT 'analyst' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE UNIQUE INDEX users_email_idx ON users(email);
      CREATE INDEX users_role_idx ON users(role);
    `);
    console.log('✅ Users table created');

    // Create products table
    await pool.query(`
      CREATE TABLE products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sku VARCHAR(100) UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        status product_status DEFAULT 'active' NOT NULL,
        price NUMERIC(12, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE UNIQUE INDEX products_sku_idx ON products(sku);
      CREATE INDEX products_status_idx ON products(status);
      CREATE INDEX products_category_idx ON products(category);
    `);
    console.log('✅ Products table created');

    // Create sales_transactions table
    await pool.query(`
      CREATE TABLE sales_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        transaction_type transaction_type NOT NULL,
        quantity INTEGER NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        transacted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX sales_trans_product_id_idx ON sales_transactions(product_id);
      CREATE INDEX sales_trans_type_idx ON sales_transactions(transaction_type);
      CREATE INDEX sales_trans_date_idx ON sales_transactions(transacted_at);
    `);
    console.log('✅ Sales transactions table created');

    // Create inventory_snapshots table
    await pool.query(`
      CREATE TABLE inventory_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity_on_hand INTEGER NOT NULL,
        snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX inv_snap_product_id_idx ON inventory_snapshots(product_id);
      CREATE INDEX inv_snap_date_idx ON inventory_snapshots(snapshot_at);
    `);
    console.log('✅ Inventory snapshots table created');

    // Create anomaly_logs table
    await pool.query(`
      CREATE TABLE anomaly_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        anomaly_type VARCHAR(100) NOT NULL,
        severity anomaly_severity NOT NULL,
        description TEXT NOT NULL,
        is_resolved BOOLEAN DEFAULT false NOT NULL,
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        resolved_at TIMESTAMP
      );
      CREATE INDEX anomaly_product_id_idx ON anomaly_logs(product_id);
      CREATE INDEX anomaly_type_idx ON anomaly_logs(anomaly_type);
      CREATE INDEX anomaly_severity_idx ON anomaly_logs(severity);
      CREATE INDEX anomaly_is_resolved_idx ON anomaly_logs(is_resolved);
      CREATE INDEX anomaly_detected_at_idx ON anomaly_logs(detected_at);
      CREATE INDEX anomaly_resolved_at_idx ON anomaly_logs(resolved_at);
    `);
    console.log('✅ Anomaly logs table created');

    console.log('🎉 Database schema created successfully!');
  } catch (error) {
    console.error('❌ Schema creation failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
