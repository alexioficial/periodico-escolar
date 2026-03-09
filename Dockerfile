# Use Node 20 as base image
FROM node:20-slim

# Install simple dependencies that might be needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Habilitar pnpm mediante corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files (updated to include pnpm-lock.yaml)
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies using pnpm
RUN pnpm install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Build the SvelteKit app
RUN pnpm run build

# Prune devDependencies to keep the image small
RUN pnpm prune --prod

# Expose the port the app runs on (SvelteKit node-adapter defaults to 3000)
EXPOSE 3000

# Start the application
CMD ["node", "build/index.js"]
