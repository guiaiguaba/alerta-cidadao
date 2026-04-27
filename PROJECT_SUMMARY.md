# Alerta Cidadão — Resumo Completo do Projeto
**Data de conclusão:** Abril 2026  
**Sprints executadas:** 5  
**Total de arquivos:** ~140

---

## Inventário por Sprint

### Sprint 1 — Backend Core
**14 arquivos** | NestJS + PostgreSQL/PostGIS + Docker

- Arquitetura detalhada com diagrama de sistema
- Modelagem de banco (15 tabelas por tenant, schema público)
- `TenantMiddleware` — extrai tenant do subdomínio, cache Redis 5min
- `TenantPrismaService` — pool de conexões com `search_path` dinâmico
- `AuthService` — JWT + refresh token com rotação, bcrypt
- `OccurrencesService` — CRUD, prioridade automática, anti-spam, sync offline
- `OccurrencesGateway` — WebSocket (rooms por tenant + região)
- `001_tenant_schema.sql` — migration completa com 15 tabelas + seed de categorias
- `docker-compose.yml` — Postgres/PostGIS + Redis + MinIO + API + Nginx
- `init.sql` — schema público + tenant_settings + tenants demo
- `api-ci.yml` — GitHub Actions (test → Docker → Cloud Run)

### Sprint 2 — Backend Avançado
**46 arquivos adicionais** | Guards, Controllers, FCM, SLA, Provisioning

- Guards JWT + RBAC hierárquico (5 níveis)
- Controllers: Auth (7 endpoints), Occurrences (10), Alerts (6), Analytics (8), Users, Teams, Admin
- `OtpService` — SMS com cooldown Redis, 5 tentativas máximas
- `NotificationsService` — FCM V1 HTTP API com OAuth2 JWT, cache 55min, remoção de tokens inválidos
- `AlertsService` — CRUD + disparo FCM + WebSocket broadcast
- `FilesService` — upload S3/MinIO, thumbnail automático
- `AnalyticsService` — 7 queries paralelas, heatmap GeoJSON, export CSV/JSON
- `SlaCronService` — verificação a cada 5min, timeline automática, notifica supervisores
- `TenantProvisioningService` — CREATE SCHEMA + migrations + seed + rollback automático
- `AuditLogInterceptor` — log automático de POST/PATCH/DELETE
- **7 suites de testes unitários (~80 casos)**
- **3 suites E2E (~45 casos)** — Auth, Occurrences, Alerts + Analytics
- Pipelines CI/CD Web e Mobile

### Sprint 3 — Painel Web Next.js
**42 arquivos** | Dark command center, Recharts, Leaflet, socket.io

- Design system "Centro de Controle de Emergência" (dark + âmbar + IBM Plex)
- NextAuth com JWT backend, middleware de proteção por role
- Dashboard: métricas, SLA gauge radial, gráfico 30d, mapa Leaflet, feed live
- Occurrences: tabela densa, filtros rápidos, drawer lateral completo
- Alerts: criação com Zod + disparo + cancelamento
- Analytics: ComposedChart + RadarChart + tabela agentes + export
- Users: role inline, block/unblock
- Teams: accordion + gestão de membros
- Settings: tabs geral/aparência/categorias/regiões
- Zustand store, socket.io singleton, API client SSR-safe

### Sprint 4 — Mobile Flutter
**29 arquivos** | Riverpod 2, GoRouter, Hive, flutter_map, FCM

- Flavors Android: citizen + agent (build.gradle + manifests)
- `ApiClient` Dio com interceptors (tenant + auth + refresh automático)
- `TokenStorage` com flutter_secure_storage (EncryptedSharedPreferences/Keychain)
- `OfflineQueueService` — fila Hive + sync automático + retry 3x + deduplicação por clientId
- `FcmService` — V1 HTTP, deep links, background handler
- `LocationService` — GPS + geocodificação reversa (Nominatim)
- Auth: Login (email/senha + Google + OTP 6 dígitos com cooldown)
- Cidadão: mapa CartoDB + popup, wizard < 30s, detail com progress bar
- Agente: lista com tabs/busca/ordenação, detail com upload foto, mapa ao vivo + distância
- Alertas: feed compartilhado com expiração e contagem de destinatários
- Theme Material 3 dark completo, consistente com o web

### Sprint 5 — Geo-segmentação + Analytics Mobile + Fixes
**15 arquivos** | PostGIS, analytics agente, documentação final

- `GeoSegmentationService` — `ST_DWithin` (raio), `ST_Within` + polígono, cruzamento com `regions.boundary`
- `AgentAnalyticsScreen` — taxa resolução, tempo médio, por prioridade, top categorias, trend semanal
- Arquivos de entrada corretos: `main_citizen.dart`, `main_agent.dart`
- `ConnectivityService` extraída como arquivo próprio
- Re-exports de widgets (`priority_badge.dart`, `status_badge.dart`, etc.)
- `analysis_options.yaml` com linting Dart
- `.env.example` mobile com instruções de build
- `README.md` completo do projeto

---

## Decisões Arquiteturais Chave

| Área | Decisão | Justificativa |
|------|---------|---------------|
| Multi-tenancy | Schema-per-tenant | Isolamento real, backup granular, sem risco de cross-leak |
| State mobile | Riverpod 2 StateNotifier | Testável, sem boilerplate, bom suporte a async |
| Offline | Hive + batch sync | Rápido, puro Dart, deduplicação por clientId |
| Mapas | flutter_map + OSM/CartoDB | Gratuito, sem quota, customizável |
| Mapas web | Leaflet + CartoDB Dark | Consistência visual com o app, gratuito |
| Push | FCM V1 HTTP direto | Sem Cloud Functions, controle total do payload |
| Auth SSR | NextAuth + JWT backend | Redirect por role, server-side session |
| WebSocket | socket.io rooms | Rooms por tenant + região, fallback polling |
| Analytics | Queries raw + cache Redis | 7 queries paralelas, invalida por evento WS |

---

## Como começar do zero

```bash
# 1. Clonar
git clone https://github.com/sua-org/alerta-cidadao.git
cd alerta-cidadao

# 2. Infraestrutura
npm run docker:up

# 3. API
cd apps/api && cp .env.example .env && npm i && npm run start:dev

# 4. Web
cd apps/web && cp .env.example .env.local && npm i && npm run dev

# 5. Mobile
cd apps/mobile
flutter pub get && dart run build_runner build
flutter run --flavor citizen --target lib/main_citizen.dart

# 6. Provisionar primeira prefeitura
curl -X POST http://localhost:3000/internal/tenants \
  -H "X-Internal-Api-Key: SEU_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slug":       "minha-cidade",
    "name":       "Prefeitura de Minha Cidade",
    "subdomain":  "minha",
    "stateCode":  "RJ",
    "adminEmail": "admin@minhacidade.rj.gov.br",
    "adminName":  "Administrador"
  }'
# → retorna { adminEmail, tempPassword }

# 7. Acessar painel
# http://localhost:3001 → tenant: minha → email+senha recebidos
```
