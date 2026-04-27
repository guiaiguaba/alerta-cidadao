# apps/api/Dockerfile
FROM node:20-alpine AS base

RUN apk add --no-cache python3 make g++ openssl && rm -rf /var/cache/apk/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/


# ==========================================
# Builder
# ==========================================
FROM base AS builder

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build
RUN npm prune --production


# ==========================================
# Produção
# ==========================================
FROM node:20-alpine AS production

RUN apk add --no-cache openssl tini

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma       ./prisma

USER nestjs

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1