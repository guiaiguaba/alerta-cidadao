# 🚨 Alerta Cidadão — SaaS Multi-Tenant

Sistema de gestão de ocorrências municipais com suporte a múltiplos municípios (tenants), app Flutter, painel Next.js e backend NestJS.

---

## 📁 Estrutura do Projeto

```
alerta-cidadao/
├── backend/          # NestJS API
├── frontend/         # Next.js Admin Panel
├── mobile/           # Flutter App (cidadão + agente + admin)
├── migrations/       # SQL migrations PostgreSQL
├── infra/
│   └── nginx/        # Configurações Nginx
├── docs/
│   └── DEPLOY_DEBIAN11.md
├── docker-compose.yml
└── .env.example
```

---

## 🏗️ Stack

| Camada      | Tecnologia                              |
|-------------|------------------------------------------|
| Backend     | NestJS 10, PostgreSQL 16 + PostGIS, Redis, Bull |
| Mobile      | Flutter 3, Firebase Auth, Hive, flutter_map |
| Web Admin   | Next.js 14, React Query, Recharts, Leaflet |
| Infra       | Docker, Nginx, MinIO, Debian 11          |
| Auth        | Firebase Authentication (Google + Email) |
| Push        | Firebase Cloud Messaging (FCM)           |
| Real-time   | Socket.io (WebSocket)                    |
| Storage     | MinIO (S3-compatible)                    |

---

## 🚀 Início Rápido (Desenvolvimento)

### Pré-requisitos
- Docker + Docker Compose
- Node.js 20+
- Flutter 3.19+
- Conta Firebase com projeto criado

### 1. Configurar Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Crie um projeto
3. Ative **Authentication** → Email/Senha + Google
4. Ative **Cloud Messaging**
5. Baixe `serviceAccountKey.json` em Configurações → Contas de serviço
6. Crie um app Android e baixe `google-services.json`

### 2. Configurar variáveis

```bash
cp .env.example .env
# Edite .env com seus valores
```

### 3. Subir serviços

```bash
docker compose up -d
```

### 4. Verificar

```bash
# API health
curl http://localhost:3001/health

# Criar primeiro tenant
curl -X POST http://localhost:3001/tenants \
  -H "Content-Type: application/json" \
  -d '{"slug":"iguaba","name":"Prefeitura de Iguaba Grande"}'
```

### 5. App Flutter

```bash
cd mobile

# Copiar google-services.json para android/app/
cp /path/to/google-services.json android/app/

flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3001
```

> Para emulador Android, use `10.0.2.2` em vez de `localhost`

---

## 🔐 Perfis de Acesso

| Perfil    | Permissões                                                  |
|-----------|--------------------------------------------------------------|
| `citizen` | Criar/ver próprias ocorrências, receber notificações        |
| `agent`   | Ver todas ocorrências do tenant, atualizar status, uploads  |
| `admin`   | Tudo acima + gerenciar usuários, ver stats, full control    |

Para promover um usuário a agente/admin, use a API:

```bash
curl -X PATCH http://localhost:3001/users/{userId}/role \
  -H "Authorization: Bearer {adminToken}" \
  -H "Content-Type: application/json" \
  -d '{"role":"agent"}'
```

---

## 📡 Endpoints Principais

```
POST   /auth/sync-user            Sincronizar usuário Firebase → DB
GET    /ocorrencias               Listar (filtrado por role)
POST   /ocorrencias               Criar (com idempotência via client_id)
GET    /ocorrencias/:id           Detalhe
PATCH  /ocorrencias/:id           Atualizar status/prioridade (agent+)
POST   /ocorrencias/:id/imagens   Upload fotos (multipart)
GET    /categorias                Categorias do tenant
GET    /tenants/stats             Estatísticas (admin)
GET    /users                     Listar usuários (agent+)
PATCH  /users/:id/role            Alterar perfil (admin)
```

---

## 🔄 Fluxo Offline-First (Mobile)

```
Criar Ocorrência
       │
       ├─► Online?  ──YES──► POST /ocorrencias ──► Upload imagens ──► ✅
       │
       └─► Offline ──────► Salvar em Hive (client_id único)
                                 │
                           Internet voltou
                                 │
                           SyncService.tentarSync()
                                 │
                        POST /ocorrencias (idempotente via client_id)
                                 │
                           Marcar sincronizado ✅
```

---

## 🧪 Testes

```bash
# Backend
cd backend
npm test
npm run test:cov   # cobertura mínima 70%

# Flutter
cd mobile
flutter test
```

---

## 🐳 Containers

| Serviço    | Porta interna | Função                  |
|------------|---------------|--------------------------|
| api        | 3001          | NestJS REST + WebSocket  |
| web        | 3000          | Next.js Admin            |
| postgres   | 5432          | Banco de dados           |
| redis      | 6379          | Cache + Filas Bull       |
| minio      | 9000 / 9001   | Object Storage / Console |
| nginx      | 80 / 443      | Reverse Proxy + SSL      |

---

## 📖 Deploy

Veja o guia completo em [`docs/DEPLOY_DEBIAN11.md`](docs/DEPLOY_DEBIAN11.md)

---

## 📄 Licença

Propriedade do cliente. Uso exclusivo conforme contrato.
