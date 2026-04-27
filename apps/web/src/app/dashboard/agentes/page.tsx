'use client';
import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { apiClient } from '@/lib/api/client';
import toast from 'react-hot-toast';
import {
  Plus, UserCheck, UserX, RefreshCw, ChevronRight,
  X, Mail, Shield, HardHat, Copy, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Agente {
  id:                    string;
  nome:                  string;
  email:                 string;
  cargo:                 'agent' | 'supervisor';
  ativo:                 boolean;
  ultimo_acesso?:        string;
  cadastrado_em:         string;
  ocorrencias_ativas:    number;
  ocorrencias_resolvidas: number;
  is_activated:          boolean;
}

const CARGO_LABEL = { agent: 'Agente de Campo', supervisor: 'Supervisor' } as const;
const CARGO_COLOR = { agent: 'text-amber-400', supervisor: 'text-violet-400' } as const;

export default function AgentesPage() {
  const [agentes,   setAgentes]   = useState<Agente[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [codigoResult, setCodigoResult] = useState<{
    nome: string; email: string; codigo: string; expira: string;
  } | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/users/agentes');
      setAgentes(data);
    } catch { toast.error('Erro ao carregar agentes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const ativos   = agentes.filter(a => a.ativo);
  const inativos = agentes.filter(a => !a.ativo);

  async function desativar(id: string, nome: string) {
    if (!confirm(`Desativar ${nome}? Ele perderá acesso imediatamente.`)) return;
    try {
      await apiClient.delete(`/users/agentes/${id}`);
      setAgentes(p => p.map(a => a.id === id ? { ...a, ativo: false } : a));
      toast.success(`${nome} desativado`);
    } catch { toast.error('Erro ao desativar'); }
  }

  async function reativar(id: string, nome: string) {
    try {
      await apiClient.patch(`/users/agentes/${id}/reativar`, {});
      setAgentes(p => p.map(a => a.id === id ? { ...a, ativo: true } : a));
      toast.success(`${nome} reativado`);
    } catch { toast.error('Erro ao reativar'); }
  }

  async function reenviarConvite(email: string, nome: string) {
    try {
      const res = await apiClient.post('/users/agentes/convidar', {
        nome, email, cargo: 'agent',
      });
      setCodigoResult({ nome, email, codigo: res.codigo, expira: res.expira });
      toast.success('Novo código gerado');
    } catch { toast.error('Erro ao reenviar convite'); }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Agentes de Campo"
        subtitle={`${ativos.length} ativo(s) · ${agentes.filter(a => !a.is_activated).length} aguardando ativação`}
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Convidar Agente
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 panel animate-pulse rounded-xl" />)}
          </div>
        ) : agentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-tertiary">
            <HardHat className="w-10 h-10 mb-3 opacity-25" />
            <p className="font-mono text-sm">Nenhum agente cadastrado</p>
            <button onClick={() => setModalOpen(true)} className="mt-4 btn-primary text-xs">
              Convidar primeiro agente
            </button>
          </div>
        ) : (
          <>
            {/* Aguardando ativação */}
            {agentes.filter(a => !a.is_activated).length > 0 && (
              <div>
                <p className="data-label mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-medium inline-block" />
                  Aguardando ativação no app
                </p>
                <div className="space-y-2">
                  {agentes.filter(a => !a.is_activated).map(a => (
                    <CartaoPendente
                      key={a.id}
                      agente={a}
                      onReenviar={() => reenviarConvite(a.email, a.nome)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Ativos */}
            {ativos.filter(a => a.is_activated).length > 0 && (
              <div>
                <p className="data-label mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-low inline-block" />
                  Ativos
                </p>
                <div className="space-y-2">
                  {ativos.filter(a => a.is_activated).map(a => (
                    <CartaoAgente
                      key={a.id}
                      agente={a}
                      onDesativar={() => desativar(a.id, a.nome)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Inativos */}
            {inativos.filter(a => a.is_activated).length > 0 && (
              <div>
                <p className="data-label mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-critical inline-block" />
                  Desativados
                </p>
                <div className="space-y-2">
                  {inativos.filter(a => a.is_activated).map(a => (
                    <CartaoAgente
                      key={a.id}
                      agente={a}
                      onReativar={() => reativar(a.id, a.nome)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal convite */}
      {modalOpen && (
        <ModalConvite
          onFechar={() => setModalOpen(false)}
          onConvidado={(res) => {
            setModalOpen(false);
            setCodigoResult(res);
            // Adicionar agente pendente na lista
            setAgentes(p => [{
              id:                    res.id ?? Date.now().toString(),
              nome:                  res.nome,
              email:                 res.email,
              cargo:                 'agent',
              ativo:                 true,
              cadastrado_em:         new Date().toISOString(),
              ocorrencias_ativas:    0,
              ocorrencias_resolvidas: 0,
              is_activated:          false,
            } as Agente, ...p]);
          }}
        />
      )}

      {/* Modal código */}
      {codigoResult && (
        <ModalCodigo
          {...codigoResult}
          onFechar={() => setCodigoResult(null)}
        />
      )}
    </div>
  );
}

// ---- Cartão: agente ativo/inativo ----
function CartaoAgente({ agente, onDesativar, onReativar }: {
  agente: Agente;
  onDesativar?: () => void;
  onReativar?:  () => void;
}) {
  const [open, setOpen] = useState(false);
  const ultimoAcesso = agente.ultimo_acesso
    ? new Date(agente.ultimo_acesso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Nunca acessou';

  return (
    <div className={cn('panel overflow-hidden', !agente.ativo && 'opacity-55')}>
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-muted/10"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold font-mono',
            agente.ativo
              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
              : 'bg-muted border border-border text-tertiary',
          )}>
            {agente.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary">{agente.nome}</span>
              {!agente.ativo && (
                <span className="text-2xs font-mono text-critical bg-critical/10 border border-critical/20 px-1.5 py-0.5 rounded">
                  INATIVO
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className={cn('text-xs font-mono font-medium', CARGO_COLOR[agente.cargo])}>
                {CARGO_LABEL[agente.cargo]}
              </span>
              <span className="text-2xs text-tertiary font-mono">{agente.email}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-center hidden sm:block">
            <div className="text-sm font-bold font-mono text-primary">{agente.ocorrencias_ativas}</div>
            <div className="text-2xs font-mono text-tertiary">Ativas</div>
          </div>
          <div className="text-center hidden sm:block">
            <div className="text-sm font-bold font-mono text-low">{agente.ocorrencias_resolvidas}</div>
            <div className="text-2xs font-mono text-tertiary">Resolvidas</div>
          </div>
          <ChevronRight className={cn('w-4 h-4 text-tertiary transition-transform', open && 'rotate-90')} />
        </div>
      </div>
      {open && (
        <div className="border-t border-border px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="data-label block mb-1">Último acesso</span>
              <span className="text-secondary font-mono">{ultimoAcesso}</span>
            </div>
            <div>
              <span className="data-label block mb-1">Cadastrado em</span>
              <span className="text-secondary font-mono">
                {new Date(agente.cadastrado_em).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {agente.ativo ? (
              <button
                onClick={onDesativar}
                className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-critical/30 bg-critical/8 text-critical hover:bg-critical/15 transition-colors"
              >
                <UserX className="w-3 h-3" /> Desativar acesso
              </button>
            ) : (
              <button
                onClick={onReativar}
                className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-low/30 bg-low/8 text-low hover:bg-low/15 transition-colors"
              >
                <UserCheck className="w-3 h-3" /> Reativar acesso
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Cartão: pendente (aguardando ativação) ----
function CartaoPendente({ agente, onReenviar }: {
  agente: Agente; onReenviar: () => void;
}) {
  return (
    <div className="panel px-5 py-3.5 flex items-center justify-between border-l-4 border-medium">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold font-mono bg-medium/10 border border-medium/20 text-medium">
          {agente.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-medium text-primary">{agente.nome}</div>
          <div className="text-2xs text-tertiary font-mono">{agente.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-2xs font-mono text-medium bg-medium/10 border border-medium/20 px-2 py-1 rounded">
          Aguardando código
        </span>
        <button
          onClick={onReenviar}
          className="btn-ghost text-xs flex items-center gap-1.5"
          title="Gerar novo código"
        >
          <RefreshCw className="w-3 h-3" /> Novo código
        </button>
      </div>
    </div>
  );
}

// ---- Modal: convidar agente ----
function ModalConvite({ onFechar, onConvidado }: {
  onFechar: () => void;
  onConvidado: (res: any) => void;
}) {
  const [nome,    setNome]    = useState('');
  const [email,   setEmail]   = useState('');
  const [cargo,   setCargo]   = useState<'agent' | 'supervisor'>('agent');
  const [saving,  setSaving]  = useState(false);
  const [erro,    setErro]    = useState('');

  async function enviar() {
    setErro('');
    if (!nome.trim())  { setErro('Nome obrigatório'); return; }
    if (!email.trim()) { setErro('E-mail obrigatório'); return; }
    if (!email.includes('@')) { setErro('E-mail inválido'); return; }

    setSaving(true);
    try {
      const res = await apiClient.post('/users/agentes/convidar', {
        nome: nome.trim(), email: email.trim(), cargo,
      });
      onConvidado({ ...res, nome: nome.trim(), email: email.trim() });
    } catch (e: any) {
      setErro(e.message || 'Erro ao gerar convite');
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onFechar} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="panel w-full max-w-md shadow-panel">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="font-semibold text-primary">Convidar Agente</h2>
              <p className="text-xs text-tertiary font-mono mt-0.5">
                Um código de 6 dígitos será gerado para o agente ativar a conta
              </p>
            </div>
            <button onClick={onFechar} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-5 space-y-4">
            {/* Nome */}
            <div>
              <label className="data-label block mb-1.5">Nome completo *</label>
              <input
                autoFocus
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="input"
                placeholder="Ex: Carlos Ferreira"
              />
            </div>

            {/* E-mail */}
            <div>
              <label className="data-label block mb-1.5">E-mail *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && enviar()}
                  className="input pl-9"
                  placeholder="agente@email.com"
                />
              </div>
            </div>

            {/* Cargo */}
            <div>
              <label className="data-label block mb-1.5">Cargo</label>
              <div className="flex gap-2">
                {(['agent', 'supervisor'] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCargo(c)}
                    className={cn(
                      'flex-1 py-2.5 px-3 rounded-lg border text-xs font-mono transition-colors',
                      cargo === c
                        ? c === 'supervisor'
                          ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-transparent border-border text-tertiary hover:text-secondary',
                    )}
                  >
                    {c === 'agent' ? '🧑‍🚒 Agente de Campo' : '🎖️ Supervisor'}
                  </button>
                ))}
              </div>
            </div>

            {/* Info do fluxo */}
            <div className="bg-info/5 border border-info/15 rounded-lg p-3.5">
              <p className="text-xs text-secondary leading-relaxed">
                <span className="text-info font-semibold">Como funciona: </span>
                Um código de <strong className="text-primary">6 dígitos</strong> será gerado aqui.
                Você envia o código para o agente (WhatsApp, e-mail, etc.).
                O agente abre o App do Agente, digita o e-mail e o código,
                e cria a própria senha. Acesso imediato após isso.
              </p>
            </div>

            {erro && (
              <div className="flex items-center gap-2 p-3 bg-critical/8 border border-critical/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-critical flex-shrink-0" />
                <span className="text-xs text-critical">{erro}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-5 pb-5">
            <button onClick={onFechar} className="btn-secondary text-xs">Cancelar</button>
            <button
              onClick={enviar}
              disabled={saving}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              {saving ? 'Gerando...' : <><Plus className="w-3.5 h-3.5" /> Gerar código</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---- Modal: exibir o código gerado ----
function ModalCodigo({ nome, email, codigo, expira, onFechar }: {
  nome: string; email: string; codigo: string; expira: string; onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const expiraStr = new Date(expira).toLocaleString('pt-BR', {
    dateStyle: 'short', timeStyle: 'short',
  });

  const textoCopiar = `Olá, ${nome}!\n\nVocê foi convidado para o App do Agente — Alerta Cidadão.\n\n📱 Abra o app e use:\n• E-mail: ${email}\n• Código de ativação: ${codigo}\n\nO código expira em ${expiraStr}.`;

  function copiar() {
    navigator.clipboard.writeText(textoCopiar);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="panel w-full max-w-sm shadow-panel">
          <div className="p-6 space-y-5">

            {/* Ícone + título */}
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-low/10 border border-low/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-low" />
              </div>
              <h3 className="font-semibold text-primary text-base">Convite gerado!</h3>
              <p className="text-xs text-secondary mt-1">
                Envie o código abaixo para <span className="text-primary font-medium">{nome}</span>
              </p>
            </div>

            {/* Código em destaque */}
            <div className="bg-panel border-2 border-amber-500/30 rounded-xl p-5 text-center">
              <p className="text-2xs font-mono text-tertiary mb-2 tracking-widest">CÓDIGO DE ATIVAÇÃO</p>
              <div className="font-mono text-4xl font-bold text-amber-400 tracking-[0.3em]">
                {codigo}
              </div>
              <p className="text-2xs font-mono text-tertiary mt-3">
                E-mail: <span className="text-secondary">{email}</span>
              </p>
              <p className="text-2xs font-mono text-critical/70 mt-1">
                Expira em: {expiraStr}
              </p>
            </div>

            {/* Instrução */}
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3.5 space-y-1.5">
              <p className="text-xs font-semibold text-amber-400">Instrução para o agente:</p>
              <ol className="text-xs text-secondary space-y-1 list-none">
                <li>1. Baixar o <strong className="text-primary">"App do Agente — Alerta Cidadão"</strong></li>
                <li>2. Tocar em <strong className="text-primary">"Ativar conta"</strong></li>
                <li>3. Digitar o e-mail e o código <strong className="text-amber-400 font-mono">{codigo}</strong></li>
                <li>4. Criar a própria senha — acesso liberado!</li>
              </ol>
            </div>

            {/* Botões */}
            <div className="flex gap-2">
              <button
                onClick={copiar}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-medium transition-colors',
                  copiado
                    ? 'bg-low/10 border-low/30 text-low'
                    : 'bg-panel border-border text-secondary hover:text-primary',
                )}
              >
                {copiado ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar mensagem</>}
              </button>
              <button onClick={onFechar} className="flex-1 btn-primary text-xs">
                Entendi
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
