-- Starstuff Services Database Schema
-- This script runs automatically when the postgres container is first created.
-- It will NOT re-run on subsequent container restarts.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  username    TEXT NOT NULL UNIQUE,
  birth_date  TEXT
);

CREATE TABLE IF NOT EXISTS products (
  upc     TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  price   INTEGER NOT NULL,
  weight  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  upc      TEXT PRIMARY KEY REFERENCES products(upc) ON DELETE CASCADE,
  in_stock BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_upc TEXT NOT NULL REFERENCES products(upc) ON DELETE CASCADE,
  body        TEXT NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_reviews_author_id   ON reviews(author_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_upc ON reviews(product_upc);
