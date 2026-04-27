# Sprint 3 — Painel Web Next.js · Conclusão
**Data:** Abril 2026  
**Status:** ✅ Completo

---

## Design System

**Tema:** "Centro de Controle de Emergência"
- **Dark por padrão** — fundo `#0A0C12`, superfícies `#111520`
- **Acento âmbar** — `#F59E0B` como cor primária de ação e branding
- **Tipografia:** IBM Plex Sans (UI) + IBM Plex Mono (dados) + IBM Plex Sans Condensed (títulos)
- **Atmosfera:** grade de pontos sutil, brilho âmbar no topo, linha de scan animada na tela de login
- **Densidade informacional:** máxima, mas hierarquia clara via data labels + valores grandes

### Classes utilitárias criadas
- `panel` — card padrão com borda, sombra e bg surface
- `metric-card` — card de métrica com padding e layout
- `data-label` — label CAPS + mono para campos
- `badge-{priority}` — badges de prioridade (critical/high/medium/low)
- `badge-{status}` — badges de status (open/assigned/in_progress/resolved/rejected)
- `btn-primary/secondary/danger/ghost` — botões padronizados
- `input/select` — campos com estilos consistentes
- `nav-item/nav-item-active` — itens de navegação

---

## Arquivos Entregues

### Configuração
| Arquivo | Descrição |
|---|---|
| `package.json` | Next.js 14, NextAuth, Recharts, Leaflet, TanStack, Zustand, socket.io-client, shadcn/ui parcial, React Hook Form + Zod |
| `next.config.js` | Output standalone, image domains, rewrite para `/api/backend` |
| `tailwind.config.js` | Tokens de design: cores de severidade, tipografia IBM Plex, animações, shadows |
| `postcss.config.js` | PostCSS + Autoprefixer |
| `tsconfig.json` | Strict mode + alias `@/*` |
| `Dockerfile` | Multi-stage: deps → builder → runner standalone (usuário não-root, tini) |
| `.env.example` | Todas as variáveis documentadas |

### Auth
| Arquivo | Descrição |
|---|---|
| `app/api/auth/route.ts` | NextAuth com CredentialsProvider (email/senha + tenant), GoogleProvider, callbacks JWT/session com role/tenantId/tokens |
| `middleware.ts` | Protege `/dashboard/*`, redireciona cidadãos de volta ao login |
| `types/next-auth.d.ts` | Extensão de tipos JWT/Session/User com campos custom |

### Layout e Infraestrutura
| Arquivo | Descrição |
|---|---|
| `app/layout.tsx` | Root layout com fonts IBM Plex via Google Fonts |
| `app/providers.tsx` | SessionProvider + react-hot-toast com tema dark |
| `app/page.tsx` | Redirect raiz → `/dashboard` |
| `app/dashboard/layout.tsx` | Layout do painel: verificação de sessão SSR + Sidebar |

### State Management
| Arquivo | Descrição |
|---|---|
| `lib/store/app.store.ts` | Zustand: feed de eventos WS, contagem de críticos, alertas ativos, estado sidebar, cache do dashboard |
| `lib/hooks/useWebSocket.ts` | Socket.io singleton com reconexão, handler registry por evento, join/leave region |
| `lib/api/client.ts` | Fetch tipado com injeção automática de token (client e server-side), builders para occurrences, alerts, analytics, users, teams, admin |
| `lib/utils/index.ts` | formatMinutes, formatNumber, formatRelative, formatDate, getPriorityClass, getStatusClass, getSlaStatus, getInitials, truncate, getRoleLabel |

### Páginas
| Página | Features |
|---|---|
| `/login` | Scan line animada, grid de pontos, campo de tenant, email/senha, Google OAuth, feedback de erro |
| `/dashboard` | 4 métricas, SLA gauge radial, tempo médio de resolução, gráfico de timeline (30d), mapa Leaflet, feed de ocorrências recentes, top agentes — tudo com cache Zustand + invalidação por WS |
| `/dashboard/occurrences` | Tabela com status/prioridade/SLA/agente, filtros rápidos por status e prioridade, bbox filter, paginação, drawer lateral (timeline + mídia + ações de status), deduplicação offline, atualizações em tempo real |
| `/dashboard/alerts` | Lista com severidade colorida, criação com modal + validação Zod, disparo com confirmação, cancelamento, badge de destinatários |
| `/dashboard/analytics` | Seletor de período (7/30/90d), gráfico de timeline (ComposedChart), gráfico radar por categoria, tabela de performance de agentes, exportação CSV/JSON com URL direto para o backend |
| `/dashboard/users` | Tabela com avatar/iniciais, alteração de role inline via select, block/unblock, filtro por nome e role |
| `/dashboard/teams` | Accordion por equipe, gestão de membros inline, modal de criação/edição |
| `/dashboard/settings` | Tabs: Geral (SLA display + displayName), Aparência (cores + logo + preview live), Categorias (tabela read-only), Regiões |

### Componentes
| Componente | Descrição |
|---|---|
| `layout/Sidebar` | Colapsável (60px ↔ 220px), badge de críticos, user info com iniciais, logout |
| `layout/Header` | Indicador WS ao vivo, bell de eventos em tempo real com contagem, indicador "dados desatualizados" |
| `analytics/MetricCard` | Card de métrica com ícone, cor, sublabel e trend |
| `analytics/OccurrenceChart` | ComposedChart (barras total/resolvidas + linha SLA) com tooltip custom dark |
| `analytics/SlaGauge` | RadialBarChart com gauge semicircular, cor dinâmica por compliance |
| `map/OccurrenceMap` | Leaflet dinâmico (SSR-safe), tile CartoDB Dark Matter, marcadores coloridos por prioridade com popup, atualização por WS |
| `occurrences/OccurrenceRow` | Linha de tabela com destaque para critical, SLA inline |
| `occurrences/OccurrenceDrawer` | Drawer slide-in com detalhe completo, timeline accordion, galeria de fotos, ações de status com nota |
| `occurrences/OccurrenceFiltersBar` | Filtros de status e prioridade em pill buttons, limpar tudo |
| `occurrences/RecentOccurrences` | Feed live de 15 últimas abertas |

### Testes
| Arquivo | Cobertura |
|---|---|
| `utils/__tests__/utils.spec.ts` | 25 casos: formatMinutes, formatNumber, getSlaStatus (todos os cenários), getInitials, truncate, getRoleLabel, STATUS_LABELS, PRIORITY_LABELS |

---

## Fluxo de dados em tempo real

```
WebSocket (socket.io)
    │
    ├─ occurrence:created
    │     ├─ Dashboard → invalida cache, mostra toast
    │     ├─ OccurrencesPage → prepend na lista
    │     ├─ RecentOccurrences → prepend no feed
    │     └─ OccurrenceMap → recarrega marcadores
    │
    ├─ occurrence:updated
    │     └─ OccurrencesPage → atualiza status inline
    │
    └─ alert:new
          └─ AlertsPage → prepend na lista + toast
```

---

## Para rodar localmente

```bash
# 1. Backend rodando (Sprint 2)
npm run docker:up

# 2. Instalar dependências
cd apps/web && npm install

# 3. Copiar e configurar .env
cp .env.example .env.local
# Editar: NEXTAUTH_SECRET, NEXTAUTH_URL, NEXT_PUBLIC_API_URL, etc.

# 4. Rodar em desenvolvimento
npm run dev
# Acessa: http://localhost:3001

# 5. Fazer login
# Tenant: demo
# Email/senha: admin@demo.com / senha definida no provisionamento

# 6. Testes
npm test
```

---

## Próximos Passos — Sprint 4 (Mobile Flutter)

### Prioridades
1. **Flavors** — citizen / agent via `--dart-define` ou `flutter_flavorizr`
2. **Auth screens** — Login com e-mail+senha + Google Sign-In + OTP
3. **Cidadão: Registrar ocorrência** — câmera + galeria, geolocalização, categoria, < 30s
4. **Cidadão: Acompanhar** — lista de ocorrências próprias + detalhe
5. **Cidadão: Mapa** — flutter_map + marcadores públicos
6. **Agente: Lista de ocorrências** — ordenação por prioridade/SLA, filtros
7. **Agente: Mapa interativo** — tempo real, navegar até local
8. **Agente: Atualizar status** — com foto before/after
9. **Offline-first** — Hive + sync queue + resolução de conflitos
10. **Push notifications** — FCM com deep linking por tipo

### Decisões técnicas Flutter
- **Offline storage:** Hive (rápido, simples) para queue + Drift (SQLite typed) para dados locais
- **Estado:** Riverpod 2 (providers + notifiers)
- **Navegação:** GoRouter (deep links FCM)
- **Mapas:** flutter_map + OpenStreetMap (gratuito)
- **Câmera:** image_picker + camera
- **HTTP:** Dio com interceptors (refresh token automático, retry, offline queue)
- **Auth:** google_sign_in + firebase_auth (apenas para FCM token)
