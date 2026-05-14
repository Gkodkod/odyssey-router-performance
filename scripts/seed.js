/**
 * Starstuff Services — Database Seeder
 *
 * Generates realistic mock data and inserts it into PostgreSQL.
 * Uses ON CONFLICT DO NOTHING so it is safe to run multiple times.
 *
 * Counts (configurable via env):
 *   SEED_USERS    — default 10,000
 *   SEED_PRODUCTS — default 5,000
 *   SEED_REVIEWS  — default 50,000
 */

'use strict';

const { Pool } = require('pg');
const { faker } = require('@faker-js/faker');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:password@localhost:5432/starstuff';

const USER_COUNT    = parseInt(process.env.SEED_USERS,    10) || 10_000;
const PRODUCT_COUNT = parseInt(process.env.SEED_PRODUCTS, 10) || 5_000;
const REVIEW_COUNT  = parseInt(process.env.SEED_REVIEWS,  10) || 50_000;
const CHUNK_SIZE    = 1_000; // rows per INSERT batch

const pool = new Pool({ connectionString: DATABASE_URL });

// ─── Helpers ────────────────────────────────────────────────────────────────

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function bulkInsert(client, table, columns, rows) {
  if (rows.length === 0) return;
  const colList = columns.join(', ');
  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const placeholders = batch
      .map((_, i) => `(${columns.map((__, j) => `$${i * columns.length + j + 1}`).join(', ')})`)
      .join(', ');
    const values = batch.flat();
    await client.query(
      `INSERT INTO ${table} (${colList}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values
    );
  }
}

// ─── Seed functions ──────────────────────────────────────────────────────────

async function seedUsers(client) {
  console.log(`  Generating ${USER_COUNT.toLocaleString()} users...`);
  // Guarantee the two fixture users used by the original workshop queries
  const fixtureUsers = [
    { id: '1', name: 'Ada Lovelace',  username: '@ada',      birth_date: '1815-12-10' },
    { id: '2', name: 'Alan Turing',   username: '@complete', birth_date: '1912-06-23' },
  ];

  const generatedUsers = Array.from({ length: USER_COUNT - fixtureUsers.length }, (_, i) => ({
    id:         `user-${i + 3}`,
    name:       faker.person.fullName(),
    username:   `@${faker.internet.userName().toLowerCase().replace(/[^a-z0-9_]/g, '_')}_${i + 3}`,
    birth_date: faker.date.birthdate({ min: 1950, max: 2005, mode: 'year' }).toISOString().split('T')[0],
  }));

  const allUsers = [...fixtureUsers, ...generatedUsers];
  const rows = allUsers.map(u => [u.id, u.name, u.username, u.birth_date]);
  await bulkInsert(client, 'users', ['id', 'name', 'username', 'birth_date'], rows);
  console.log(`  ✓ ${allUsers.length.toLocaleString()} users inserted.`);
  return allUsers.map(u => u.id);
}

async function seedProducts(client) {
  console.log(`  Generating ${PRODUCT_COUNT.toLocaleString()} products...`);
  // Guarantee the four fixture products used by the original workshop queries
  const fixtureProducts = [
    { upc: '1', name: 'Table', price: 899,  weight: 100 },
    { upc: '2', name: 'Couch', price: 1299, weight: 1000 },
    { upc: '3', name: 'Chair', price: 54,   weight: 50 },
    { upc: '4', name: 'Bed',   price: 1000, weight: 1200 },
  ];

  const categories = ['Electronics', 'Furniture', 'Clothing', 'Books', 'Sports', 'Kitchen', 'Garden', 'Toys'];
  const generatedProducts = Array.from({ length: PRODUCT_COUNT - fixtureProducts.length }, (_, i) => ({
    upc:    `prod-${i + 5}`,
    name:   `${faker.commerce.productAdjective()} ${faker.commerce.product()}`,
    price:  Math.floor(faker.number.float({ min: 5, max: 2000, multipleOf: 1 })),
    weight: Math.floor(faker.number.float({ min: 10, max: 5000, multipleOf: 1 })),
  }));

  const allProducts = [...fixtureProducts, ...generatedProducts];
  const productRows = allProducts.map(p => [p.upc, p.name, p.price, p.weight]);
  await bulkInsert(client, 'products', ['upc', 'name', 'price', 'weight'], productRows);

  // Inventory: every product gets a stock status
  const inventoryRows = allProducts.map(p => [p.upc, Math.random() > 0.2]); // 80% in-stock
  await bulkInsert(client, 'inventory', ['upc', 'in_stock'], inventoryRows);

  console.log(`  ✓ ${allProducts.length.toLocaleString()} products + inventory inserted.`);
  return allProducts.map(p => p.upc);
}

async function seedReviews(client, userIds, productUpcs) {
  console.log(`  Generating ${REVIEW_COUNT.toLocaleString()} reviews...`);
  const reviews = Array.from({ length: REVIEW_COUNT }, (_, i) => [
    `review-${i + 1}`,
    userIds[Math.floor(Math.random() * userIds.length)],
    productUpcs[Math.floor(Math.random() * productUpcs.length)],
    faker.lorem.sentences({ min: 1, max: 3 }),
  ]);

  await bulkInsert(client, 'reviews', ['id', 'author_id', 'product_upc', 'body'], reviews);
  console.log(`  ✓ ${REVIEW_COUNT.toLocaleString()} reviews inserted.`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱 Starting Starstuff database seed...\n');
  const start = Date.now();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userIds     = await seedUsers(client);
    const productUpcs = await seedProducts(client);
    await seedReviews(client, userIds, productUpcs);

    await client.query('COMMIT');

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅ Seed complete in ${elapsed}s\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed failed, transaction rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
