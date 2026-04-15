-- Migration 002: Tenant de demonstração
-- Execute apenas em ambiente de desenvolvimento/staging

BEGIN;

-- Tenant demo
INSERT INTO tenants (id, slug, name, plan)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo',
  'Prefeitura Demo',
  'pro'
) ON CONFLICT (slug) DO NOTHING;

-- Categorias para o tenant demo
INSERT INTO categorias (tenant_id, nome, icone, cor) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Buraco na Via',    'road',     '#F59E0B'),
  ('00000000-0000-0000-0000-000000000001', 'Iluminação',       'lightbulb','#EAB308'),
  ('00000000-0000-0000-0000-000000000001', 'Enchente',         'water',    '#3B82F6'),
  ('00000000-0000-0000-0000-000000000001', 'Incêndio',         'fire',     '#EF4444'),
  ('00000000-0000-0000-0000-000000000001', 'Lixo/Entulho',     'trash',    '#84CC16'),
  ('00000000-0000-0000-0000-000000000001', 'Deslizamento',     'mountain', '#78716C'),
  ('00000000-0000-0000-0000-000000000001', 'Outros',           'alert',    '#6B7280')
ON CONFLICT DO NOTHING;

COMMIT;
