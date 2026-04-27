'use client';
import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { apiClient } from '@/lib/api/client';
import toast from 'react-hot-toast';
import { UserCheck, UserX, MapPin, Clock, AlertCircle, CheckCircle2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Cidadao {
  id:               string;
  name:             string;
  email?:           string;
  phone?:           string;
  status:           'approved' | 'pending' | 'rejected';
  lat?:             number;
  lng?:             number;
  last_login_at?:   string;
  created_at:       string;
  total_ocorrencias: number;
}

const STATUS_CONFIG = {
  pending:  { label: 'Aguardando',  color: 'text-medium',   bg: 'bg-medium/10   border-medium/25'  },
  approved: { label: 'Aprovado',    color: 'text-low',      bg: 'bg-low/10      border-low/25'     },
  rejected: { label: 'Rejeitado',   color: 'text-critical', bg: 'bg-critical/10 border-critical/25' },
};

export default function CidadaosPage() {
  const [cidadaos, setCidadaos] = useState<Cidadao[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState<'pending' | 'approved' | 'rejected' | 'todos'>('todos');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/admin/cidadaos');
      setCidadaos(data);
    } catch { toast.error('Erro ao carregar cidadãos'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const pendentes  = cidadaos.filter(c => c.status === 'pending');
  const filtrados  = filtro === 'todos' ? cidadaos : cidadaos.filter(c => c.status === filtro);

  async function aprovar(id: string, nome: string) {
    try {
      await apiClient.patch(`/admin/cidadaos/${id}/aprovar`, {});
      setCidadaos(prev => prev.map(c => c.id === id ? { ...c, status: 'approved' } : c));
      toast.success(`${nome} aprovado`);
    } catch { toast.error('Erro ao aprovar'); }
  }

  async function rejeitar(id: string, nome: string) {
    const motivo = prompt(`Motivo para rejeitar "${nome}" (opcional):`);
    if (motivo === null) return; // cancelou
    try {
      await apiClient.patch(`/admin/cidadaos/${id}/rejeitar`, { motivo: motivo || undefined });
      setCidadaos(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected' } : c));
      toast.success(`${nome} rejeitado`);
    } catch { toast.error('Erro ao rejeitar'); }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Cidadãos"
        subtitle={`${cidadaos.filter(c => c.status === 'approved').length} aprovados · ${pendentes.length} aguardando validação`}
        actions={
          pendentes.length > 0 ? (
            <div className="flex items-center gap-2 bg-medium/10 border border-medium/25 rounded-lg px-3 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-medium" />
              <span className="text-xs font-mono text-medium font-semibold">
                {pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}
              </span>
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto p-6">

        {/* Aviso de pendentes */}
        {pendentes.length > 0 && (
          <div className="mb-5 bg-medium/6 border border-medium/20 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-medium flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-primary">
                {pendentes.length} cidadão{pendentes.length > 1 ? 's' : ''} aguardando validação
              </p>
              <p className="text-xs text-secondary mt-0.5">
                Esses usuários se cadastraram mas ainda não podem registrar ocorrências.
                Revise e aprove ou rejeite cada um.
              </p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-1.5 mb-5">
          {([
            ['todos',    'Todos'],
            ['pending',  'Aguardando'],
            ['approved', 'Aprovados'],
            ['rejected', 'Rejeitados'],
          ] as const).map(([val, label]) => {
            const count = val === 'todos'
              ? cidadaos.length
              : cidadaos.filter(c => c.status === val).length;
            return (
              <button
                key={val}
                onClick={() => setFiltro(val)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors',
                  filtro === val
                    ? val === 'pending'
                      ? 'bg-medium/10 border-medium/30 text-medium'
                      : val === 'approved'
                      ? 'bg-low/10 border-low/30 text-low'
                      : val === 'rejected'
                      ? 'bg-critical/10 border-critical/30 text-critical'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-transparent border-border text-tertiary hover:text-secondary',
                )}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 panel animate-pulse rounded-xl" />)}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-tertiary">
            <Users className="w-10 h-10 mb-3 opacity-25" />
            <p className="font-mono text-sm">
              {filtro === 'pending' ? 'Nenhum pendente — tudo em dia ✅' : 'Nenhum registro encontrado'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map(c => (
              <CartaoCidadao
                key={c.id}
                cidadao={c}
                onAprovar={() => aprovar(c.id, c.name)}
                onRejeitar={() => rejeitar(c.id, c.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CARTÃO DO CIDADÃO
// ============================================================
function CartaoCidadao({ cidadao: c, onAprovar, onRejeitar }: {
  cidadao:   Cidadao;
  onAprovar: () => void;
  onRejeitar: () => void;
}) {
  const cfg        = STATUS_CONFIG[c.status];
  const temGeo     = c.lat && c.lng;
  const cadastroEm = new Date(c.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={cn(
      'panel px-5 py-3.5 flex items-center justify-between gap-4',
      c.status === 'pending' && 'border-l-4 border-medium',
    )}>
      {/* Identidade */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold font-mono flex-shrink-0 bg-muted border border-border text-secondary">
          {c.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-primary truncate">{c.name}</div>
          <div className="text-2xs text-tertiary font-mono">
            {c.email || c.phone || '—'}
          </div>
        </div>
      </div>

      {/* Geo info */}
      <div className="hidden md:flex items-center gap-1.5 text-2xs font-mono text-tertiary flex-shrink-0">
        <MapPin className="w-3 h-3" />
        {temGeo
          ? `${c.lat!.toFixed(4)}, ${c.lng!.toFixed(4)}`
          : 'GPS não informado'}
      </div>

      {/* Data */}
      <div className="hidden lg:flex items-center gap-1.5 text-2xs font-mono text-tertiary flex-shrink-0">
        <Clock className="w-3 h-3" />
        {cadastroEm}
      </div>

      {/* Ocorrências */}
      {c.status === 'approved' && (
        <div className="text-center flex-shrink-0">
          <div className="font-mono text-sm font-bold text-primary">{c.total_ocorrencias}</div>
          <div className="text-2xs font-mono text-tertiary">Ocorrências</div>
        </div>
      )}

      {/* Status + ações */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn('text-2xs font-mono font-semibold px-2 py-1 rounded border', cfg.bg, cfg.color)}>
          {cfg.label}
        </span>
        {c.status === 'pending' && (
          <>
            <button
              onClick={onAprovar}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-low/10 border border-low/25 text-low hover:bg-low/20 transition-colors text-xs font-medium"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
            </button>
            <button
              onClick={onRejeitar}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-critical/8 border border-critical/20 text-critical hover:bg-critical/15 transition-colors text-xs"
            >
              <UserX className="w-3.5 h-3.5" /> Rejeitar
            </button>
          </>
        )}
        {c.status === 'rejected' && (
          <button
            onClick={onAprovar}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-low/10 border border-low/25 text-low hover:bg-low/20 transition-colors text-xs"
          >
            <UserCheck className="w-3.5 h-3.5" /> Reativar
          </button>
        )}
      </div>
    </div>
  );
}
