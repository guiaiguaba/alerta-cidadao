-- =============================================
-- MIGRATION: Criar tabelas no schema do tenant
-- Executada via: SET search_path = tenant_{slug}
-- =============================================

-- USUÁRIOS
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(20) UNIQUE,
    name            VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    password_hash   TEXT,
    google_id       VARCHAR(255) UNIQUE,
    phone_verified  BOOLEAN DEFAULT false,
    email_verified  BOOLEAN DEFAULT false,
    role            VARCHAR(20) NOT NULL DEFAULT 'citizen',
    home_lat        DECIMAL(10, 8),
    home_lng        DECIMAL(11, 8),
    fcm_tokens      TEXT[] DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    is_blocked      BOOLEAN DEFAULT false,
    blocked_reason  TEXT,
    blocked_until   TIMESTAMPTZ,
    -- Ativação via código (agentes convidados pelo painel)
    activation_code         CHAR(6),
    activation_expires_at   TIMESTAMPTZ,
    is_activated            BOOLEAN DEFAULT true, -- false apenas para agentes convidados
    must_change_password    BOOLEAN DEFAULT false,
    -- Aprovação de cadastro (cidadãos fora da área são bloqueados no app)
    registration_status     VARCHAR(20) DEFAULT 'approved', -- approved | pending | rejected
    registration_lat        DECIMAL(10, 8),  -- GPS no momento do cadastro
    registration_lng        DECIMAL(11, 8),
    rejection_reason        TEXT,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    device_info JSONB,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- REGIÕES
CREATE TABLE IF NOT EXISTS regions (
    code        VARCHAR(50) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    boundary    JSONB,
    center_lat  DECIMAL(10, 8),
    center_lng  DECIMAL(11, 8),
    is_active   BOOLEAN DEFAULT true,
    sort_order  INT DEFAULT 0
);

-- EQUIPES
CREATE TABLE IF NOT EXISTS teams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    region_codes    TEXT[] DEFAULT '{}',
    shift_start     TIME,
    shift_end       TIME,
    active_days     INT[] DEFAULT '{1,2,3,4,5}',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id     UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) DEFAULT 'member',
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

-- CATEGORIAS
CREATE TABLE IF NOT EXISTS categories (
    id               SERIAL PRIMARY KEY,
    code             VARCHAR(50) UNIQUE NOT NULL,
    name             VARCHAR(100) NOT NULL,
    description      TEXT,
    icon             VARCHAR(50),
    color            VARCHAR(7),
    default_priority VARCHAR(10) NOT NULL DEFAULT 'medium',
    requires_photo   BOOLEAN DEFAULT false,
    is_active        BOOLEAN DEFAULT true,
    sort_order       INT DEFAULT 0,
    parent_id        INT REFERENCES categories(id),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Seed de categorias padrão
INSERT INTO categories (code, name, icon, color, default_priority, sort_order) VALUES
  ('landslide',      'Deslizamento',        'landslide',      '#B71C1C', 'critical', 1),
  ('collapse',       'Desabamento',         'domain_disabled','#B71C1C', 'critical', 2),
  ('gas_leak',       'Vazamento de Gás',    'local_gas_station','#E53935','critical',3),
  ('flooding',       'Alagamento',          'water',          '#1565C0', 'high',     4),
  ('fallen_tree',    'Árvore Caída',        'park',           '#2E7D32', 'high',     5),
  ('traffic_accident','Acidente de Trânsito','car_crash',     '#F57F17', 'high',     6),
  ('pothole',        'Buraco na Via',       'construction',   '#FF8F00', 'medium',   7),
  ('no_lighting',    'Falta de Iluminação', 'lightbulb',      '#FFA000', 'medium',   8),
  ('illegal_waste',  'Lixo Irregular',      'delete',         '#546E7A', 'medium',   9),
  ('vandalism',      'Pichação',            'format_paint',   '#78909C', 'low',      10),
  ('damaged_sidewalk','Calçada Danificada', 'accessible',     '#90A4AE', 'low',      11),
  ('other',          'Outros',              'report',         '#9E9E9E', 'low',      99)
ON CONFLICT (code) DO NOTHING;

-- OCORRÊNCIAS
CREATE TABLE IF NOT EXISTS occurrences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol        VARCHAR(20) UNIQUE NOT NULL,
    category_id     INT NOT NULL REFERENCES categories(id),
    title           VARCHAR(255),
    description     TEXT,
    lat             DECIMAL(10, 8) NOT NULL,
    lng             DECIMAL(11, 8) NOT NULL,
    address         TEXT,
    region_code     VARCHAR(50) REFERENCES regions(code),
    priority        VARCHAR(10) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
    reporter_id     UUID NOT NULL REFERENCES users(id),
    assigned_to     UUID REFERENCES users(id),
    assigned_at     TIMESTAMPTZ,
    team_id         UUID REFERENCES teams(id),
    resolved_at     TIMESTAMPTZ,
    resolved_by     UUID REFERENCES users(id),
    resolution_note TEXT,
    rejection_reason TEXT,
    duplicate_of    UUID REFERENCES occurrences(id),
    sla_deadline    TIMESTAMPTZ,
    sla_breached    BOOLEAN DEFAULT false,
    is_public       BOOLEAN DEFAULT true,
    client_id       UUID,
    synced_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_occ_status   ON occurrences(status);
CREATE INDEX IF NOT EXISTS idx_occ_priority ON occurrences(priority);
CREATE INDEX IF NOT EXISTS idx_occ_reporter ON occurrences(reporter_id);
CREATE INDEX IF NOT EXISTS idx_occ_assigned ON occurrences(assigned_to);
CREATE INDEX IF NOT EXISTS idx_occ_region   ON occurrences(region_code);
CREATE INDEX IF NOT EXISTS idx_occ_created  ON occurrences(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_occ_client   ON occurrences(client_id) WHERE client_id IS NOT NULL;
-- Índice geoespacial (requer PostGIS)
CREATE INDEX IF NOT EXISTS idx_occ_geo ON occurrences
    USING GIST (ST_Point(lng::float8, lat::float8));

-- MÍDIA DAS OCORRÊNCIAS
CREATE TABLE IF NOT EXISTS occurrence_media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id   UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    url             TEXT NOT NULL,
    thumbnail_url   TEXT,
    media_type      VARCHAR(10) NOT NULL DEFAULT 'photo',
    phase           VARCHAR(10) DEFAULT 'report',
    file_size_bytes INT,
    mime_type       VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_occ ON occurrence_media(occurrence_id);

-- TIMELINE DAS OCORRÊNCIAS
CREATE TABLE IF NOT EXISTS occurrence_timeline (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id   UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    action          VARCHAR(50) NOT NULL,
    from_status     VARCHAR(20),
    to_status       VARCHAR(20),
    note            TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_occ ON occurrence_timeline(occurrence_id);

-- ALERTAS MASSIVOS
CREATE TABLE IF NOT EXISTS alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    alert_type      VARCHAR(30) NOT NULL,
    severity        VARCHAR(10) NOT NULL DEFAULT 'high',
    target_scope    VARCHAR(20) NOT NULL DEFAULT 'all',
    target_regions  TEXT[],
    target_lat      DECIMAL(10, 8),
    target_lng      DECIMAL(11, 8),
    target_radius_m INT,
    occurrence_id   UUID REFERENCES occurrences(id),
    created_by      UUID NOT NULL REFERENCES users(id),
    status          VARCHAR(20) DEFAULT 'draft',
    sent_at         TIMESTAMPTZ,
    recipients_count INT DEFAULT 0,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_reads (
    alert_id    UUID REFERENCES alerts(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (alert_id, user_id)
);

-- NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    body            TEXT,
    data            JSONB,
    is_read         BOOLEAN DEFAULT false,
    read_at         TIMESTAMPTZ,
    fcm_message_id  TEXT,
    delivery_status VARCHAR(20) DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user_unread
    ON notifications(user_id, created_at DESC)
    WHERE is_read = false;

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    user_email  VARCHAR(255),
    action      VARCHAR(100) NOT NULL,
    resource    VARCHAR(50) NOT NULL,
    resource_id TEXT,
    ip_address  INET,
    user_agent  TEXT,
    changes     JSONB,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs(user_id);

-- ANTI-SPAM
CREATE TABLE IF NOT EXISTS user_activity_limits (
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    occurrences_today   INT DEFAULT 0,
    last_occurrence_at  TIMESTAMPTZ,
    PRIMARY KEY (user_id, date)
);

-- STATS DIÁRIAS (pré-agregadas)
CREATE TABLE IF NOT EXISTS daily_stats (
    date                DATE NOT NULL,
    region_code         VARCHAR(50),
    category_id         INT REFERENCES categories(id),
    total_opened        INT DEFAULT 0,
    total_resolved      INT DEFAULT 0,
    total_rejected      INT DEFAULT 0,
    avg_resolution_min  DECIMAL(10, 2),
    sla_breaches        INT DEFAULT 0,
    PRIMARY KEY (date, COALESCE(region_code, ''), COALESCE(category_id::text, ''))
);
