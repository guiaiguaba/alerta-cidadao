'use client';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { adminApi } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  Settings, Palette, Tag, MapPin, Save, Loader2, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import GeoSettingsTab from '@/components/settings/GeoSettingsTab';

const TABS = [
  { id: 'tenant',     label: 'Geral',        icon: Settings },
  { id: 'appearance', label: 'Aparência',     icon: Palette },
  { id: 'geo',        label: 'Área de Cobertura', icon: MapPin },
  { id: 'categories', label: 'Categorias',    icon: Tag },
  { id: 'regions',    label: 'Regiões',       icon: MapPin },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('tenant');
  const [config,    setConfig]    = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [regions,    setRegions]    = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  // Form state
  const [displayName,    setDisplayName]    = useState('');
  const [primaryColor,   setPrimaryColor]   = useState('#F59E0B');
  const [secondaryColor, setSecondaryColor] = useState('#1565C0');
  const [logoUrl,        setLogoUrl]        = useState('');

  useEffect(() => {
    Promise.all([adminApi.getTenantConfig(), adminApi.getCategories(), adminApi.getRegions()])
      .then(([cfg, cats, regs]) => {
        setConfig(cfg);
        setCategories(cats);
        setRegions(regs);
        setDisplayName(cfg.display_name ?? '');
        setPrimaryColor(cfg.primary_color ?? '#F59E0B');
        setSecondaryColor(cfg.secondary_color ?? '#1565C0');
        setLogoUrl(cfg.logo_url ?? '');
      })
      .catch(() => toast.error('Erro ao carregar configurações'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveTenant() {
    setSaving(true);
    try {
      await adminApi.updateTenantConfig({
        displayName, primaryColor, secondaryColor, logoUrl,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success('Configurações salvas');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const SLA_CONFIG = [
    { key: 'sla_critical_min', label: 'Crítico', color: 'text-critical' },
    { key: 'sla_high_min',     label: 'Alto',    color: 'text-high' },
    { key: 'sla_medium_min',   label: 'Médio',   color: 'text-medium' },
    { key: 'sla_low_min',      label: 'Baixo',   color: 'text-low' },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="Configurações" subtitle="Gerencie sua prefeitura" />

      <div className="flex flex-1 overflow-hidden">
        {/* Tab sidebar */}
        <nav className="w-48 border-r border-border bg-surface/30 p-3 space-y-0.5 shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'nav-item w-full text-left',
                activeTab === id && 'nav-item-active',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={cn('h-10 bg-muted animate-pulse rounded', i % 2 === 0 ? 'w-3/4' : 'w-1/2')} />
              ))}
            </div>
          ) : (
            <>
              {/* ==================== GERAL ==================== */}
              {activeTab === 'tenant' && config && (
                <div className="max-w-xl space-y-6">
                  <div>
                    <h2 className="text-sm font-semibold text-primary mb-1">Informações da Prefeitura</h2>
                    <p className="text-xs text-tertiary font-mono">
                      Slug: <span className="text-secondary">{config.slug}</span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="data-label block mb-1.5">Nome de exibição</label>
                      <input
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="input"
                        placeholder="Nome da cidade"
                      />
                    </div>
                  </div>

                  {/* SLA settings (read-only display) */}
                  <div>
                    <h3 className="text-xs font-semibold text-secondary mb-3 uppercase tracking-wider">
                      Prazos SLA (minutos)
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {SLA_CONFIG.map(({ key, label, color }) => (
                        <div key={key} className="panel p-3 flex items-center justify-between">
                          <span className={cn('text-xs font-mono uppercase', color)}>{label}</span>
                          <span className="font-mono text-sm font-bold text-primary">
                            {config[key] ?? '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-2xs font-mono text-tertiary mt-2">
                      Para alterar os prazos de SLA, contate o suporte Alerta Cidadão.
                    </p>
                  </div>

                  {/* Anti-spam */}
                  <div>
                    <h3 className="text-xs font-semibold text-secondary mb-3 uppercase tracking-wider">
                      Anti-Spam
                    </h3>
                    <div className="panel p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-secondary">Máximo por dia (cidadão)</span>
                        <span className="font-mono text-sm font-bold text-primary">
                          {config.max_occ_per_user_day ?? 5} ocorrências
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-secondary">Cooldown entre registros</span>
                        <span className="font-mono text-sm font-bold text-primary">
                          {config.cooldown_minutes ?? 15} min
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveTenant}
                    disabled={saving}
                    className="btn-primary text-xs"
                  >
                    {saving ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
                    ) : saved ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-low" /> Salvo!</>
                    ) : (
                      <><Save className="w-3.5 h-3.5" /> Salvar Alterações</>
                    )}
                  </button>
                </div>
              )}

              {/* ==================== ÁREA DE COBERTURA ==================== */}
              {activeTab === 'geo' && (
                <GeoSettingsTab config={config} />
              )}

              {/* ==================== APARÊNCIA ==================== */}
              {activeTab === 'appearance' && (
                <div className="max-w-xl space-y-6">
                  <div>
                    <h2 className="text-sm font-semibold text-primary mb-4">Personalização Visual</h2>

                    <div className="space-y-4">
                      <div>
                        <label className="data-label block mb-2">URL do Logotipo</label>
                        <input
                          value={logoUrl}
                          onChange={e => setLogoUrl(e.target.value)}
                          className="input"
                          placeholder="https://..."
                        />
                        {logoUrl && (
                          <img src={logoUrl} alt="Logo" className="mt-2 h-12 object-contain" />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="data-label block mb-2">Cor Primária</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={primaryColor}
                              onChange={e => setPrimaryColor(e.target.value)}
                              className="w-10 h-10 rounded border border-border bg-transparent cursor-pointer"
                            />
                            <input
                              value={primaryColor}
                              onChange={e => setPrimaryColor(e.target.value)}
                              className="input font-mono text-xs"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="data-label block mb-2">Cor Secundária</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={secondaryColor}
                              onChange={e => setSecondaryColor(e.target.value)}
                              className="w-10 h-10 rounded border border-border bg-transparent cursor-pointer"
                            />
                            <input
                              value={secondaryColor}
                              onChange={e => setSecondaryColor(e.target.value)}
                              className="input font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="panel p-4">
                        <p className="data-label mb-3">Preview</p>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: `${primaryColor}22`, border: `1px solid ${primaryColor}44` }}
                          >
                            <Shield className="w-4 h-4" style={{ color: primaryColor }} />
                          </div>
                          <div>
                            <p className="text-sm font-bold" style={{ color: primaryColor }}>
                              {displayName || 'Nome da Cidade'}
                            </p>
                            <p className="text-2xs font-mono" style={{ color: secondaryColor }}>
                              Alerta Cidadão · Painel Admin
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveTenant}
                      disabled={saving}
                      className="btn-primary text-xs mt-4"
                    >
                      {saving ? 'Salvando...' : saved ? '✅ Salvo!' : 'Salvar Aparência'}
                    </button>
                  </div>
                </div>
              )}

              {/* ==================== CATEGORIAS ==================== */}
              {activeTab === 'categories' && (
                <div className="max-w-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-primary">
                      Categorias de Ocorrência ({categories.length})
                    </h2>
                  </div>

                  <div className="panel overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 data-label">Nome</th>
                          <th className="text-left px-4 py-2.5 data-label">Código</th>
                          <th className="text-left px-4 py-2.5 data-label">Prioridade</th>
                          <th className="text-left px-4 py-2.5 data-label">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {categories.map(cat => (
                          <tr key={cat.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ background: cat.color ?? '#6B7280' }}
                                />
                                <span className="text-sm text-primary">{cat.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-mono text-2xs text-tertiary">{cat.code}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`badge-${cat.default_priority}`}>
                                {cat.default_priority}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {cat.is_active
                                ? <span className="badge-low">Ativo</span>
                                : <span className="text-2xs font-mono text-tertiary">Inativo</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-2xs font-mono text-tertiary mt-3">
                    Para adicionar categorias customizadas, use a API admin ou contate o suporte.
                  </p>
                </div>
              )}

              {/* ==================== REGIÕES ==================== */}
              {activeTab === 'regions' && (
                <div className="max-w-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-primary">
                      Regiões / Bairros ({regions.length})
                    </h2>
                  </div>

                  <div className="panel divide-y divide-border/50 overflow-hidden">
                    {regions.map(r => (
                      <div key={r.code} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm text-primary">{r.name}</p>
                          <p className="text-2xs font-mono text-tertiary">{r.code}</p>
                        </div>
                        {r.is_active
                          ? <span className="badge-low">Ativa</span>
                          : <span className="text-2xs font-mono text-tertiary">Inativa</span>
                        }
                      </div>
                    ))}
                    {regions.length === 0 && (
                      <p className="text-center text-xs font-mono text-tertiary py-8">
                        Nenhuma região configurada
                      </p>
                    )}
                  </div>
                  <p className="text-2xs font-mono text-tertiary mt-3">
                    Para gerenciar regiões e seus polígonos, use a API admin.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
