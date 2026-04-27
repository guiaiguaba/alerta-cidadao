# Sprint 2 — Conclusão e Entregáveis
**Data:** Abril 2026  
**Status:** ✅ Completo

---

## Resumo

A Sprint 2 completa o backend NestJS com todos os módulos de negócio, integração FCM, SLA automatizado, provisionamento de tenant, testes unitários e de integração (E2E), além dos pipelines CI/CD para os três apps.

---

## Arquivos entregues

### Guards e Decorators
| Arquivo | Descrição |
|---|---|
| `shared/guards/jwt-auth.guard.ts` | Guard JWT com suporte a rotas públicas (`@Public()`) |
| `shared/guards/roles.guard.ts` | Guard RBAC com hierarquia citizen < agent < supervisor < admin < super_admin |
| `shared/decorators/public.decorator.ts` | Decorator `@Public()` para rotas sem JWT |
| `shared/decorators/index.ts` | `@CurrentUser`, `@CurrentTenant`, `@Roles`, enum `Role` |

### Módulo Auth (completo)
| Arquivo | Descrição |
|---|---|
| `auth/jwt.strategy.ts` | Strategy Passport que valida JWT + busca user no schema do tenant |
| `auth/auth.controller.ts` | 7 endpoints: register, login, google, otp/send, otp/verify, refresh, logout, me |
| `auth/auth.service.ts` | Login, registro, refresh com rotação, googleAuth (verifica idToken com Google), logout |
| `auth/otp.service.ts` | OTP via SMS com cooldown de 1min, TTL 5min, 5 tentativas máximas, Redis |
| `auth/dto/auth.dto.ts` | DTOs validados: RegisterDto, LoginDto, RefreshTokenDto, SendOtpDto, VerifyOtpDto, GoogleAuthDto |

### Módulo Occurrences (completo)
| Arquivo | Descrição |
|---|---|
| `occurrences/occurrences.controller.ts` | list, map, create, findOne, updateStatus, assign, uploadMedia, timeline, sync |
| `occurrences/occurrences.service.ts` | assign(), addMedia(), getTimeline(), getMapGeoJson() adicionados à Sprint 1 |
| `occurrences/dto/occurrence.dto.ts` | CreateOccurrenceDto, UpdateStatusDto, ListOccurrencesQueryDto, SyncBatchDto |

### Módulo Alerts (novo)
| Arquivo | Descrição |
|---|---|
| `alerts/alerts.service.ts` | CRUD + send (disparo FCM + WebSocket) + cancel + markRead |
| `alerts/alerts.controller.ts` | GET ativos (cidadão), GET admin, POST, GET/:id, POST/:id/send, PATCH/:id/cancel, POST/:id/read |

### Módulo Notifications (novo)
| Arquivo | Descrição |
|---|---|
| `notifications/notifications.service.ts` | FCM V1 HTTP API com OAuth2 JWT assinado, cache de access token 55min, remoção de tokens inválidos, broadcast em lotes de 500, persistência no banco |

### Módulo Files (novo)
| Arquivo | Descrição |
|---|---|
| `files/files.service.ts` | Upload para S3/MinIO, validação de MIME type e tamanho, geração de thumbnail, upload de avatar com resize |

### Módulo Analytics (novo)
| Arquivo | Descrição |
|---|---|
| `analytics/analytics.service.ts` | Dashboard (7 queries paralelas), timeline, por categoria, por região, heatmap GeoJSON, performance de agentes, relatório SLA |
| `analytics/analytics.controller.ts` | 7 endpoints + exportação CSV (com BOM UTF-8) e JSON |

### SLA Cron (novo)
| Arquivo | Descrição |
|---|---|
| `sla/sla-cron.service.ts` | Verifica todos os tenants a cada 5 min, marca `sla_breached=true`, insere na timeline, emite WebSocket, notifica supervisores via FCM, aviso pré-breach 10min antes, atualiza `daily_stats` |

### Tenant Provisioning (novo)
| Arquivo | Descrição |
|---|---|
| `tenants/tenant-provisioning.service.ts` | Cria schema PostgreSQL, executa migration SQL, seed de regiões padrão, cria admin, rollback automático em falha |
| `tenants/tenants.controller.ts` | API interna `/internal/tenants` (provision, deactivate, drop-schema, list) + Admin controller para configuração do tenant |

### Outros Controllers
| Arquivo | Descrição |
|---|---|
| `users/users.controller.ts` | Perfil, atualização, avatar, FCM token, notificações, block/unblock, alterar role |
| `teams/teams.controller.ts` | CRUD de equipes com membros |

### Infraestrutura e Cross-cutting
| Arquivo | Descrição |
|---|---|
| `shared/interceptors/audit-log.interceptor.ts` | Registra POST/PATCH/DELETE automaticamente, sanitiza campos sensíveis |
| `shared/filters/http-exception.filter.ts` | Formata todos os erros em estrutura consistente `{ statusCode, error, message, path, timestamp }` |
| `app.module.ts` | Módulo raiz completo com todos os providers, ThrottlerModule global, PassportModule, MulterModule |
| `main.ts` | Bootstrap com ValidationPipe, CORS, Swagger, health endpoint, graceful shutdown |

---

## Testes

### Unitários (7 suites, ~80 casos)
| Suite | Casos | Cobertura-alvo |
|---|---|---|
| `auth.service.spec.ts` | 15 casos (register, login, refresh, logout, googleAuth) | 90%+ |
| `occurrences.service.spec.ts` | 18 casos (create, priorities, transitions, sync, protocol) | 85%+ |
| `analytics.service.spec.ts` | 10 casos (dashboard cache, timeline, heatmap, SLA) | 80%+ |
| `alerts.service.spec.ts` | 14 casos (create, send, cancel, listAll, paginação) | 85%+ |
| `notifications.service.spec.ts` | 10 casos (sendToUser, broadcast, FCM tokens, emojis) | 80%+ |
| `sla-cron.service.spec.ts` | 10 casos (runCheck, violations, notifications, systemUser) | 75%+ |
| `tenant-provisioning.service.spec.ts` | 12 casos (provision, rollback, deprovision, passwords) | 80%+ |

### E2E / Integração (3 suites, ~45 casos)
| Suite | Casos |
|---|---|
| `auth.e2e.spec.ts` | register, login, refresh (rotação), me, logout — validações completas |
| `occurrences.e2e.spec.ts` | CRUD, filtros, bbox, deduplicação offline, anti-spam, timeline, status transitions |
| `alerts.e2e.spec.ts` + `analytics.e2e.spec.ts` | CRUD alertas, permissões, send/cancel, CSV export, dashboard |

---

## CI/CD (3 pipelines)

| Pipeline | Arquivo | Ações |
|---|---|---|
| API | `.github/workflows/api-ci.yml` | Test → Build Docker → Deploy Cloud Run |
| Web | `.github/workflows/web-ci.yml` | Type-check → Lint → Build → Test → Deploy Vercel |
| Mobile | `.github/workflows/mobile-ci.yml` | Analyze → Unit tests → Build APK (citizen+agent) → Build iOS → Firebase App Distribution |

---

## Arquitetura de Segurança implementada

```
Request
  │
  ├─ TenantMiddleware         → extrai tenant, cache Redis 5min
  ├─ ThrottlerGuard           → 100 req/min global, 10 req/min auth
  ├─ JwtAuthGuard             → valida Bearer token, suporte @Public()
  ├─ RolesGuard               → RBAC hierárquico (citizen→super_admin)
  ├─ ValidationPipe           → class-validator, whitelist, transform
  ├─ AuditLogInterceptor      → registra POST/PATCH/DELETE no banco
  └─ HttpExceptionFilter      → normaliza todos os erros
```

---

## Fluxo FCM implementado

```
NotificationsService.sendToUser()
  │
  ├─ INSERT notifications (banco — feed permanente)
  ├─ Buscar fcm_tokens do usuário
  ├─ getFcmAccessToken() → OAuth2 JWT → cache 55min
  ├─ POST FCM V1 /messages:send (por token)
  ├─ Remover tokens UNREGISTERED/INVALID_ARGUMENT
  └─ UPDATE notifications SET delivery_status

NotificationsService.broadcastAlert()
  │
  ├─ Buscar usuários-alvo (todos ou por região)
  ├─ Enviar em lotes de 500 tokens
  └─ Retornar count de dispositivos alcançados
```

---

## Próximos passos — Sprint 3 (Painel Web Next.js)

### Prioridades
1. **Setup Next.js** — App Router, Tailwind, shadcn/ui
2. **Auth** — NextAuth com JWT do backend, middleware de proteção
3. **Dashboard** — Gráficos com Recharts (timeline, by-category, SLA gauge)
4. **Mapa** — Leaflet + OpenStreetMap com marcadores por prioridade
5. **Gestão de Ocorrências** — DataTable com filtros, drawer de detalhe, muda status
6. **Gestão de Alertas** — Formulário de criação, preview, botão Disparar
7. **Gestão de Usuários e Equipes** — CRUD completo
8. **Relatórios** — Exportação CSV/PDF com date range picker

### Decisões técnicas para Sprint 3
- **Mapas:** Leaflet (gratuito, sem quota) com `react-leaflet`
- **Gráficos:** Recharts (já disponível no ambiente de artifacts)
- **Tabelas:** TanStack Table v8 com sorting, filtering, pagination
- **Forms:** React Hook Form + Zod
- **Estado global:** Zustand (leve, sem boilerplate)
- **Auth SSR:** NextAuth.js com provider credentials apontando para `/auth/login`
- **WebSocket:** `socket.io-client` com reconexão automática
