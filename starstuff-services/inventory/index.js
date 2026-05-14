const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const { buildSubgraphSchema } = require("@apollo/subgraph");
const { ApolloServerPluginDrainHttpServer } = require("@apollo/server/plugin/drainHttpServer");
const rateLimit = require("express-rate-limit");
const express = require("express");
const http = require("http");
const { json } = require("body-parser");
const cors = require("cors");
const { parse } = require("graphql");
const { Pool } = require("pg");
const DataLoader = require("dataloader");

// ─── Database Pool ────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/starstuff",
});

const rateLimitTreshold = process.env.LIMIT || 5000;

// ─── DataLoader batch function ────────────────────────────────────────────────
const batchInventoryByUpc = async (upcs) => {
  console.log(`[inventory] Loader called with ${upcs.length} upcs:`, upcs);
  const result = await pool.query(
    "SELECT upc, in_stock FROM inventory WHERE upc = ANY($1::text[])",
    [upcs]
  );
  return upcs.map(upc => {
    const row = result.rows.find(r => r.upc === upc);
    return row ? { upc, inStock: row.in_stock } : { upc, inStock: false };
  });
};

// ─── Schema ───────────────────────────────────────────────────────────────────
const typeDefs = parse(`#graphql
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3"
          import: ["@key" "@external" "@requires"])

  type Product @key(fields: "upc") {
    upc: String!
    weight: Int @external
    price: Int @external
    inStock: Boolean
    shippingEstimate: Int @requires(fields: "price weight")
  }
`);

// ─── Resolvers ────────────────────────────────────────────────────────────────
const resolvers = {
  Product: {
    async __resolveReference(object, context, info) {
      info.cacheControl.setCacheHint({ maxAge: 60 });
      const inv = await context.inventoryLoader.load(object.upc);
      return { ...object, inStock: inv.inStock };
    },
    shippingEstimate(object) {
      // Free shipping for expensive items; otherwise based on weight
      if (object.price > 1000) return 0;
      return Math.floor(object.weight * 0.5);
    },
  },
};

// ─── Server startup ───────────────────────────────────────────────────────────-
async function startApolloServer(typeDefs, resolvers) {
  const app = express();

  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: rateLimitTreshold,
  });

  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
    introspection: process.env.NODE_ENV !== "production",
    allowBatchedHttpRequests: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.use(
    "/",
    cors(),
    json(),
    // Simulate realistic latency (50–60ms)
    (req, res, next) => {
      setTimeout(next, Math.floor(Math.random() * 10 + 50));
    },
    expressMiddleware(server, {
      context: async () => ({
        inventoryLoader: new DataLoader(batchInventoryByUpc),
      }),
    })
  );

  const port = process.env.PORT || 4004;
  await new Promise((resolve) => httpServer.listen({ port }, resolve));
  console.log(`🚀 Inventory Server ready at http://localhost:${port}/`);
}

startApolloServer(typeDefs, resolvers);
