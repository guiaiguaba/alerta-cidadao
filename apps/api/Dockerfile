# apps/api/Dockerfile
# Multi-stage build: desenvolvimento + produção

# ==========================================
# STAGE 1: Base com dependências
# ==========================================
FROM node:20-alpine AS base

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/


# ==========================================
# STAGE 2: Desenvolvimento (hot reload)
# ==========================================
FROM base AS development

RUN npm ci

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]


# ==========================================
# STAGE 3: Builder (compilar TypeScript)
# ==========================================
FROM base AS builder

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Remover devDependencies após build
RUN npm prune --production


# ==========================================
# STAGE 4: Produção (imagem mínima)
# ==========================================
FROM node:20-alpine AS production

LABEL maintainer="alerta-cidadao"
LABEL version="1.0.0"

RUN apk add --no-cache openssl tini

# Usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nestjs -u 1001

WORKDIR /app

# Copiar apenas o necessário do stage builder
COPY --from=builder --chown=nestjs:nodejs /app/dist           ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules   ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json   ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma         ./prisma

USER nestjs

EXPOSE 3000

# tini para gerenciar sinais do processo (graceful shutdown)
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1
