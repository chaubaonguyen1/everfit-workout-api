# syntax=docker/dockerfile:1

# ---- deps: install all dependencies (incl. dev) and generate the Prisma client ----
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- build: compile TypeScript, then drop dev dependencies ----
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime: minimal image running as non-root ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/config ./config
USER node
EXPOSE 3000
# Migrations run on start for a one-command setup. In production this would be a separate
# release step so multiple replicas don't race to migrate.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
