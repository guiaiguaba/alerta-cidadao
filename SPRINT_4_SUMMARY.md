# Sprint 4 — Mobile Flutter · Conclusão
**Data:** Abril 2026  
**Status:** ✅ Completo

---

## Arquitetura Mobile

```
alerta_cidadao/
├── lib/
│   ├── app.dart               ← GoRouter + MaterialApp
│   ├── main.dart              ← Bootstrap + Hive init + Firebase
│   │
│   ├── core/
│   │   ├── api/               ← Dio client com interceptors (auth + tenant + retry)
│   │   ├── auth/              ← TokenStorage (flutter_secure_storage)
│   │   ├── offline/           ← OfflineQueueService + ConnectivityService
│   │   ├── notifications/     ← FcmService (V1 HTTP API + deep links)
│   │   ├── location/          ← LocationService + geocodificação reversa
│   │   ├── theme/             ← Material 3 dark + IBM Plex fonts
│   │   └── constants/         ← AppColors (consistente com web)
│   │
│   ├── models/                ← Occurrence, AppUser, Category, AppAlert, SyncQueueItem
│   ├── providers/             ← Riverpod: Auth, Occurrences, Categories, Connectivity
│   │
│   └── features/
│       ├── auth/              ← LoginScreen + OtpScreen
│       ├── citizen/
│       │   ├── home_screen    ← Shell com BottomNav (Mapa / + / Minhas / Alertas)
│       │   ├── map/           ← CitizenMapScreen (flutter_map + marcadores por prioridade)
│       │   ├── report_occurrence/ ← 3-step wizard < 30s
│       │   └── my_occurrences/   ← Lista + detalhe com progress bar de status
│       ├── agent/
│       │   ├── home_screen    ← Shell com AppBar + BottomNav (Lista / Mapa / Alertas)
│       │   ├── occurrence_list/ ← AgentListScreen (tabs + busca) + AgentDetailScreen
│       │   └── map/           ← AgentMapScreen (live tracking + cluster + navigar)
│       └── alerts/            ← AlertsScreen (compartilhado cidadão/agente)
│
├── test/
│   └── unit/
│       ├── offline/           ← SyncResult, OfflineQueueService
│       └── providers/         ← AuthState, AuthNotifier, AppUser helpers
│
└── android/
    └── app/
        ├── build.gradle       ← Flavors: citizen + agent
        └── src/main/
            └── AndroidManifest.xml  ← Permissões + FCM + Deep links
```

---

## Funcionalidades Implementadas

### 🔐 Autenticação
| Feature | Status |
|---|---|
| Login email + senha | ✅ |
| Google Sign-In | ✅ |
| OTP via SMS (6 dígitos, cooldown 60s, 5 tentativas) | ✅ |
| Animação de shake no erro | ✅ |
| Refresh token automático (interceptor Dio) | ✅ |
| Sessão persistente (flutter_secure_storage) | ✅ |
| Logout com revogação de token FCM | ✅ |
| Redirect por role (citizen → /citizen, agent → /agent) | ✅ |

### 📱 App do Cidadão
| Feature | Status |
|---|---|
| Mapa com ocorrências públicas (flutter_map + CartoDB Dark) | ✅ |
| Popup de ocorrência selecionada com thumbnail | ✅ |
| Legenda de prioridades | ✅ |
| Atualização automática a cada 2min | ✅ |
| Registrar ocorrência em 3 passos < 30s | ✅ |
| Seleção de categoria em grid visual | ✅ |
| Geolocalização automática + geocodificação reversa | ✅ |
| Upload de foto (câmera ou galeria) | ✅ |
| Indicador de prioridade alta com aviso | ✅ |
| Suporte offline: salva na fila e sincroniza depois | ✅ |
| Lista de minhas ocorrências | ✅ |
| Detalhe com progress bar de status | ✅ |
| Timeline de ações | ✅ |
| Galeria de fotos | ✅ |
| Feed de alertas | ✅ |

### 🧑‍🚒 App do Agente
| Feature | Status |
|---|---|
| Lista com tabs (Abertas / Em Andamento / Resolvidas) | ✅ |
| Busca por protocolo, categoria, endereço | ✅ |
| Ordenação automática: crítico → alto → médio → baixo | ✅ |
| Pull-to-refresh | ✅ |
| Infinite scroll (load more) | ✅ |
| Detalhe completo com foto, timeline, SLA | ✅ |
| Atualizar status (transições validadas) | ✅ |
| Upload foto antes/durante/depois | ✅ |
| Nota na atualização de status | ✅ |
| Mapa ao vivo com posição do agente | ✅ |
| Filtros por prioridade no mapa | ✅ |
| Distância até a ocorrência | ✅ |
| Popup com "Navegar" + "Ver detalhes" | ✅ |
| Atualização do mapa a cada 30s | ✅ |
| Feed de alertas | ✅ |

### 📡 Offline-First
| Feature | Status |
|---|---|
| Fila persistente com Hive (SyncQueueItem) | ✅ |
| Sincronização automática ao reconectar | ✅ |
| Batch sync (/occurrences/sync) | ✅ |
| Retry com limite de 3 tentativas | ✅ |
| Banner de status (offline / pendentes) | ✅ |
| Deduplicação por clientId | ✅ |
| Conflito: last-write-wins por timestamp | ✅ |
| Fotos nunca conflitam — sempre adicionadas | ✅ |
| Cache de categorias para uso offline | ✅ |

### 🔔 Push Notifications
| Feature | Status |
|---|---|
| FCM V1 com token renovável | ✅ |
| Canal Android de alta prioridade | ✅ |
| Notificações em foreground via flutter_local_notifications | ✅ |
| Deep links por tipo (occurrence_update, alert) | ✅ |
| Background handler (@pragma vm:entry-point) | ✅ |
| Registro/remoção de token FCM no login/logout | ✅ |

### 🗺️ Mapas
| Feature | Status |
|---|---|
| flutter_map com tile CartoDB Dark Matter | ✅ |
| Marcadores coloridos por prioridade | ✅ |
| Popup ao tocar no marcador | ✅ |
| Posição ao vivo do agente (geolocator stream) | ✅ |
| Cálculo de distância até a ocorrência | ✅ |
| Filtros de prioridade no mapa do agente | ✅ |
| Zoom/pan com InteractiveViewer | ✅ |

---

## Design System Mobile

Consistente com o painel web:
- **Background:** `#0A0C12` (void)
- **Surfaces:** `#111520` / `#161B28`
- **Acento:** `#F59E0B` (amber — ações primárias, logo, badges activos)
- **Tipografia:** IBM Plex Sans + IBM Plex Mono
- **Severidade:** critical `#EF4444` / high `#F97316` / medium `#EAB308` / low `#22C55E`
- **Cards:** borda esquerda colorida por prioridade, fundo levemente tintado

---

## Testes

| Arquivo | Casos |
|---|---|
| `offline_queue_test.dart` | SyncResult (success/errors/conflicts), OfflineQueueService sem conectividade |
| `auth_provider_test.dart` | AuthState, AuthNotifier (login, erro 401, rede, logout, sucesso), AppUser (roles, initials) |

**Nota:** Testes de widget e integração completos requerem o ambiente Flutter configurado. Os testes unitários acima rodam com `flutter test` no ambiente de CI.

---

## Android Flavor Commands

```bash
# Rodar em desenvolvimento
flutter run --flavor citizen --target lib/main_citizen.dart
flutter run --flavor agent   --target lib/main_agent.dart

# Build APK release
flutter build apk --flavor citizen --target lib/main_citizen.dart --release
flutter build apk --flavor agent   --target lib/main_agent.dart   --release

# Build App Bundle (Google Play)
flutter build appbundle --flavor citizen --target lib/main_citizen.dart --release
```

---

## Decisões Técnicas

| Decisão | Escolha | Motivo |
|---|---|---|
| Estado | Riverpod 2 (StateNotifier) | Testável, sem boilerplate, bom DX com Dart |
| Navegação | GoRouter | Deep links FCM, ShellRoute para bottom nav, redirect por role |
| Offline | Hive | Rápido, puro Dart, sem SQLite setup |
| HTTP | Dio | Interceptors maduros, cancelamento, multipart |
| Mapas | flutter_map + OSM/CartoDB | Gratuito, customizável, sem quota |
| Notificações | firebase_messaging + flutter_local_notifications | FCM para push remoto, local para foreground |
| Localização | geolocator + geocoding | Permissões gerenciadas, stream para live tracking |
| Auth storage | flutter_secure_storage | EncryptedSharedPreferences Android + Keychain iOS |

---

## Próximos Passos — Sprint 5 (Alertas Avançados + Analytics Mobile)

1. **Segmentação geográfica real** — PostGIS para filtrar usuários dentro de polígonos de região
2. **Analytics no app do agente** — Dashboard com métricas do próprio desempenho
3. **Notificação sonora customizada** — Som de sirene para alertas críticos
4. **Widget Android** — Contador de ocorrências abertas na tela inicial
5. **Modo escuro/claro** — Suporte a tema do sistema (atualmente forçado dark)
6. **Testes de widget** — LoginScreen, OtpScreen, ReportScreen, OccurrenceCard
7. **iOS support** — Testar permissões, push notifications, app distribution TestFlight
8. **Accessibilidade** — Semantic labels, contraste mínimo WCAG AA
