'use client';
import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { MetricCard } from '@/components/analytics/MetricCard';
import { OccurrenceChart } from '@/components/analytics/OccurrenceChart';
import { SlaGauge } from '@/components/analytics/SlaGauge';
import { OccurrenceMap } from '@/components/map/OccurrenceMap';
import { RecentOccurrences } from '@/components/occurrences/RecentOccurrences';
import { analyticsApi } from '@/lib/api/client';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useAppStore } from '@/lib/store/app.store';
import { formatNumber, formatMinutes } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, Clock, TrendingUp,
  Activity, Flame, Shield, Zap,
} from 'lucide-react';

export default function DashboardPage() {
  const { dashboard, setDashboard, dashboardStale, markDashboardStale, setCriticalCount } = useAppStore();
  const { on } = useWebSocket();
  const [loading, setLoading] = useState(!dashboard);
  const [timeline, setTimeline] = useState<any[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, tl] = await Promise.all([
        analyticsApi.dashboard(),
        analyticsApi.timeline({
          from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
          to:   new Date().toISOString().split('T')[0],
          groupBy: 'day',
        }),
      ]);
      setDashboard(dash);
      setTimeline(tl);

      // Atualizar badge de críticos
      const critical = dash.byPriority.find((b: any) => b.priority === 'critical');
      const open     = dash.byStatus.find((b: any) => b.status === 'open');
      setCriticalCount(Number(critical?.count ?? 0));
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [setDashboard, setCriticalCount]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Recarregar quando houver novos eventos
  useEffect(() => {
    const off = on('occurrence:created', () => markDashboardStale());
    return off;
  }, [on, markDashboardStale]);

  const d = dashboard;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={d ? `Atualizado ${new Date(d.generatedAt).toLocaleTimeString('pt-BR')}` : 'Carregando...'}
        actions={
          <button onClick={loadDashboard} className="btn-secondary text-xs">
            <Activity className="w-3.5 h-3.5" /> Atualizar
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* =================== MÉTRICAS PRINCIPAIS =================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total (30 dias)"
            value={loading ? '—' : formatNumber(d?.overview.total ?? 0)}
            icon={<Flame className="w-4 h-4 text-amber-400" />}
            color="amber"
          />
          <MetricCard
            label="Abertas agora"
            value={loading ? '—' : formatNumber(d?.overview.open ?? 0)}
            icon={<AlertTriangle className="w-4 h-4 text-orange-400" />}
            color="orange"
            sublabel={`+${d?.today.total_today ?? 0} hoje`}
          />
          <MetricCard
            label="Em Atendimento"
            value={loading ? '—' : formatNumber(d?.overview.in_progress ?? 0)}
            icon={<Zap className="w-4 h-4 text-violet-400" />}
            color="violet"
          />
          <MetricCard
            label="Resolvidas"
            value={loading ? '—' : formatNumber(d?.overview.resolved ?? 0)}
            icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
            color="green"
            sublabel={`+${d?.today.resolved_today ?? 0} hoje`}
          />
        </div>

        {/* =================== SLA + TEMPO MÉDIO =================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SlaGauge
            compliancePct={Number(d?.sla.sla_compliance_pct ?? 0)}
            breached={Number(d?.sla.breached ?? 0)}
            total={Number(d?.sla.total_resolved ?? 0)}
            loading={loading}
          />

          <div className="panel p-5 flex flex-col gap-4">
            <p className="data-label">Tempo de Resolução</p>
            <div className="flex-1 flex flex-col justify-center gap-4">
              <div>
                <p className="text-2xs font-mono text-tertiary mb-1">Média</p>
                <p className="text-2xl font-mono font-bold text-primary">
                  {loading ? '—' : formatMinutes(d?.resolution.avg_minutes ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-2xs font-mono text-tertiary mb-1">Mediana</p>
                <p className="text-xl font-mono font-semibold text-secondary">
                  {loading ? '—' : formatMinutes(d?.resolution.median_minutes ?? 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <p className="data-label mb-4">Por Prioridade (abertas)</p>
            <div className="space-y-3">
              {(d?.byPriority ?? []).map((b: any) => (
                <div key={b.priority} className="flex items-center justify-between">
                  <span className={`badge-${b.priority}`}>{b.priority}</span>
                  <span className="font-mono text-sm font-semibold text-primary">
                    {formatNumber(b.count)}
                  </span>
                </div>
              ))}
              {loading && <div className="h-24 animate-pulse bg-muted rounded" />}
            </div>
          </div>
        </div>

        {/* =================== GRÁFICO TIMELINE =================== */}
        <OccurrenceChart data={timeline} loading={loading} />

        {/* =================== MAPA + RECENTES =================== */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 panel overflow-hidden" style={{ height: 380 }}>
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium text-primary flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                Mapa de Ocorrências
              </p>
            </div>
            <div className="h-[calc(100%-45px)]">
              <OccurrenceMap height="100%" />
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium text-primary">Ocorrências Recentes</p>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 335 }}>
              <RecentOccurrences />
            </div>
          </div>
        </div>

        {/* =================== TOP AGENTES =================== */}
        {d?.topAgents?.length > 0 && (
          <div className="panel p-5">
            <p className="data-label mb-4">Top Agentes · 30 dias</p>
            <div className="space-y-3">
              {d.topAgents.map((a: any, i: number) => (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="text-2xs font-mono text-tertiary w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary truncate">{a.name}</p>
                    <p className="text-2xs font-mono text-tertiary">
                      {a.resolved_count} resolvidas · {formatMinutes(a.avg_minutes)} médio
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-low">{a.resolved_count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
