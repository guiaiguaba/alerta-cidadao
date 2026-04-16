'use client';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────
type Ocorrencia = {
  id: string;
  descricao: string;
  status: string;
  prioridade: string;
  categoria_nome?: string;
  endereco?: string;
  latitude: number;
  longitude: number;
  created_at: string;
  autor_nome?: string;
  agent_id?: string;
  agente_nome?: string;
};

// ─── Helpers ─────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  aberta:       { label: 'Novo',      color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  em_andamento: { label: 'Em atend.', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  resolvida:    { label: 'Concluído', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  cancelada:    { label: 'Cancelado', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
};

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  baixa:  { label: '• Baixo',   color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  normal: { label: '• Médio',   color: '#EAB308', bg: 'rgba(234,179,8,0.12)' },
  alta:   { label: '• Alto',    color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  critica:{ label: '• Crítico', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

const CAT_ICONS: Record<string, string> = {
  desliz: '🏚️', alaga: '🌊', incên: '🔥', elétr: '⚡',
  via: '🚧', vazam: '💧', lixo: '🗑️',
};

function catIcon(nome?: string) {
  if (!nome) return '⚠️';
  const lower = nome.toLowerCase();
  for (const [k, v] of Object.entries(CAT_ICONS)) if (lower.includes(k)) return v;
  return '📍';
}

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch { return '—'; }
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ color, background: bg, border: `1px solid ${color}33` }}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap">
      {label}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────
export default function DashboardPage() {
  const { dbUser, loading, signOut } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeNav, setActiveNav] = useState('ocorrencias');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [liveAlert, setLiveAlert] = useState<Ocorrencia | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => { if (!loading && !dbUser) router.push('/login'); }, [loading, dbUser, router]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);

  // Load theme preference
  useEffect(() => {
    const saved = localStorage.getItem('dashboard_theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('dashboard_theme', next);
  };

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/tenants/stats').then(r => r.data),
    enabled: !!dbUser,
    refetchInterval: 30_000,
  });

  const { data: ocorrencias, refetch } = useQuery({
    queryKey: ['ocorrencias', statusFilter],
    queryFn: () => api.get(`/ocorrencias?limit=30${statusFilter ? `&status=${statusFilter}` : ''}`).then(r => r.data),
    enabled: !!dbUser,
    refetchInterval: 15_000,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/ocorrencias/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ocorrencias'] }),
  });

  // Simulate live alert on new critical ocorrencia
  useEffect(() => {
    const items: Ocorrencia[] = ocorrencias?.data ?? [];
    const newest = items.find(o => o.prioridade === 'critica' || o.prioridade === 'alta');
    if (newest) setLiveAlert(newest);
  }, [ocorrencias]);

  const d = theme === 'dark';
  const s = stats?.ocorrencias;

  // ── CSS vars per theme ───────────────────────────────────────
  const css = {
    bg:       d ? '#0F1117' : '#F0F2F8',
    sidebar:  d ? '#13161F' : '#1E2235',
    surface:  d ? '#1A1D27' : '#FFFFFF',
    card:     d ? '#21253A' : '#FFFFFF',
    border:   d ? '#2E3347' : '#E2E6F0',
    text:     d ? '#FFFFFF' : '#0F1117',
    muted:    d ? '#8B90A0' : '#6B7280',
    hover:    d ? '#ffffff0a' : '#00000008',
  };

  if (loading || !dbUser) return (
    <div style={{ background: css.bg }} className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const items: Ocorrencia[] = ocorrencias?.data ?? [];
  const tenant = dbUser.tenant_slug || window.location.hostname.split('.')[0];

  return (
    <div style={{ background: css.bg, color: css.text, minHeight: '100vh', display: 'flex', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside style={{ width: 220, background: css.sidebar, borderRight: `1px solid #ffffff10`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #ffffff10' }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>
            <span style={{ color: '#fff' }}>Defesa Civil</span>
            <span style={{ color: '#FF6B2B' }}> — Painel</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.1, color: '#8B90A0', padding: '8px 10px 4px' }}>NAVEGAÇÃO</p>
          {[
            { id: 'ocorrencias', icon: '📋', label: 'Ocorrências', badge: s?.abertas },
            { id: 'mapa', icon: '🗺️', label: 'Mapa ao vivo' },
            { id: 'agentes', icon: '👷', label: 'Agentes', badge: 3 },
            { id: 'relatorios', icon: '📊', label: 'Relatórios' },
          ].map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeNav === item.id ? 'rgba(255,107,43,0.15)' : 'transparent',
                color: activeNav === item.id ? '#FF6B2B' : '#8B90A0',
                fontWeight: activeNav === item.id ? 700 : 500, fontSize: 13,
                marginBottom: 2, textAlign: 'left',
              }}>
              <span>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge ? (
                <span style={{ background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}

          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.1, color: '#8B90A0', padding: '16px 10px 4px' }}>ALERTAS</p>
          {[{ id: 'broadcast', icon: '📢', label: 'Broadcasts' }, { id: 'push', icon: '🔔', label: 'Push / SMS' }].map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeNav === item.id ? 'rgba(255,107,43,0.15)' : 'transparent',
                color: activeNav === item.id ? '#FF6B2B' : '#8B90A0',
                fontWeight: 500, fontSize: 13, marginBottom: 2, textAlign: 'left',
              }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}

          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.1, color: '#8B90A0', padding: '16px 10px 4px' }}>CONFIG</p>
          {[{ id: 'config', icon: '⚙️', label: 'Configurações' }, { id: 'municipios', icon: '🏛️', label: 'Municípios' }].map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'transparent', color: '#8B90A0', fontWeight: 500, fontSize: 13, marginBottom: 2, textAlign: 'left',
              }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User + theme */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #ffffff10' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FF6B2B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {(dbUser.name?.[0] ?? 'A').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dbUser.name}</p>
              <p style={{ fontSize: 10, color: '#8B90A0', margin: 0 }}>{dbUser.role}</p>
            </div>
            <button onClick={signOut} title="Sair"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B90A0', padding: 4, fontSize: 14 }}>🚪</button>
          </div>
          {/* Theme toggle */}
          <button onClick={toggleTheme}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #ffffff15', background: '#ffffff08', cursor: 'pointer', color: '#8B90A0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {theme === 'dark' ? '☀️ Tema Claro' : '🌙 Tema Escuro'}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{ background: d ? '#13161F' : css.surface, borderBottom: `1px solid ${css.border}`, padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: css.text }}>Defesa Civil — Painel Central</span>
            <span style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '3px 8px', letterSpacing: 0.5 }}>
              ● AO VIVO
            </span>
          </div>
          <div style={{ fontSize: 12, color: css.muted }}>
            Prefeitura de {tenant.charAt(0).toUpperCase() + tenant.slice(1)} — RJ &nbsp;·&nbsp; Hoje, {now.getHours()}:{now.getMinutes().toString().padStart(2, '0')}
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* ── Stats row ───────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { value: s?.abertas ?? '—', label: 'Ocorrências Críticas', trend: '+2 última hora', trendUp: true, accent: '#EF4444' },
              { value: s?.total ?? '—', label: 'Total Abertas', trend: '+5 hoje', trendUp: true, accent: '#F97316' },
              { value: s?.em_andamento ?? '—', label: 'Em Atendimento', trend: '→ estável', trendUp: null, accent: '#3B82F6' },
              { value: s?.resolvidas ?? '—', label: 'Concluídas (mês)', trend: '+8 vs mês ant.', trendUp: true, accent: '#22C55E' },
            ].map((st, i) => (
              <div key={i} style={{ background: css.card, borderRadius: 12, padding: 20, border: `1px solid ${css.border}`, borderTop: `3px solid ${st.accent}` }}>
                <p style={{ fontSize: 36, fontWeight: 800, color: css.text, margin: '0 0 4px', lineHeight: 1 }}>{st.value}</p>
                <p style={{ fontSize: 12, color: css.muted, margin: '0 0 8px' }}>{st.label}</p>
                <p style={{ fontSize: 11, color: st.trendUp === true ? '#22C55E' : st.trendUp === false ? '#EF4444' : css.muted, margin: 0, fontWeight: 600 }}>
                  {st.trend}
                </p>
              </div>
            ))}
          </div>

          {/* ── Live alert banner ──────────────────────────── */}
          {liveAlert && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 12, padding: '14px 18px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 24 }}>🚨</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: 1, padding: '2px 7px', borderRadius: 4 }}>NOVA</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: css.text }}>
                    {liveAlert.categoria_nome ?? 'Ocorrência'} — {liveAlert.endereco ?? 'Localização não informada'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: css.muted, margin: 0 }}>
                  Severidade: {liveAlert.prioridade.charAt(0).toUpperCase() + liveAlert.prioridade.slice(1)} · Protocolo #AC-2024-{liveAlert.id.slice(-4).toUpperCase()} · Registrada por {liveAlert.autor_nome ?? 'Cidadão'}
                </p>
              </div>
              <span style={{ fontSize: 12, color: css.muted }}>agora mesmo</span>
            </div>
          )}

          {/* ── Ocorrências table ──────────────────────────── */}
          <div style={{ background: css.card, borderRadius: 12, border: `1px solid ${css.border}` }}>
            {/* Table header */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${css.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: css.text }}>Ocorrências Recentes</span>
                {items.length > 0 && (
                  <span style={{ background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '2px 7px' }}>
                    {items.length}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[null, 'aberta', 'em_andamento', 'resolvida'].map(s => (
                  <button key={s ?? 'all'} onClick={() => setStatusFilter(s)}
                    style={{
                      padding: '5px 12px', borderRadius: 20, border: `1px solid ${statusFilter === s ? '#FF6B2B' : css.border}`,
                      background: statusFilter === s ? 'rgba(255,107,43,0.12)' : 'transparent',
                      color: statusFilter === s ? '#FF6B2B' : css.muted,
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}>
                    {s === null ? 'Todos' : s.replace('_', ' ')}
                  </button>
                ))}
                <button onClick={() => refetch()}
                  style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${css.border}`, background: 'transparent', color: css.muted, cursor: 'pointer', fontSize: 12 }}>
                  ↺
                </button>
              </div>
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 180px 110px 110px 120px', gap: 0, padding: '10px 20px', borderBottom: `1px solid ${css.border}` }}>
              {['#', 'OCORRÊNCIA', 'LOCALIZAÇÃO', 'PRIORIDADE', 'STATUS', 'AÇÃO'].map((h, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: css.muted }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: css.muted }}>
                <p style={{ fontSize: 32 }}>📭</p>
                <p>Nenhuma ocorrência</p>
              </div>
            ) : items.map((o, i) => {
              const sc = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.cancelada;
              const pc = PRIORIDADE_CONFIG[o.prioridade] ?? PRIORIDADE_CONFIG.normal;
              const proto = `#${String(i + 8843).padStart(4, '0')}`;
              return (
                <div key={o.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '60px 1fr 180px 110px 110px 120px',
                    gap: 0, padding: '14px 20px', borderBottom: `1px solid ${css.border}`,
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = css.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 12, color: css.muted, alignSelf: 'center' }}>{proto}</span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{catIcon(o.categoria_nome)}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, color: css.text }}>{o.categoria_nome ?? 'Ocorrência'}</span>
                    </div>
                    <span style={{ fontSize: 11, color: css.muted }}>
                      {o.endereco ?? o.descricao.slice(0, 40)} — {timeAgo(o.created_at)}
                    </span>
                  </div>

                  <span style={{ fontSize: 12, color: css.muted, alignSelf: 'center' }}>
                    {o.endereco?.split(',')[0] ?? 'Centro'}
                  </span>

                  <div style={{ alignSelf: 'center' }}>
                    <Badge label={pc.label} color={pc.color} bg={pc.bg} />
                  </div>

                  <div style={{ alignSelf: 'center' }}>
                    <Badge label={sc.label} color={sc.color} bg={sc.bg} />
                  </div>

                  <div style={{ alignSelf: 'center' }}>
                    {o.status === 'aberta' && (
                      <button
                        onClick={() => updateMut.mutate({ id: o.id, status: 'em_andamento' })}
                        style={{
                          padding: '5px 12px', borderRadius: 8, border: `1px solid ${css.border}`,
                          background: 'transparent', color: css.text, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}>
                        Designar
                      </button>
                    )}
                    {o.status === 'em_andamento' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600 }}>
                          {o.agente_nome?.split(' ').slice(0, 2).join(' ') ?? 'Ag.'}
                        </span>
                        <button
                          onClick={() => updateMut.mutate({ id: o.id, status: 'resolvida' })}
                          style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: 'rgba(34,197,94,0.12)', color: '#22C55E', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                          ✓
                        </button>
                      </div>
                    )}
                    {o.status === 'resolvida' && (
                      <button style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${css.border}`, background: 'transparent', color: css.muted, cursor: 'pointer', fontSize: 12 }}>
                        Ver log
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
