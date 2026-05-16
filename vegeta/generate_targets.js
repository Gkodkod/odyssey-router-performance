const fs = require('fs');
const path = require('path');

/**
 * generate_targets.js
 * Generates a high-cardinality Vegeta target file for mutations
 * to avoid PostgreSQL row-level lock contention.
 */

const NUM_TARGETS = 100000;
const OUTPUT_FILE = path.join(__dirname, 'targets-dynamic.http');
const ROUTER_URL = 'http://router:4000/';

const queries = [
  `mutation CreateReview($upc: String!, $id: ID!, $authorId: ID!, $body: String!) { createReview(upc: $upc, id: $id, authorId: $authorId, body: $body) { id body author { username reviews { body } } product { name inStock shippingEstimate } } }`,
  `mutation UpdateReview($id: ID!, $body: String!) { updateReview(id: $id, body: $body) { id body } }`,
  `mutation DeleteReview($id: ID!) { deleteReview(id: $id) { id } }`,
  `mutation CreateProduct($upc: String!, $name: String!) { createProduct(upc: $upc, name: $name) { upc name } }`
];

const writeStream = fs.createWriteStream(OUTPUT_FILE);

console.log(`Generating ${NUM_TARGETS} unique mutation targets with variables...`);

for (let i = 0; i < NUM_TARGETS; i++) {
  const type = i % queries.length;
  const query = queries[type];
  let variables = {};

  switch (type) {
    case 0: // createReview
      variables = { upc: "1", id: `stress-${i}`, authorId: "1", body: `test review ${i}` };
      break;
    case 1: // updateReview
      variables = { id: `stress-${i}`, body: `updated test review ${i}` };
      break;
    case 2: // deleteReview
      variables = { id: `stress-${i}` };
      break;
    case 3: // createProduct
      variables = { upc: `product-${i}`, name: `Stress Test Product ${i}` };
      break;
  }

  const payload = JSON.stringify({ 
    query, 
    variables,
    operationName: ['CreateReview', 'UpdateReview', 'DeleteReview', 'CreateProduct'][type]
  });
  const bodyBase64 = Buffer.from(payload).toString('base64');
  
  const target = {
    method: 'POST',
    url: ROUTER_URL,
    header: {
      'Content-Type': ['application/json'],
      'Accept': ['application/json']
    },
    body: bodyBase64
  };

  writeStream.write(JSON.stringify(target) + '\n');
}

writeStream.end(() => {
  console.log(`Successfully generated ${NUM_TARGETS} targets in ${OUTPUT_FILE}`);
});
