'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  aberta:       { label: 'Novo',      color: '#EF4444', bg: 'rgba(239,68,68,.12)'   },
  em_andamento: { label: 'Em atend.', color: '#FF6B2B', bg: 'rgba(255,107,43,.12)'  },
  resolvida:    { label: 'Concluído', color: '#22C55E', bg: 'rgba(34,197,94,.12)'   },
  cancelada:    { label: 'Cancelado', color: '#6B7280', bg: 'rgba(107,114,128,.12)' },
};

const PRIO_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  baixa:  { label: '• Baixo',  color: '#22C55E', bg: 'rgba(34,197,94,.12)'  },
  normal: { label: '• Médio',  color: '#EAB308', bg: 'rgba(234,179,8,.12)'  },
  alta:   { label: '• Alto',   color: '#F97316', bg: 'rgba(249,115,22,.12)' },
  critica:{ label: '• Crítico',color: '#EF4444', bg: 'rgba(239,68,68,.12)'  },
};

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ color, background: bg, border: `1px solid ${color}44`, borderRadius: 20,
      padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export function OcorrenciasList({ ocorrencias, onUpdate }: { ocorrencias: any[]; onUpdate: () => void }) {
  const { dbUser } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/ocorrencias/${id}`, { status }).then(r => r.data),
    onSuccess: () => { onUpdate(); setSelectedId(null); },
  });

  const canUpdate = dbUser?.role === 'agent' || dbUser?.role === 'admin';
  const filtered  = ocorrencias.filter(o => !filter || o.status === filter);

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {['', 'aberta', 'em_andamento', 'resolvida', 'cancelada'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${filter === s ? '#FF6B2B' : '#E5E7EB'}`,
            background: filter === s ? 'rgba(255,107,43,.1)' : 'transparent',
            color: filter === s ? '#FF6B2B' : '#6B7280',
            transition: 'all .15s',
          }}>
            {s === '' ? 'Todos' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <p style={{ margin: 0, fontSize: 14 }}>Nenhuma ocorrência</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {filtered.map(o => {
          const sc = STATUS_BADGE[o.status]   ?? STATUS_BADGE.cancelada;
          const pc = PRIO_BADGE[o.prioridade] ?? PRIO_BADGE.normal;
          return (
            <div key={o.id} style={{ padding: '12px 0', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  <Pill {...sc} />
                  <Pill {...pc} />
                  {o.categoria_nome && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{o.categoria_nome}</span>}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.descricao}
                </p>
                {o.created_at && (
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: '#9CA3AF' }}>
                    {format(new Date(o.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>

              {canUpdate && o.status !== 'resolvida' && o.status !== 'cancelada' && (
                <div style={{ flexShrink: 0 }}>
                  {selectedId === o.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['em_andamento', 'resolvida', 'cancelada'].filter(s => s !== o.status).map(s => (
                        <button key={s} onClick={() => updateMutation.mutate({ id: o.id, status: s })}
                          disabled={updateMutation.isPending}
                          style={{ padding: '4px 10px', borderRadius: 8, border: 'none', fontSize: 11,
                            fontWeight: 700, cursor: 'pointer', background: '#FF6B2B', color: '#fff',
                            opacity: updateMutation.isPending ? 0.6 : 1 }}>
                          {s.replace('_', ' ')}
                        </button>
                      ))}
                      <button onClick={() => setSelectedId(null)} style={{
                        padding: '4px 8px', borderRadius: 8, border: '1px solid #E5E7EB',
                        background: 'transparent', color: '#6B7280', cursor: 'pointer', fontSize: 11 }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setSelectedId(o.id)} style={{
                      padding: '5px 12px', borderRadius: 8, border: '1px solid #FF6B2B',
                      background: 'transparent', color: '#FF6B2B', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600 }}>
                      Atualizar
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
