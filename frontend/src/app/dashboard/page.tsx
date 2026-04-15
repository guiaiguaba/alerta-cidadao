'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import api from '../../lib/api';
import { StatsCard } from '../../components/StatsCard';
import { OcorrenciasList } from '../../components/OcorrenciasList';
import { OcorrenciasMap } from '../../components/OcorrenciasMap';
import { StatusChart } from '../../components/StatusChart';

export default function DashboardPage() {
  const { dbUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !dbUser) router.push('/login');
  }, [loading, dbUser, router]);

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/tenants/stats').then((r) => r.data),
    enabled: !!dbUser,
  });

  const { data: ocorrencias, refetch } = useQuery({
    queryKey: ['ocorrencias'],
    queryFn: () => api.get('/ocorrencias?limit=20').then((r) => r.data),
    enabled: !!dbUser,
    refetchInterval: 30_000,
  });

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Carregando...</div>;
  if (!dbUser) return null;

  const s = stats?.ocorrencias;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-xl font-bold">🚨 Alerta Cidadão</h1>
          <p className="text-sm text-blue-200">Painel de Gestão</p>
        </div>
        <span className="text-sm bg-blue-800 px-3 py-1 rounded-full capitalize">{dbUser.role}</span>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard label="Total" value={s?.total ?? '—'} color="blue" />
          <StatsCard label="Abertas" value={s?.abertas ?? '—'} color="yellow" />
          <StatsCard label="Em Andamento" value={s?.em_andamento ?? '—'} color="orange" />
          <StatsCard label="Resolvidas" value={s?.resolvidas ?? '—'} color="green" />
        </div>

        {/* Chart + Map */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-gray-700 mb-4">Distribuição por Status</h2>
            <StatusChart data={s} />
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-gray-700 mb-4">Mapa de Ocorrências</h2>
            <OcorrenciasMap ocorrencias={ocorrencias?.data ?? []} />
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">Ocorrências Recentes</h2>
            <button
              onClick={() => refetch()}
              className="text-sm text-blue-600 hover:underline"
            >
              Atualizar
            </button>
          </div>
          <OcorrenciasList ocorrencias={ocorrencias?.data ?? []} onUpdate={refetch} />
        </div>
      </main>
    </div>
  );
}
