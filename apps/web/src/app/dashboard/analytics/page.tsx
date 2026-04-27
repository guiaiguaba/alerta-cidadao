'use client';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { OccurrenceChart } from '@/components/analytics/OccurrenceChart';
import { analyticsApi } from '@/lib/api/client';
import { CategoryStat, AgentStat } from '@/types';
import { formatNumber, formatMinutes, PRIORITY_COLORS } from '@/lib/utils';
import { BarChart2, Download, Users, Tag } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const DATE_RANGES = [
  { label: '7 dias',  days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
];

export default function AnalyticsPage() {
  const [days,       setDays]       = useState(30);
  const [timeline,   setTimeline]   = useState<any[]>([]);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [agents,     setAgents]     = useState<AgentStat[]>([]);
  const [loading,    setLoading]    = useState(true);

  async function load(d: number) {
    setLoading(true);
    const from = new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
    const to   = new Date().toISOString().split('T')[0];

    try {
      const [tl, cats, ags] = await Promise.all([
        analyticsApi.timeline({ from, to, groupBy: d <= 14 ? 'day' : d <= 60 ? 'day' : 'week' }),
        analyticsApi.byCategory(d),
        analyticsApi.agents(d),
      ]);
      setTimeline(tl);
      setCategories(cats);
      setAgents(ags);
    } catch { toast.error('Erro ao carregar analytics'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(days); }, [days]);

  function handleExport(type: string, format: string) {
    const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const to   = new Date().toISOString().split('T')[0];
    const url  = analyticsApi.exportUrl({ format, type, from, to });
    window.open(url, '_blank');
    toast.success(`Exportando ${type} como ${format.toUpperCase()}`);
  }

  // Dados radar de categorias para os top 6
  const radarData = categories.slice(0, 6).map(c => ({
    name:         c.name,
    total:        Number(c.total),
    resolvidas:   Number(c.resolved),
    taxa:         Number(c.resolution_rate_pct ?? 0),
  }));

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Analytics"
        subtitle="Análise de desempenho e ocorrências"
        actions={
          <div className="flex items-center gap-2">
            {/* Range selector */}
            <div className="flex items-center gap-1 bg-panel border border-border rounded-md p-0.5">
              {DATE_RANGES.map(r => (
                <button
                  key={r.days}
                  onClick={() => setDays(r.days)}
                  className={`text-2xs font-mono px-2.5 py-1 rounded transition-colors ${
                    days === r.days
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'text-tertiary hover:text-secondary'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Export */}
            <div className="relative group">
              <button className="btn-secondary text-xs">
                <Download className="w-3.5 h-3.5" /> Exportar
              </button>
              <div className="absolute right-0 top-full mt-1 w-44 panel shadow-panel z-10 hidden group-hover:block">
                {[
                  ['occurrences', 'CSV', 'Ocorrências CSV'],
                  ['sla',         'CSV', 'SLA CSV'],
                  ['agents',      'CSV', 'Agentes CSV'],
                  ['occurrences', 'json', 'Dados JSON'],
                ].map(([type, fmt, label]) => (
                  <button
                    key={`${type}-${fmt}`}
                    onClick={() => handleExport(type, fmt)}
                    className="block w-full text-left px-3 py-2 text-xs text-secondary hover:text-primary hover:bg-muted transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Timeline */}
        <OccurrenceChart data={timeline} loading={loading} />

        {/* Categorias + Radar */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Top categorias */}
          <div className="panel p-5">
            <p className="data-label mb-4 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Por Categoria
            </p>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {categories.slice(0, 8).map(c => {
                  const pct = Math.min(100, Number(c.resolution_rate_pct ?? 0));
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-primary">{c.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-2xs font-mono text-tertiary">
                            {formatNumber(c.total)} total
                          </span>
                          <span className={`text-2xs font-mono ${pct >= 70 ? 'text-low' : pct >= 40 ? 'text-medium' : 'text-critical'}`}>
                            {pct.toFixed(0)}% resolvido
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: c.color || '#F59E0B',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Radar chart */}
          <div className="panel p-5">
            <p className="data-label mb-4">Distribuição por Tipo</p>
            {loading || radarData.length === 0 ? (
              <div className="h-48 animate-pulse bg-muted rounded" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1E2535" />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={{ fill: '#4E5A6B', fontFamily: 'IBM Plex Mono', fontSize: 10 }}
                  />
                  <Radar name="Total" dataKey="total" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} />
                  <Radar name="Resolvidas" dataKey="resolvidas" stroke="#22C55E" fill="#22C55E" fillOpacity={0.1} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Agentes */}
        <div className="panel p-5">
          <p className="data-label mb-4 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Performance de Agentes
          </p>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <p className="text-xs font-mono text-tertiary text-center py-6">
              Nenhum agente com atividade no período
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2.5 data-label">Agente</th>
                    <th className="text-right pb-2.5 data-label">Atribuídas</th>
                    <th className="text-right pb-2.5 data-label">Resolvidas</th>
                    <th className="text-right pb-2.5 data-label">Taxa</th>
                    <th className="text-right pb-2.5 data-label">Tempo Médio</th>
                    <th className="text-right pb-2.5 data-label">SLA Violado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {agents.map((a, i) => {
                    const rate = Number(a.resolution_rate_pct ?? 0);
                    return (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-2xs font-mono text-tertiary w-4">{i + 1}</span>
                            <span className="text-sm text-primary">{a.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-mono text-sm text-secondary">
                          {formatNumber(a.assigned_total)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-sm text-low font-semibold">
                          {formatNumber(a.resolved_total)}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`font-mono text-xs ${rate >= 80 ? 'text-low' : rate >= 50 ? 'text-medium' : 'text-critical'}`}>
                            {rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs text-secondary">
                          {formatMinutes(a.avg_resolution_min)}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`font-mono text-xs ${Number(a.sla_breaches) > 0 ? 'text-critical' : 'text-low'}`}>
                            {formatNumber(a.sla_breaches)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
