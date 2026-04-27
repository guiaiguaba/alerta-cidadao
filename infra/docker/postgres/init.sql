-- infra/docker/postgres/init.sql
-- Executado automaticamente ao iniciar o container pela primeira vez

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- busca fuzzy por endereço

-- =============================================
-- FUNÇÃO: Provisionar schema para novo tenant
-- =============================================
CREATE OR REPLACE FUNCTION provision_tenant_schema(schema_name TEXT)
RETURNS VOID AS $$
DECLARE
  sql TEXT;
BEGIN
  -- 1. Criar o schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
  
  -- 2. Setar search_path para o novo schema
  EXECUTE format('SET search_path = %I, public', schema_name);
  
  -- 3. Criar todas as tabelas no novo schema
  -- (As migrations do Prisma serão executadas pelo API ao provisionar)
  
  RAISE NOTICE 'Schema % criado com sucesso', schema_name;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SCHEMA PÚBLICO — Tabela de tenants
-- =============================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(63) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    display_name    VARCHAR(255) NOT NULL,
    subdomain       VARCHAR(63) UNIQUE NOT NULL,
    primary_color   VARCHAR(7) DEFAULT '#1565C0',
    secondary_color VARCHAR(7) DEFAULT '#FF6F00',
    logo_url        TEXT,
    state_code      CHAR(2) NOT NULL,
    city_ibge_code  VARCHAR(7),
    center_lat      DECIMAL(10, 8),
    center_lng      DECIMAL(11, 8),
    default_zoom    INT DEFAULT 13,
    geo_radius_km   INT DEFAULT 30,       -- raio máximo para cadastro de cidadãos (km)
    is_active       BOOLEAN DEFAULT true,
    schema_name     VARCHAR(63) UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SCHEMA PÚBLICO — Configurações por tenant
-- =============================================
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    tenant_id               UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- SLA por severidade (minutos)
    sla_critical_min        INT DEFAULT 30,
    sla_high_min            INT DEFAULT 120,
    sla_medium_min          INT DEFAULT 480,
    sla_low_min             INT DEFAULT 1440,

    -- Anti-spam
    max_occ_per_user_day    INT DEFAULT 5,
    max_occ_per_user_hour   INT DEFAULT 2,
    cooldown_minutes        INT DEFAULT 15,

    -- FCM próprio (configurável por tenant)
    fcm_server_key          TEXT,
    use_shared_fcm          BOOLEAN DEFAULT true,

    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TENANT DEMO para desenvolvimento
-- =============================================
INSERT INTO public.tenants (
    slug, name, display_name, subdomain,
    state_code, city_ibge_code,
    center_lat, center_lng, default_zoom,
    schema_name, is_active
) VALUES (
    'demo',
    'Prefeitura Demo',
    'Demo City',
    'demo',
    'RJ',
    '3300001',
    -22.8486,
    -42.0085,
    13,
    'tenant_demo',
    true
) ON CONFLICT DO NOTHING;

INSERT INTO public.tenants (
    slug, name, display_name, subdomain,
    state_code, city_ibge_code,
    center_lat, center_lng, default_zoom,
    schema_name, is_active
) VALUES (
    'iguaba-grande',
    'Prefeitura de Iguaba Grande',
    'Iguaba Grande',
    'iguaba',
    'RJ',
    '3300001',
    -22.8486,
    -42.0085,
    13,
    'tenant_iguaba_grande',
    true
) ON CONFLICT DO NOTHING;

-- =============================================
-- TENANT SETTINGS para tenants de demo
-- =============================================
INSERT INTO public.tenant_settings (tenant_id)
SELECT id FROM public.tenants WHERE slug IN ('demo', 'iguaba-grande')
ON CONFLICT DO NOTHING;

SELECT 'Init SQL executado com sucesso ✅' AS status;
