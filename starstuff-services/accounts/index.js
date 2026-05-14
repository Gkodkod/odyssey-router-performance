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
const batchUsersById = async (ids) => {
  console.log(`[accounts] Loader called with ${ids.length} userIds:`, ids);
  const result = await pool.query(
    "SELECT * FROM users WHERE id = ANY($1::text[])",
    [ids]
  );
  return ids.map(id => result.rows.find(r => r.id === id) || null);
};

// ─── Schema ───────────────────────────────────────────────────────────────────
const typeDefs = parse(`#graphql
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3"
          import: ["@key" "@shareable" "@external"])

  type Query {
    me: User
    recommendedProducts: [Product]
  }

  type User @key(fields: "id") {
    id: ID!
    name: String
    username: String @shareable
  }

  extend type Product @key(fields: "upc") {
    upc: String! @external
  }
`);

// ─── Resolvers ────────────────────────────────────────────────────────────────
const resolvers = {
  Query: {
    async me(parent, args, context, info) {
      info.cacheControl.setCacheHint({ maxAge: 60, scope: "PRIVATE" });
      // Read x-user-id header forwarded by Router; fallback to '1' for local dev
      const userId = context.userId || '1';
      return context.userLoader.load(userId);
    },
    async recommendedProducts(parent, args, contextValue, info) {
      info.cacheControl.setCacheHint({ maxAge: 10, scope: "PRIVATE" });
      // Return 20 random products from the pool
      const result = await pool.query(
        "SELECT upc FROM products ORDER BY RANDOM() LIMIT 20"
      );
      return result.rows.map((r) => ({ upc: r.upc }));
    },
  },
  User: {
    async __resolveReference(object, context, info) {
      info.cacheControl.setCacheHint({ maxAge: 60 });
      return context.userLoader.load(object.id);
    },
  },
};

// ─── Server startup ───────────────────────────────────────────────────────────
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
    // Simulate realistic latency (40–50ms)
    (req, res, next) => {
      setTimeout(next, Math.floor(Math.random() * 10 + 40));
    },
    expressMiddleware(server, {
      // Fresh DataLoader + userId per request
      context: async ({ req }) => ({
        userId: req.headers['x-user-id'] || '1',
        userLoader: new DataLoader(batchUsersById),
      }),
    })
  );

  const port = process.env.PORT || 4001;
  await new Promise((resolve) => httpServer.listen({ port }, resolve));
  console.log(`🚀 Accounts Server ready at http://localhost:${port}/`);
}

startApolloServer(typeDefs, resolvers);
