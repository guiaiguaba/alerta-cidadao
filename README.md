# 🚨 Alerta Cidadão

**Plataforma SaaS de Defesa Civil para Prefeituras e Órgãos de Emergência**

> Sistema multi-tenant completo para gestão de ocorrências urbanas, alertas massivos e monitoramento em tempo real — pensado como produto SaaS vendável para centenas de municípios brasileiros.

---

## 📦 Estrutura do Monorepo

```
alerta-cidadao/
├── apps/
│   ├── api/          ← Backend NestJS + PostgreSQL/PostGIS
│   ├── web/          ← Painel Admin Next.js 14
│   └── mobile/       ← App Flutter (cidadão + agente)
├── packages/
│   └── shared-types/ ← DTOs compartilhados (TypeScript)
├── infra/
│   ├── docker/       ← Docker Compose + init.sql
│   └── nginx/        ← Reverse proxy + wildcard subdomínio
└── .github/
    └── workflows/    ← CI/CD (API, Web, Mobile)
```

---

## 🚀 Quick Start (Desenvolvimento)

### Pré-requisitos

| Tool | Versão mínima |
|------|---------------|
| Node.js | 20+ |
| Flutter | 3.22+ |
| Docker + Docker Compose | 24+ |
| PostgreSQL (via Docker) | 16+ / PostGIS 3.4 |

### 1. Subir infraestrutura

```bash
# Subir Postgres + Redis + MinIO + Nginx
npm run docker:up

# Verificar saúde dos containers
docker compose -f infra/docker/docker-compose.yml ps
```

### 2. Backend API

```bash
cd apps/api
cp .env.example .env       # editar variáveis
npm install
npm run start:dev          # http://localhost:3000
# Swagger: http://localhost:3000/docs
```

### 3. Painel Web

```bash
cd apps/web
cp .env.example .env.local # editar variáveis
npm install
npm run dev                # http://localhost:3001
```

### 4. App Mobile

```bash
cd apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs

# App do Cidadão
flutter run --flavor citizen --target lib/main_citizen.dart

# App do Agente
flutter run --flavor agent --target lib/main_agent.dart
```

---

## 🏗️ Arquitetura

### Stack Completa

```
                    ┌─────────────────────────────────┐
                    │         NGINX + Wildcard         │
                    │  *.alertacidadao.com → tenant    │
                    └─────────────┬───────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
       ┌──────▼──────┐   ┌───────▼──────┐   ┌───────▼──────┐
       │  NestJS API  │   │  Next.js Web │   │ Flutter Apps │
       │  (REST+WS)   │   │  Painel Admin│   │ Cidadão/Agent│
       └──────┬───────┘   └──────────────┘   └─────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
┌───▼────┐         ┌────▼───┐
│ PostGIS│         │  Redis │
│ (multi-│         │ Cache  │
│ schema)│         │ Pub/Sub│
└────────┘         └────────┘
```

### Multi-Tenancy

Cada prefeitura tem um **schema PostgreSQL isolado**:

```
public.tenants          ← metadados de todas as prefeituras
tenant_iguaba_grande.*  ← dados exclusivos de Iguaba Grande
tenant_niteroi.*        ← dados exclusivos de Niterói
```

O tenant é resolvido pelo subdomínio em cada request:
```
iguaba.alertacidadao.com → X-Tenant-Slug: iguaba → schema tenant_iguaba_grande
```

---

## 🔐 Autenticação

| Método | Fluxo |
|--------|-------|
| Email + Senha | Login → JWT (15min) + Refresh (30d) com rotação |
| Google OAuth | ID Token → verificação Google → JWT |
| OTP SMS | Telefone → código 6 dígitos Redis (5min, 5 tentativas) → JWT |

**RBAC Hierárquico:**
```
citizen < agent < supervisor < admin < super_admin
```

---

## 📱 Apps Mobile

### Cidadão
- **Mapa:** ocorrências públicas abertas com marcadores por prioridade
- **Registrar:** wizard 3 passos < 30s (categoria → GPS → detalhes + foto)
- **Minhas:** lista própria + detalhe com progress bar de status
- **Alertas:** feed de alertas ativos da cidade

### Agente
- **Lista:** tabs (Abertas / Em Andamento / Resolvidas) + busca + ordenação
- **Detalhe:** atualizar status, upload foto antes/depois, nota
- **Mapa:** posição ao vivo + distância até cada ocorrência
- **Analytics:** taxa de resolução, tempo médio, por prioridade, tendência semanal

### Offline-First
```
Sem internet →  fila Hive (SyncQueueItem com clientId)
Reconecta   →  sync automático via /occurrences/sync
Conflito    →  last-write-wins por timestamp (servidor = fonte da verdade)
Fotos       →  nunca conflitam, sempre adicionadas
```

---

## 🌐 Painel Web (Next.js)

| Página | Features |
|--------|----------|
| `/login` | Email/senha, Google OAuth, campo de tenant |
| `/dashboard` | 4 métricas, SLA gauge, gráfico 30d, mapa, feed live |
| `/occurrences` | Tabela densa, filtros, drawer com timeline + fotos + ações |
| `/alerts` | Criar alerta, disparar, segmentação por cidade/região/raio |
| `/analytics` | Charts Recharts, radar por categoria, performance agentes, export CSV |
| `/users` | Role inline, block/unblock |
| `/teams` | Accordion com membros, gestão em linha |
| `/settings` | Cores, logo, categorias, regiões |

---

## 🔔 Notificações Push

**FCM V1 HTTP API** com OAuth2 JWT assinado:

```
NotificationsService
  ├── sendToUser()      → token individual + persistência no banco
  ├── broadcastAlert()  → lotes de 500 tokens
  └── FCM cache         → access token OAuth2 renovado a cada 55min
```

**Segmentação geográfica (PostGIS):**
- `ST_DWithin` → raio em metros do centro
- `ST_Within` + polígono GeoJSON → área irregular
- Cruzamento de `home_lat/home_lng` com polígonos de regiões

---

## ⏱️ SLA e Cron

O `SlaCronService` roda a cada **5 minutos** e:
1. Marca `sla_breached = true` em ocorrências vencidas
2. Insere evento na timeline (auditable)
3. Emite WebSocket para o painel
4. Notifica supervisores via FCM
5. Aviso pré-breach **10 minutos antes** do vencimento

**Prazos padrão por prioridade:**

| Prioridade | Prazo |
|------------|-------|
| Crítica | 30 min |
| Alta | 2 horas |
| Média | 8 horas |
| Baixa | 24 horas |

---

## 📊 Prioridade Automática

```
score = priority_base + histórico_reporter + horário_pico
─────────────────────────────────────────────────────────
critical → score ≥ 90
high     → score ≥ 65
medium   → score ≥ 35
low      → score < 35
```

Sem possibilidade de o cidadão manipular — calculado 100% server-side.

---

## 🛠️ Provisionamento de Novo Tenant

```bash
# Via API interna (super_admin)
POST /internal/tenants
{
  "slug":        "nova-cidade",
  "name":        "Prefeitura de Nova Cidade",
  "subdomain":   "nova",
  "stateCode":   "RJ",
  "adminEmail":  "admin@novacidade.rj.gov.br",
  "adminName":   "Administrador"
}

# O sistema automaticamente:
# 1. Cria public.tenants
# 2. CREATE SCHEMA tenant_nova_cidade
# 3. Executa migration SQL (15 tabelas)
# 4. Seed categorias + regiões padrão
# 5. Cria usuário admin com senha temporária
# 6. Invalida cache Redis do tenant
```

---

## 🧪 Testes

### Backend (NestJS)
```bash
cd apps/api
npm test              # unitários (jest, sem banco)
npm run test:cov      # com cobertura (mínimo 70%)
npm run test:e2e      # integração (requer Docker)
```

| Suite | Casos |
|-------|-------|
| auth.service | 15 (register, login, google, otp, refresh, logout) |
| occurrences.service | 18 (create, priority, transitions, sync, anti-spam) |
| analytics.service | 10 (dashboard, timeline, heatmap, SLA) |
| alerts.service | 14 (create, send, cancel, segmentação) |
| notifications.service | 10 (FCM, broadcast, tokens inválidos) |
| sla-cron.service | 10 (violations, notifications, timeline) |
| tenant-provisioning | 12 (provision, rollback, deprovision) |
| **E2E auth** | 12 (full HTTP pipeline) |
| **E2E occurrences** | 16 (CRUD, offline, status, mapa) |
| **E2E alerts+analytics** | 14 (create, send, CSV export) |

### Web (Next.js)
```bash
cd apps/web
npm test              # utils (formatMinutes, SLA, roles, etc.)
```

### Mobile (Flutter)
```bash
cd apps/mobile
flutter test          # unitários (SyncResult, AuthNotifier, AppUser)
```

---

## 🐳 Docker

```bash
# Desenvolvimento completo
docker compose -f infra/docker/docker-compose.yml up -d

# Serviços:
# - postgres:5432   (PostGIS 16)
# - redis:6379
# - minio:9000/9001 (S3 compatível)
# - api:3000        (NestJS hot reload)
# - web:3001        (Next.js dev)
# - nginx:80        (wildcard routing)
```

---

## 🚀 CI/CD

| Pipeline | Trigger | Ações |
|----------|---------|-------|
| `api-ci.yml` | push `apps/api/**` | Test → Build Docker → Deploy Cloud Run |
| `web-ci.yml` | push `apps/web/**` | Type-check → Lint → Build → Test → Deploy Vercel |
| `mobile-ci.yml` | push `apps/mobile/**` | Analyze → Test → Build APK (citizen+agent) → Build iOS → Firebase Distribution |

---

## 🔑 Variáveis de Ambiente

### API (`apps/api/.env`)
```env
DATABASE_URL=postgresql://alerta:senha@localhost:5432/alerta_cidadao
REDIS_URL=redis://localhost:6379
JWT_SECRET=<256-bit-random>
JWT_EXPIRY=15m
S3_ENDPOINT=http://localhost:9000
FCM_PROJECT_ID=
FCM_PRIVATE_KEY=
FCM_CLIENT_EMAIL=
APP_DOMAIN=alertacidadao.com
INTERNAL_API_KEY=<hex-random>
```

### Web (`apps/web/.env.local`)
```env
NEXTAUTH_SECRET=<base64-random>
NEXTAUTH_URL=https://iguaba.alertacidadao.com
NEXTAUTH_API_URL=http://api:3000/api/v1
NEXT_PUBLIC_API_URL=https://api.alertacidadao.com/api/v1
NEXT_PUBLIC_WS_URL=wss://api.alertacidadao.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Mobile (`--dart-define`)
```bash
flutter run --flavor citizen \
  --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

---

---

## 🗺️ Roadmap

- [x] Sprint 1 — Backend core (NestJS, multi-tenant, ocorrências)
- [x] Sprint 2 — Backend avançado (FCM, SLA, analytics, provisionamento)
- [x] Sprint 3 — Painel Web (Next.js, mapas, alertas, analytics)
- [x] Sprint 4 — Mobile Flutter (cidadão + agente, offline-first)
- [x] Sprint 5 — PostGIS geo-segmentação, analytics mobile, fixes
- [ ] Sprint 6 — iOS TestFlight, widget Android, acessibilidade
- [ ] Sprint 7 — Billing/Stripe, portal de onboarding self-service
- [ ] Sprint 8 — API pública para integração com outros sistemas municipais

---

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch: `git checkout -b feat/minha-feature`
3. Commit: `git commit -m 'feat(api): adicionar X'`
4. Push: `git push origin feat/minha-feature`
5. Abra um Pull Request

**Convenção de commits:** [Conventional Commits](https://conventionalcommits.org/)

---

## 📄 Licença

Proprietário — © 2026 Alerta Cidadão. Todos os direitos reservados.
