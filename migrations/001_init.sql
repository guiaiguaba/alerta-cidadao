-- =============================================================
-- ALERTA CIDADÃO — Migration 001: Esquema inicial
-- =============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =============================================================
-- TENANTS
-- =============================================================
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          VARCHAR(63) NOT NULL UNIQUE,          -- subdomínio: iguaba
  name          VARCHAR(255) NOT NULL,
  plan          VARCHAR(50) NOT NULL DEFAULT 'free',  -- free | basic | pro
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);

-- =============================================================
-- USERS
-- =============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  firebase_uid  VARCHAR(128) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  name          VARCHAR(255),
  avatar_url    TEXT,
  role          VARCHAR(20) NOT NULL DEFAULT 'citizen'
                  CHECK (role IN ('citizen', 'agent', 'admin')),
  fcm_token     TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, firebase_uid),
  UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant        ON users(tenant_id);
CREATE INDEX idx_users_firebase_uid  ON users(firebase_uid);
CREATE INDEX idx_users_role          ON users(tenant_id, role);

-- =============================================================
-- CATEGORIAS
-- =============================================================
CREATE TABLE categorias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome        VARCHAR(100) NOT NULL,
  icone       VARCHAR(100),
  cor         VARCHAR(7),              -- hex
  ativa       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categorias_tenant ON categorias(tenant_id);

-- Categorias padrão são inseridas via seed por tenant

-- =============================================================
-- OCORRENCIAS
-- =============================================================
CREATE TABLE ocorrencias (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  agent_id        UUID REFERENCES users(id),          -- agente responsável
  categoria_id    UUID REFERENCES categorias(id),

  descricao       TEXT NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'aberta'
                    CHECK (status IN ('aberta','em_andamento','resolvida','cancelada')),
  prioridade      VARCHAR(20) NOT NULL DEFAULT 'normal'
                    CHECK (prioridade IN ('baixa','normal','alta','critica')),

  -- Geolocalização
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  geo             GEOGRAPHY(POINT, 4326),             -- PostGIS para queries espaciais
  endereco        TEXT,

  -- Controle offline
  client_id       VARCHAR(64) UNIQUE,                 -- UUID gerado no app (offline dedup)
  synced_at       TIMESTAMPTZ,

  -- Resolução
  resolucao_nota  TEXT,
  resolvida_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atualiza geo automaticamente a partir de lat/lng
CREATE OR REPLACE FUNCTION ocorrencias_set_geo()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geo := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ocorrencias_geo
  BEFORE INSERT OR UPDATE OF latitude, longitude ON ocorrencias
  FOR EACH ROW EXECUTE FUNCTION ocorrencias_set_geo();

CREATE INDEX idx_ocorrencias_tenant      ON ocorrencias(tenant_id);
CREATE INDEX idx_ocorrencias_user        ON ocorrencias(tenant_id, user_id);
CREATE INDEX idx_ocorrencias_status      ON ocorrencias(tenant_id, status);
CREATE INDEX idx_ocorrencias_prioridade  ON ocorrencias(tenant_id, prioridade);
CREATE INDEX idx_ocorrencias_geo         ON ocorrencias USING GIST(geo);
CREATE INDEX idx_ocorrencias_created     ON ocorrencias(tenant_id, created_at DESC);
CREATE INDEX idx_ocorrencias_client_id   ON ocorrencias(client_id);

-- =============================================================
-- OCORRENCIA_IMAGENS
-- =============================================================
CREATE TABLE ocorrencia_imagens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ocorrencia_id   UUID NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  uploader_id     UUID NOT NULL REFERENCES users(id),
  url             TEXT NOT NULL,
  storage_key     TEXT NOT NULL,        -- chave no S3/MinIO
  tipo            VARCHAR(20) NOT NULL DEFAULT 'registro'
                    CHECK (tipo IN ('registro','antes','depois')),
  tamanho_bytes   INTEGER,
  mime_type       VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_imagens_ocorrencia ON ocorrencia_imagens(ocorrencia_id);
CREATE INDEX idx_imagens_tenant     ON ocorrencia_imagens(tenant_id);

-- =============================================================
-- AUDITORIA_LOGS
-- =============================================================
CREATE TABLE auditoria_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  acao        VARCHAR(100) NOT NULL,
  entidade    VARCHAR(100),
  entidade_id UUID,
  payload     JSONB,
  ip          VARCHAR(45),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant   ON auditoria_logs(tenant_id);
CREATE INDEX idx_audit_user     ON auditoria_logs(tenant_id, user_id);
CREATE INDEX idx_audit_entidade ON auditoria_logs(tenant_id, entidade, entidade_id);
CREATE INDEX idx_audit_created  ON auditoria_logs(tenant_id, created_at DESC);

-- =============================================================
-- NOTIFICACOES
-- =============================================================
CREATE TABLE notificacoes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ocorrencia_id   UUID REFERENCES ocorrencias(id),
  titulo          VARCHAR(255) NOT NULL,
  corpo           TEXT NOT NULL,
  tipo            VARCHAR(50) NOT NULL DEFAULT 'alerta',
  enviada         BOOLEAN NOT NULL DEFAULT FALSE,
  enviada_at      TIMESTAMPTZ,
  erros           JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_tenant ON notificacoes(tenant_id, created_at DESC);

-- =============================================================
-- UPDATED_AT trigger genérico
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated    BEFORE UPDATE ON tenants    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated      BEFORE UPDATE ON users      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ocorrencias_updated BEFORE UPDATE ON ocorrencias FOR EACH ROW EXECUTE FUNCTION set_updated_at();
