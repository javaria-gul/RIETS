import { pgTable, uuid, varchar, text, pgEnum, integer, numeric, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';

// 1. Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'analyst']);
export const productStatusEnum = pgEnum('product_status', ['active', 'inactive', 'discontinued']);
export const transactionTypeEnum = pgEnum('transaction_type', ['sale', 'return', 'refund']);
export const severityEnum = pgEnum('anomaly_severity', ['low', 'medium', 'high', 'critical']);

// 2. Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').default('analyst').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
  roleIdx: index('users_role_idx').on(table.role),
}));

// 3. Products Table
export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  sku: varchar('sku', { length: 100 }).unique().notNull(),
  name: text('name').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  status: productStatusEnum('status').default('active').notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  skuIdx: uniqueIndex('products_sku_idx').on(table.sku),
  statusIdx: index('products_status_idx').on(table.status),
  categoryIdx: index('products_category_idx').on(table.category),
}));

// 4. Sales Transactions Table
export const salesTransactions = pgTable('sales_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  transactionType: transactionTypeEnum('transaction_type').notNull(),
  quantity: integer('quantity').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  transactedAt: timestamp('transacted_at').defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index('sales_trans_product_id_idx').on(table.productId),
  transTypeIdx: index('sales_trans_type_idx').on(table.transactionType),
  transactedAtIdx: index('sales_trans_date_idx').on(table.transactedAt),
}));

// 5. Inventory Snapshots Table
export const inventorySnapshots = pgTable('inventory_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  quantityOnHand: integer('quantity_on_hand').notNull(),
  snapshotAt: timestamp('snapshot_at').defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index('inv_snap_product_id_idx').on(table.productId),
  snapshotAtIdx: index('inv_snap_date_idx').on(table.snapshotAt),
}));

// 6. Anomaly Logs Table
export const anomalyLogs = pgTable('anomaly_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  anomalyType: varchar('anomaly_type', { length: 100 }).notNull(),
  severity: severityEnum('severity').notNull(),
  description: text('description').notNull(),
  isResolved: boolean('is_resolved').default(false).notNull(),
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => ({
  productIdIdx: index('anomaly_product_id_idx').on(table.productId),
  anomalyTypeIdx: index('anomaly_type_idx').on(table.anomalyType),
  severityIdx: index('anomaly_severity_idx').on(table.severity),
  isResolvedIdx: index('anomaly_is_resolved_idx').on(table.isResolved),
  detectedAtIdx: index('anomaly_detected_at_idx').on(table.detectedAt),
  resolvedAtIdx: index('anomaly_resolved_at_idx').on(table.resolvedAt),
}));
