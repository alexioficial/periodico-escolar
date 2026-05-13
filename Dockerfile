# ---------- Stage 1: builder ----------
FROM node:22-slim AS builder

# Habilitar pnpm via corepack con versión pinneada (debe coincidir con la del lockfile)
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

WORKDIR /app

# Capa de dependencias cacheable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Copiar fuente y compilar
COPY . .
RUN pnpm run build

# Eliminar devDependencies para la imagen final
RUN pnpm prune --prod


# ---------- Stage 2: runtime ----------
FROM node:22-slim AS runtime

# Solo paquetes runtime mínimos: openssl para TLS, ca-certificates para HTTPS salientes
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl wget \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Usuario no-root provisto por la imagen oficial (UID 1000)
WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node --from=builder /app/build ./build
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --spider --quiet http://127.0.0.1:3000/feed || exit 1

CMD ["node", "build/index.js"]
