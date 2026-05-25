import { v4 as uuidv4 } from 'uuid';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'discontinued';
  price: string;
  createdAt: Date;
}

export interface SalesTransaction {
  id: string;
  productId: string;
  transactionType: 'sale' | 'return' | 'refund';
  quantity: number;
  amount: string;
  transactedAt: Date;
}

export interface InventorySnapshot {
  id: string;
  productId: string;
  quantityOnHand: number;
  snapshotAt: Date;
}

export interface AnomalyLog {
  id: string;
  productId: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  isResolved: boolean;
  detectedAt: Date;
  resolvedAt: Date | null;
}

export function generateMockData() {
  const categories = ['Electronics', 'Apparel', 'Grocery', 'Home', 'Beauty'];
  
  const products: Product[] = [];
  const transactions: SalesTransaction[] = [];
  const snapshots: InventorySnapshot[] = [];
  
  // Keep track of special sabotage IDs to avoid overlap
  const sabotage1Ids = new Set<string>(); // 20 Active items with huge inventory, 0 sales (30d)
  const sabotage2Ids = new Set<string>(); // 15 products with 80%+ sales crash
  const sabotage3Ids = new Set<string>(); // 10 negative inventory latest snapshots
  const sabotage4Ids = new Set<string>(); // 15 transactions on inactive/discontinued
  const sabotage5Ids = new Set<string>(); // 10 products return volume > 45%
  
  const now = new Date();

  // Helper: random date in range
  const getRandomDate = (start: Date, end: Date) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  };

  // 1. Create 500+ Products (let's do exactly 510 to exceed 500 easily)
  const numProducts = 515;
  for (let i = 0; i < numProducts; i++) {
    const id = uuidv4();
    const category = categories[i % categories.length];
    let status: 'active' | 'inactive' | 'discontinued' = 'active';
    
    // Distribute default status: 80% active, 12% inactive, 8% discontinued
    const rand = Math.random();
    if (rand < 0.12) {
      status = 'inactive';
    } else if (rand < 0.20) {
      status = 'discontinued';
    }

    // Determine sabotage allocations
    if (i < 20) {
      // Sabotage 1: Active with massive stock, zero sales
      status = 'active';
      sabotage1Ids.add(id);
    } else if (i >= 20 && i < 35) {
      // Sabotage 2: 80%+ revenue crash
      status = 'active';
      sabotage2Ids.add(id);
    } else if (i >= 35 && i < 45) {
      // Sabotage 3: Negative quantity latest snapshot
      status = 'active';
      sabotage3Ids.add(id);
    } else if (i >= 45 && i < 60) {
      // Sabotage 4: Transactions on discontinued/inactive
      status = Math.random() > 0.5 ? 'discontinued' : 'inactive';
      sabotage4Ids.add(id);
    } else if (i >= 60 && i < 70) {
      // Sabotage 5: High return ratio (>45%)
      status = 'active';
      sabotage5Ids.add(id);
    }

    const sku = `SKU-${category.slice(0, 3).toUpperCase()}-${1000 + i}`;
    const name = `${category} Item Spec ${i + 1}`;
    
    // Prices based on category
    let priceNum = 15.99;
    if (category === 'Electronics') priceNum = 99.99 + Math.random() * 800;
    else if (category === 'Apparel') priceNum = 19.99 + Math.random() * 80;
    else if (category === 'Grocery') priceNum = 2.99 + Math.random() * 25;
    else if (category === 'Home') priceNum = 45.00 + Math.random() * 300;
    else if (category === 'Beauty') priceNum = 9.99 + Math.random() * 120;
    
    products.push({
      id,
      sku,
      name,
      category,
      status,
      price: priceNum.toFixed(2),
      createdAt: getRandomDate(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000))
    });
  }

  // 2. Generate Transactions & Snapshots over 60-day window
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  // Separate standard vs special products to target transaction seeding
  products.forEach((product) => {
    const priceNum = parseFloat(product.price);
    
    // Generate snapshots: Let's create weekly snapshots for each product
    // Weeks: 8, 7, 6, 5, 4, 3, 2, 1, and now (latest)
    for (let w = 8; w >= 0; w--) {
      const snapDate = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      let qty = Math.floor(50 + Math.random() * 150);
      
      if (sabotage1Ids.has(product.id)) {
        // Massive stock
        qty = 450 + Math.floor(Math.random() * 200);
      } else if (sabotage3Ids.has(product.id) && w === 0) {
        // Explicitly negative inventory for latest snapshot
        qty = -5 - Math.floor(Math.random() * 30);
      }
      
      snapshots.push({
        id: uuidv4(),
        productId: product.id,
        quantityOnHand: qty,
        snapshotAt: snapDate
      });
    }

    // Now, generate transactions based on product segment
    if (sabotage1Ids.has(product.id)) {
      // Sabotage 1: zero sales in last 30 days
      // Generate some old sales in days -60 to -30
      const numSales = Math.floor(Math.random() * 4);
      for (let k = 0; k < numSales; k++) {
        const transDate = getRandomDate(sixtyDaysAgo, thirtyDaysAgo);
        transactions.push({
          id: uuidv4(),
          productId: product.id,
          transactionType: 'sale',
          quantity: 1,
          amount: (priceNum).toFixed(2),
          transactedAt: transDate
        });
      }
    } 
    
    else if (sabotage2Ids.has(product.id)) {
      // Sabotage 2: 80%+ revenue crash in current 14 days vs prior 14 days
      // Generate substantial sales in prior 14 days (days -28 to -14)
      const priorSalesCount = 20 + Math.floor(Math.random() * 10); // ~ $1000+
      for (let k = 0; k < priorSalesCount; k++) {
        const transDate = getRandomDate(twentyEightDaysAgo, fourteenDaysAgo);
        transactions.push({
          id: uuidv4(),
          productId: product.id,
          transactionType: 'sale',
          quantity: 1,
          amount: priceNum.toFixed(2),
          transactedAt: transDate
        });
      }
      // Generate almost no sales in current 14 days
      // Let's generate 0 or 1 sale of small qty
      if (Math.random() > 0.3) {
        const transDate = getRandomDate(fourteenDaysAgo, now);
        transactions.push({
          id: uuidv4(),
          productId: product.id,
          transactionType: 'sale',
          quantity: 1,
          amount: (priceNum * 0.1).toFixed(2), // low revenue line
          transactedAt: transDate
        });
      }
    } 
    
    else if (sabotage4Ids.has(product.id)) {
      // Sabotage 4: Transactions against inactive or discontinued products
      // Generate 1-2 transactions in the last 7 days
      const numTrans = 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < numTrans; k++) {
        const transDate = getRandomDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), now);
        transactions.push({
          id: uuidv4(),
          productId: product.id,
          transactionType: Math.random() > 0.2 ? 'sale' : 'return',
          quantity: 1,
          amount: priceNum.toFixed(2),
          transactedAt: transDate
        });
      }
    } 
    
    else if (sabotage5Ids.has(product.id)) {
      // Sabotage 5: Return volume exceeding 45% of gross sales volume
      // Gross sales: e.g. 10 sales
      const grossSales = 10;
      for (let k = 0; k < grossSales; k++) {
        const transDate = getRandomDate(sixtyDaysAgo, now);
        transactions.push({
          id: uuidv4(),
          productId: product.id,
          transactionType: 'sale',
          quantity: 1,
          amount: priceNum.toFixed(2),
          transactedAt: transDate
        });
      }
      // Returns: e.g. 5 returns (50% return ratio)
      const returnsCount = 5;
      for (let k = 0; k < returnsCount; k++) {
        const transDate = getRandomDate(sixtyDaysAgo, now);
        transactions.push({
          id: uuidv4(),
          productId: product.id,
          transactionType: 'return',
          quantity: 1,
          amount: priceNum.toFixed(2),
          transactedAt: transDate
        });
      }
    } 
    
    else {
      // Standard Products - generate general active traffic
      if (product.status === 'active') {
        // Average 20 transactions over 60 days
        const numTrans = Math.floor(5 + Math.random() * 30);
        for (let k = 0; k < numTrans; k++) {
          const transDate = getRandomDate(sixtyDaysAgo, now);
          const typeRand = Math.random();
          let type: 'sale' | 'return' | 'refund' = 'sale';
          if (typeRand < 0.08) {
            type = 'return';
          } else if (typeRand < 0.12) {
            type = 'refund';
          }
          
          transactions.push({
            id: uuidv4(),
            productId: product.id,
            transactionType: type,
            quantity: Math.floor(1 + Math.random() * 3),
            amount: priceNum.toFixed(2),
            transactedAt: transDate
          });
        }
      }
    }
  });

  // Ensure we reach exactly/exceed 10,000 transaction lines
  // If the total generated is less than 10,000, we add extra random sales for active standard products
  let totalTrans = transactions.length;
  const activeStandardProducts = products.filter(p => p.status === 'active' && !sabotage1Ids.has(p.id) && !sabotage2Ids.has(p.id) && !sabotage3Ids.has(p.id) && !sabotage5Ids.has(p.id));
  
  while (transactions.length < 10100) {
    const product = activeStandardProducts[Math.floor(Math.random() * activeStandardProducts.length)];
    const priceNum = parseFloat(product.price);
    const transDate = getRandomDate(sixtyDaysAgo, now);
    
    transactions.push({
      id: uuidv4(),
      productId: product.id,
      transactionType: 'sale',
      quantity: Math.floor(1 + Math.random() * 2),
      amount: priceNum.toFixed(2),
      transactedAt: transDate
    });
  }

  return {
    products,
    transactions,
    snapshots
  };
}
