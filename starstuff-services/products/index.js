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

// ─── Database Pool ────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/starstuff",
});

const rateLimitTreshold = process.env.LIMIT || 5000;

// ─── Schema ───────────────────────────────────────────────────────────────────
const typeDefs = parse(`#graphql
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3"
          import: ["@key"])

  type Query {
    topProducts(first: Int = 5): [Product]
  }

  type Mutation {
    createProduct(upc: ID!, name: String): Product
  }

  type Product @key(fields: "upc") {
    upc: String!
    name: String
    price: Int
    weight: Int
  }
`);

// ─── Resolvers ────────────────────────────────────────────────────────────────
const resolvers = {
  Product: {
    async __resolveReference(object, _, info) {
      info.cacheControl.setCacheHint({ maxAge: 60 });
      const result = await pool.query(
        "SELECT * FROM products WHERE upc = $1",
        [object.upc]
      );
      return result.rows[0] || null;
    },
  },
  Query: {
    async topProducts(parent, args, contextValue, info) {
      info.cacheControl.setCacheHint({ maxAge: 60 });
      const result = await pool.query(
        "SELECT * FROM products LIMIT $1",
        [args.first]
      );
      return result.rows;
    },
  },
  Mutation: {
    async createProduct(_, args) {
      const upc = args.upc || `prod-${Date.now()}`;
      await pool.query(
        "INSERT INTO products (upc, name, price, weight) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [upc, args.name, 0, 0]
      );
      return { upc, name: args.name };
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
    // Simulate realistic latency (30–50ms)
    (req, res, next) => {
      setTimeout(next, Math.floor(Math.random() * 20 + 30));
    },
    expressMiddleware(server)
  );

  const port = process.env.PORT || 4003;
  await new Promise((resolve) => httpServer.listen({ port }, resolve));
  console.log(`🚀 Products Server ready at http://localhost:${port}/`);
}

startApolloServer(typeDefs, resolvers);
