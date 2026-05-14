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

// ─── DataLoader batch functions ───────────────────────────────────────────────
const batchReviewsByAuthorId = async (authorIds) => {
  console.log(`Loader called with ${authorIds.length} userIds:`, authorIds);
  const result = await pool.query(
    "SELECT * FROM reviews WHERE author_id = ANY($1::text[])",
    [authorIds]
  );
  return authorIds.map((id) => result.rows.filter((r) => r.author_id === id));
};

const batchReviewsByProductUpc = async (upcs) => {
  const result = await pool.query(
    "SELECT * FROM reviews WHERE product_upc = ANY($1::text[])",
    [upcs]
  );
  return upcs.map((upc) => result.rows.filter((r) => r.product_upc === upc));
};

// ─── Rate limit threshold ─────────────────────────────────────────────────────
const rateLimitTreshold = process.env.LIMIT || 5000;

// ─── Schema ───────────────────────────────────────────────────────────────────
const typeDefs = parse(`#graphql
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3"
          import: ["@key" "@external" "@provides"])

  type Mutation {
    createReview(upc: ID!, id: ID!, body: String): Review
  }

  type Review @key(fields: "id") {
    id: ID!
    body: String
    author: User @provides(fields: "username")
    product: Product
  }

  type User @key(fields: "id") {
    id: ID!
    username: String @external
    reviews: [Review]
  }

  type Product @key(fields: "upc") {
    upc: String!
    reviews: [Review]
    reviewsForAuthor(authorID: ID!): [Review]
  }
`);

// ─── Resolvers ────────────────────────────────────────────────────────────────
const resolvers = {
  Review: {
    async author(review) {
      // review.author_id comes from the DB row
      const authorId = review.author_id ?? review.authorID;
      return authorId ? { __typename: "User", id: authorId } : null;
    },
  },
  User: {
    reviews(user, _args, context) {
      // Batched — ONE SQL query for all userIds in this request tick
      return context.userReviewsLoader.load(user.id);
    },
  },
  Product: {
    reviews(product, _args, context) {
      // Batched — ONE SQL query for all upcs in this request tick
      return context.productReviewsLoader.load(product.upc);
    },
    async reviewsForAuthor(product, { authorID }) {
      const result = await pool.query(
        "SELECT * FROM reviews WHERE product_upc = $1 AND author_id = $2",
        [product.upc, authorID]
      );
      return result.rows;
    },
  },
  Mutation: {
    async createReview(_p, args) {
      const id = args.id || `review-${Date.now()}`;
      await pool.query(
        "INSERT INTO reviews (id, author_id, product_upc, body) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [id, null, args.upc, args.body]
      );
      return { id, body: args.body, product: { upc: args.upc } };
    },
  },
};

// ─── Server startup ───────────────────────────────────────────────────────────
async function startApolloServer(typeDefs, resolvers) {
  const app = express();

  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: rateLimitTreshold,
  });

  app.use(cors());
  //app.use(limiter);

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
    // Simulate realistic DB-backed latency (50–60ms)
    (req, res, next) => {
      setTimeout(next, Math.floor(Math.random() * 10 + 50));
    },
    expressMiddleware(server, {
      // Fresh DataLoaders per request — cache is scoped to one request only
      context: async () => ({
        userReviewsLoader:    new DataLoader(batchReviewsByAuthorId),
        productReviewsLoader: new DataLoader(batchReviewsByProductUpc),
      }),
    })
  );

  const port = process.env.PORT || 4002;
  await new Promise((resolve) => httpServer.listen({ port }, resolve));
  console.log(`🚀 Reviews Server ready at http://localhost:${port}/`);
}

startApolloServer(typeDefs, resolvers);
