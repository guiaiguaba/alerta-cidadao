'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Helpers ─────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  aberta:       { label: 'Novo',       color: '#EF4444', bg: 'rgba(239,68,68,.12)' },
  em_andamento: { label: 'Em atend.',  color: '#FF6B2B', bg: 'rgba(255,107,43,.12)' },
  resolvida:    { label: 'Concluído',  color: '#22C55E', bg: 'rgba(34,197,94,.12)'  },
  cancelada:    { label: 'Cancelado',  color: '#6B7280', bg: 'rgba(107,114,128,.12)'},
};

const PRIO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  baixa:  { label: '• Baixo',  color: '#22C55E', bg: 'rgba(34,197,94,.12)'   },
  normal: { label: '• Médio',  color: '#EAB308', bg: 'rgba(234,179,8,.12)'   },
  alta:   { label: '• Alto',   color: '#F97316', bg: 'rgba(249,115,22,.12)'  },
  critica:{ label: '• Crítico',color: '#EF4444', bg: 'rgba(239,68,68,.12)'   },
};

const CAT_EMOJI: Record<string, string> = {
  desliz:'🏚️', alaga:'🌊', incên:'🔥', elétr:'⚡',
  via:'🚧', vazam:'💧', lixo:'🗑️', ilum:'💡',
};

function catEmoji(nome?: string) {
  const l = (nome ?? '').toLowerCase();
  for (const [k, v] of Object.entries(CAT_EMOJI)) if (l.includes(k)) return v;
  return '📍';
}

function timeAgo(iso?: string) {
  if (!iso) return '—';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR }); }
  catch { return '—'; }
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ color, background: bg, border: `1px solid ${color}44`, borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function Spinner() {
  return <div style={{ width: 32, height: 32, border: '3px solid #FF6B2B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />;
}

// ─── Main ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const { dbUser, loading, signOut } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [theme, setTheme]         = useState<'dark'|'light'>('dark');
  const [nav, setNav]             = useState('ocorrencias');
  const [statusFilter, setFilter] = useState<string|null>(null);
  const [now, setNow]             = useState(new Date());

  useEffect(() => { if (!loading && !dbUser) router.replace('/login'); }, [loading, dbUser, router]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  useEffect(() => { const s = localStorage.getItem('dash_theme'); if (s === 'light' || s === 'dark') setTheme(s); }, []);

  const toggleTheme = () => {
    const n = theme === 'dark' ? 'light' : 'dark';
    setTheme(n); localStorage.setItem('dash_theme', n);
  };

  const { data: stats }      = useQuery({ queryKey: ['stats'],      queryFn: () => api.get('/tenants/stats').then(r => r.data),          enabled: !!dbUser, refetchInterval: 30000 });
  const { data: ocorrs, refetch } = useQuery({ queryKey: ['ocorrs', statusFilter], queryFn: () => api.get(`/ocorrencias?limit=30${statusFilter ? `&status=${statusFilter}` : ''}`).then(r => r.data), enabled: !!dbUser, refetchInterval: 15000 });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/ocorrencias/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ocorrs'] }),
  });

  // ── theme tokens ─────────────────────────────────────────────
  const d = theme === 'dark';
  const c = {
    bg:      d ? '#0F1117' : '#F4F5F7',
    sidebar: d ? '#13161F' : '#1A1D27',
    surface: d ? '#1A1D27' : '#FFFFFF',
    card:    d ? '#21253A' : '#FFFFFF',
    border:  d ? '#2A2E3F' : '#E5E7EB',
    text:    d ? '#FFFFFF' : '#0F1117',
    muted:   d ? '#8B90A0' : '#6B7280',
    hover:   d ? '#ffffff08' : '#FF6B2B08',
  };

  const s     = stats?.ocorrencias;
  const items = (ocorrs?.data ?? []) as any[];

  if (loading || !dbUser) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Spinner />
      </div>
    );
  }

  const navItems = [
    { id: 'ocorrencias', icon: '📋', label: 'Ocorrências', badge: s?.abertas },
    { id: 'mapa',        icon: '🗺️', label: 'Mapa ao vivo' },
    { id: 'agentes',     icon: '👷', label: 'Agentes' },
    { id: 'relatorios',  icon: '📊', label: 'Relatórios' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: c.bg, fontFamily: "'Inter',-apple-system,sans-serif", color: c.text }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside style={{ width: 220, background: c.sidebar, display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <span style={{ fontWeight: 900, fontSize: 15, color: '#fff' }}>Defesa Civil</span>
          <span style={{ fontWeight: 900, fontSize: 15, color: '#FF6B2B' }}> — Painel</span>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.1, color: '#8B90A0', padding: '6px 8px', margin: '0 0 4px' }}>NAVEGAÇÃO</p>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setNav(item.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: nav === item.id ? 'rgba(255,107,43,0.15)' : 'transparent',
              color: nav === item.id ? '#FF6B2B' : '#8B90A0',
              fontWeight: nav === item.id ? 700 : 500, fontSize: 13,
              marginBottom: 2, textAlign: 'left', transition: 'all .15s',
            }}>
              <span>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge ? <span style={{ background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>{item.badge}</span> : null}
            </button>
          ))}

          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.1, color: '#8B90A0', padding: '14px 8px 4px', margin: 0 }}>ALERTAS</p>
          {[{ id: 'broadcast', icon: '📢', label: 'Broadcasts' }, { id: 'push', icon: '🔔', label: 'Push / SMS' }].map(item => (
            <button key={item.id} onClick={() => setNav(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: nav === item.id ? 'rgba(255,107,43,.15)' : 'transparent', color: nav === item.id ? '#FF6B2B' : '#8B90A0', fontWeight: 500, fontSize: 13, marginBottom: 2, textAlign: 'left' }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}

          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.1, color: '#8B90A0', padding: '14px 8px 4px', margin: 0 }}>CONFIG</p>
          {[{ id: 'config', icon: '⚙️', label: 'Configurações' }, { id: 'municipios', icon: '🏛️', label: 'Municípios' }].map(item => (
            <button key={item.id} onClick={() => setNav(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#8B90A0', fontWeight: 500, fontSize: 13, marginBottom: 2, textAlign: 'left' }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#FF6B2B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {(dbUser?.name?.[0] ?? 'A').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dbUser?.name ?? 'Usuário'}</p>
              <p style={{ fontSize: 10, color: '#8B90A0', margin: 0 }}>{dbUser?.role}</p>
            </div>
            <button onClick={() => signOut().then(() => router.replace('/login'))} title="Sair" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B90A0', padding: 4, fontSize: 15 }}>🚪</button>
          </div>
          <button onClick={toggleTheme} style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', cursor: 'pointer', color: '#8B90A0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {theme === 'dark' ? '☀️ Tema Claro' : '🌙 Tema Escuro'}
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{ background: c.sidebar, borderBottom: `1px solid ${c.border}`, padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Defesa Civil — Painel Central</span>
            <span style={{ background: 'rgba(239,68,68,.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,.3)', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '3px 8px', letterSpacing: .5 }}>● AO VIVO</span>
          </div>
          <span style={{ fontSize: 12, color: c.muted }}>
            Hoje, {now.getHours()}:{now.getMinutes().toString().padStart(2, '0')}
          </span>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { val: s?.abertas      ?? '—', label: 'Ocorrências Críticas', trend: '+2 última hora', color: '#EF4444' },
              { val: s?.total        ?? '—', label: 'Total Abertas',         trend: '+5 hoje',        color: '#FF6B2B' },
              { val: s?.em_andamento ?? '—', label: 'Em Atendimento',        trend: '→ estável',      color: '#FF8C5A' },
              { val: s?.resolvidas   ?? '—', label: 'Concluídas (mês)',      trend: '+8 vs mês ant.', color: '#22C55E' },
            ].map((st, i) => (
              <div key={i} style={{ background: c.card, borderRadius: 12, padding: '18px 20px', border: `1px solid ${c.border}`, borderTop: `3px solid ${st.color}` }}>
                <p style={{ fontSize: 34, fontWeight: 800, margin: '0 0 4px', lineHeight: 1 }}>{st.val}</p>
                <p style={{ fontSize: 12, color: c.muted, margin: '0 0 8px' }}>{st.label}</p>
                <p style={{ fontSize: 11, color: st.color, margin: 0, fontWeight: 700 }}>{st.trend}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: c.card, borderRadius: 12, border: `1px solid ${c.border}` }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Ocorrências Recentes</span>
                {items.length > 0 && <span style={{ background: '#FF6B2B', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{items.length}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[null, 'aberta', 'em_andamento', 'resolvida'].map(f => (
                  <button key={f ?? 'all'} onClick={() => setFilter(f)} style={{
                    padding: '5px 12px', borderRadius: 20,
                    border: `1px solid ${statusFilter === f ? '#FF6B2B' : c.border}`,
                    background: statusFilter === f ? 'rgba(255,107,43,.12)' : 'transparent',
                    color: statusFilter === f ? '#FF6B2B' : c.muted,
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}>
                    {f === null ? 'Todos' : f.replace('_', ' ')}
                  </button>
                ))}
                <button onClick={() => refetch()} style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${c.border}`, background: 'transparent', color: c.muted, cursor: 'pointer', fontSize: 13 }}>↺</button>
              </div>
            </div>

            {/* Col labels */}
            <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 160px 110px 110px 110px', padding: '10px 20px', borderBottom: `1px solid ${c.border}` }}>
              {['#', 'OCORRÊNCIA', 'LOCALIZAÇÃO', 'PRIORIDADE', 'STATUS', 'AÇÃO'].map((h, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: .8, color: c.muted }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: c.muted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <p style={{ margin: 0, fontSize: 14 }}>Nenhuma ocorrência encontrada</p>
              </div>
            ) : items.map((o: any, i: number) => {
              const sc = STATUS_CFG[o.status]   ?? STATUS_CFG.cancelada;
              const pc = PRIO_CFG[o.prioridade] ?? PRIO_CFG.normal;
              return (
                <div key={o.id}
                  style={{ display: 'grid', gridTemplateColumns: '56px 1fr 160px 110px 110px 110px', padding: '13px 20px', borderBottom: `1px solid ${c.border}`, transition: 'background .12s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget.style.background = c.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 11, color: c.muted, alignSelf: 'center' }}>#{String(8843 + i).padStart(4, '0')}</span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13 }}>{catEmoji(o.categoria_nome)}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.categoria_nome ?? 'Ocorrência'}</span>
                    </div>
                    <span style={{ fontSize: 11, color: c.muted }}>{o.endereco ?? o.descricao?.slice(0, 35)} — {timeAgo(o.created_at)}</span>
                  </div>

                  <span style={{ fontSize: 12, color: c.muted, alignSelf: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.endereco?.split(',')[0] ?? '—'}</span>
                  <div style={{ alignSelf: 'center' }}><Pill {...pc} /></div>
                  <div style={{ alignSelf: 'center' }}><Pill {...sc} /></div>

                  <div style={{ alignSelf: 'center' }}>
                    {o.status === 'aberta' && (
                      <button onClick={() => updateMut.mutate({ id: o.id, status: 'em_andamento' })}
                        style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: 'transparent', color: c.text, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        Designar
                      </button>
                    )}
                    {o.status === 'em_andamento' && (
                      <button onClick={() => updateMut.mutate({ id: o.id, status: 'resolvida' })}
                        style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: 'rgba(34,197,94,.12)', color: '#22C55E', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        ✓ Resolver
                      </button>
                    )}
                    {o.status === 'resolvida' && (
                      <span style={{ fontSize: 12, color: c.muted }}>Ver log</span>
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
