FROM node:20-slim

WORKDIR /app

# Install dependencies first (layer cached unless package.json changes)
COPY package.json ./
RUN npm install --omit=dev

# Copy seed script
COPY seed.js ./

CMD ["node", "seed.js"]
