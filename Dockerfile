# Use Node 20 as base image
FROM node:20-slim

# Install simple dependencies that might be needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies required for build)
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the SvelteKit app
RUN npm run build

# Prune devDependencies to keep the image small
RUN npm prune --omit=dev

# Expose the port the app runs on (SvelteKit node-adapter defaults to 3000)
EXPOSE 3000

# Start the application
CMD ["node", "build/index.js"]
