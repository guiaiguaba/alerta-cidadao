'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { OccurrenceRow } from '@/components/occurrences/OccurrenceRow';
import { OccurrenceDrawer } from '@/components/occurrences/OccurrenceDrawer';
import { OccurrenceFiltersBar } from '@/components/occurrences/OccurrenceFiltersBar';
import { occurrencesApi } from '@/lib/api/client';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { Occurrence, OccurrenceFilters } from '@/types';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function OccurrencesPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { on }       = useWebSocket();

  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [meta,     setMeta]     = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const [filters, setFilters] = useState<OccurrenceFilters>({
    status:   (searchParams.get('status') as any) || undefined,
    priority: (searchParams.get('priority') as any) || undefined,
    page:     1,
    limit:    25,
  });

  const load = useCallback(async (f: OccurrenceFilters) => {
    setLoading(true);
    try {
      const res = await occurrencesApi.list(f);
      setOccurrences(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      toast.error('Erro ao carregar ocorrências');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filters); }, [filters, load]);

  // Escutar eventos em tempo real
  useEffect(() => {
    const off1 = on('occurrence:created', (occ) => {
      setOccurrences(prev => [occ, ...prev]);
      setMeta(m => ({ ...m, total: m.total + 1 }));
      toast(`Nova ocorrência: ${occ.protocol}`, { icon: '🚨' });
    });
    const off2 = on('occurrence:updated', ({ id, status }: any) => {
      setOccurrences(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    });
    return () => { off1(); off2(); };
  }, [on]);

  function handleFilterChange(newFilters: Partial<OccurrenceFilters>) {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  }

  async function handleStatusUpdate(id: string, status: string, note?: string) {
    try {
      await occurrencesApi.updateStatus(id, { status, note });
      toast.success('Status atualizado');
      load(filters);
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao atualizar status');
    }
  }

  const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Ocorrências"
        subtitle={loading ? 'Carregando...' : `${formatNumber(meta.total)} ocorrência(s)`}
        actions={
          <button
            onClick={() => router.push('/dashboard/occurrences/map')}
            className="btn-secondary text-xs"
          >
            <MapPin className="w-3.5 h-3.5" /> Ver no Mapa
          </button>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Filtros */}
        <OccurrenceFiltersBar filters={filters} onChange={handleFilterChange} />

        {/* Tabela */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-px">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-surface animate-pulse" />
              ))}
            </div>
          ) : occurrences.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-tertiary">
              <p className="font-mono text-sm">Nenhuma ocorrência encontrada</p>
              <p className="text-xs mt-1">Ajuste os filtros para ver mais resultados</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface border-b border-border">
                  <th className="text-left px-4 py-2.5 data-label w-32">Protocolo</th>
                  <th className="text-left px-4 py-2.5 data-label">Categoria</th>
                  <th className="text-left px-4 py-2.5 data-label hidden lg:table-cell">Endereço</th>
                  <th className="text-left px-4 py-2.5 data-label">Prioridade</th>
                  <th className="text-left px-4 py-2.5 data-label">Status</th>
                  <th className="text-left px-4 py-2.5 data-label hidden xl:table-cell">Agente</th>
                  <th className="text-left px-4 py-2.5 data-label hidden xl:table-cell">SLA</th>
                  <th className="text-left px-4 py-2.5 data-label">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {occurrences.map(occ => (
                  <OccurrenceRow
                    key={occ.id}
                    occurrence={occ}
                    onClick={() => setSelected(occ.id)}
                    isSelected={selected === occ.id}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface">
            <p className="text-xs font-mono text-tertiary">
              Página {meta.page} de {meta.totalPages} · {formatNumber(meta.total)} registros
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters(f => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}
                disabled={meta.page <= 1}
                className="btn-ghost text-xs py-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, page: Math.min(meta.totalPages, (f.page ?? 1) + 1) }))}
                disabled={meta.page >= meta.totalPages}
                className="btn-ghost text-xs py-1 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer de detalhe */}
      {selected && (
        <OccurrenceDrawer
          occurrenceId={selected}
          onClose={() => setSelected(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  );
}
