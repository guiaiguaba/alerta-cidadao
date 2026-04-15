'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_BADGE: Record<string, string> = {
  aberta: 'bg-red-100 text-red-700',
  em_andamento: 'bg-orange-100 text-orange-700',
  resolvida: 'bg-green-100 text-green-700',
  cancelada: 'bg-gray-100 text-gray-600',
};

const PRIORIDADE_BADGE: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-500',
  normal: 'bg-blue-100 text-blue-600',
  alta: 'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700 font-bold',
};

export function OcorrenciasList({
  ocorrencias,
  onUpdate,
}: {
  ocorrencias: any[];
  onUpdate: () => void;
}) {
  const { dbUser } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/ocorrencias/${id}`, { status }).then((r) => r.data),
    onSuccess: () => { onUpdate(); setSelectedId(null); },
  });

  const canUpdate = dbUser?.role === 'agent' || dbUser?.role === 'admin';

  const filtered = ocorrencias.filter((o) =>
    filter === '' || o.status === filter,
  );

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'aberta', 'em_andamento', 'resolvida', 'cancelada'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-sm border transition ${
              filter === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === '' ? 'Todos' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 py-8">Nenhuma ocorrência encontrada</p>
      )}

      <div className="divide-y">
        {filtered.map((o) => (
          <div key={o.id} className="py-3 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[o.status] ?? 'bg-gray-100'}`}>
                  {o.status.replace('_', ' ')}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORIDADE_BADGE[o.prioridade] ?? ''}`}>
                  {o.prioridade}
                </span>
                {o.categoria_nome && (
                  <span className="text-xs text-gray-500">{o.categoria_nome}</span>
                )}
              </div>
              <p className="text-sm text-gray-800 truncate">{o.descricao}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {o.created_at
                  ? format(new Date(o.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : '—'}
              </p>
            </div>

            {canUpdate && o.status !== 'resolvida' && o.status !== 'cancelada' && (
              <div className="flex-shrink-0">
                {selectedId === o.id ? (
                  <div className="flex gap-1">
                    {['em_andamento', 'resolvida', 'cancelada']
                      .filter((s) => s !== o.status)
                      .map((s) => (
                        <button
                          key={s}
                          onClick={() => updateMutation.mutate({ id: o.id, status: s })}
                          disabled={updateMutation.isPending}
                          className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {s.replace('_', ' ')}
                        </button>
                      ))}
                    <button
                      onClick={() => setSelectedId(null)}
                      className="text-xs px-2 py-1 rounded border text-gray-500 hover:bg-gray-50"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedId(o.id)}
                    className="text-xs px-3 py-1 rounded border border-blue-400 text-blue-600 hover:bg-blue-50"
                  >
                    Atualizar
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
