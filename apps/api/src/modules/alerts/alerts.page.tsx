'use client';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { alertsApi } from '@/lib/api/client';
import { Alert, AlertSeverity } from '@/types';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { formatRelative, formatNumber, SEVERITY_LABELS, SEVERITY_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Plus, Send, X, BellRing, Globe, MapPin, Circle,
  AlertTriangle, CheckCircle2, Clock, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// ==========================================
// CREATE FORM SCHEMA
// ==========================================
const alertSchema = z.object({
  title:       z.string().min(5, 'Mínimo 5 caracteres'),
  message:     z.string().min(10, 'Mínimo 10 caracteres'),
  alertType:   z.string(),
  severity:    z.enum(['critical', 'high', 'medium', 'info']),
  targetScope: z.enum(['all', 'regions', 'radius']),
  targetRegions: z.string().optional(),
  expiresAt:   z.string().optional(),
});
type AlertFormData = z.infer<typeof alertSchema>;

const ALERT_TYPES = [
  { value: 'flood_warning', label: 'Alagamento' },
  { value: 'evacuation',    label: 'Evacuação' },
  { value: 'storm',         label: 'Tempestade' },
  { value: 'landslide',     label: 'Deslizamento' },
  { value: 'fire',          label: 'Incêndio' },
  { value: 'earthquake',    label: 'Terremoto' },
  { value: 'other',         label: 'Outro' },
];

const STATUS_CONFIG = {
  draft:     { label: 'Rascunho',  icon: Clock,        class: 'text-tertiary' },
  sending:   { label: 'Enviando',  icon: Send,         class: 'text-amber-400 animate-pulse' },
  sent:      { label: 'Enviado',   icon: CheckCircle2, class: 'text-low' },
  cancelled: { label: 'Cancelado', icon: Ban,          class: 'text-tertiary' },
};

// ==========================================
// PAGE
// ==========================================
export default function AlertsPage() {
  const [alerts,      setAlerts]     = useState<Alert[]>([]);
  const [total,       setTotal]      = useState(0);
  const [loading,     setLoading]    = useState(true);
  const [showCreate,  setShowCreate] = useState(false);
  const [sending,     setSending]    = useState<string | null>(null);
  const { on }                       = useWebSocket();

  async function loadAlerts() {
    setLoading(true);
    try {
      const res = await alertsApi.listAll({ limit: 30 });
      setAlerts(res.data);
      setTotal(res.meta.total);
    } catch { toast.error('Erro ao carregar alertas'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAlerts(); }, []);

  useEffect(() => {
    const off = on('alert:new', (a: Alert) => {
      setAlerts(prev => [a, ...prev]);
      toast(`Alerta enviado: ${a.title}`, { icon: '🔔' });
    });
    return off;
  }, [on]);

  async function handleSend(id: string) {
    setSending(id);
    try {
      const res = await alertsApi.send(id);
      setAlerts(prev => prev.map(a => a.id === id ? res : a));
      toast.success(`Alerta enviado para ${formatNumber(res.recipients_count)} dispositivos`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(null);
    }
  }

  async function handleCancel(id: string) {
    try {
      const res = await alertsApi.cancel(id);
      setAlerts(prev => prev.map(a => a.id === id ? res : a));
      toast.success('Alerta cancelado');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Alertas"
        subtitle={`${formatNumber(total)} alertas`}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" /> Novo Alerta
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 panel animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-tertiary">
            <BellRing className="w-8 h-8 mb-3 opacity-30" />
            <p className="font-mono text-sm">Nenhum alerta criado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => {
              const statusCfg = STATUS_CONFIG[alert.status];
              const StatusIcon = statusCfg.icon;
              const color = SEVERITY_COLORS[alert.severity] ?? '#6B7280';

              return (
                <div
                  key={alert.id}
                  className="panel p-5"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="text-2xs font-mono px-2 py-0.5 rounded uppercase tracking-wider border"
                          style={{ color, borderColor: `${color}44`, background: `${color}11` }}
                        >
                          {alert.alertType.replace('_', ' ')}
                        </span>
                        <span
                          className="text-2xs font-mono px-2 py-0.5 rounded uppercase"
                          style={{ color, background: `${color}11` }}
                        >
                          {SEVERITY_LABELS[alert.severity]}
                        </span>
                        <div className={cn('flex items-center gap-1 text-2xs font-mono', statusCfg.class)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="font-medium text-primary">{alert.title}</h3>
                      <p className="text-sm text-secondary mt-0.5 leading-relaxed">{alert.message}</p>

                      {/* Meta */}
                      <div className="flex items-center gap-4 mt-2 text-2xs font-mono text-tertiary flex-wrap">
                        <span className="flex items-center gap-1">
                          {alert.targetScope === 'all'     && <Globe className="w-3 h-3" />}
                          {alert.targetScope === 'regions' && <MapPin className="w-3 h-3" />}
                          {alert.targetScope === 'radius'  && <Circle className="w-3 h-3" />}
                          {alert.targetScope === 'all'     ? 'Toda a cidade'
                            : alert.targetScope === 'regions'
                            ? `${alert.targetRegions?.join(', ')} `
                            : `Raio de ${alert.targetRadiusM}m`
                          }
                        </span>
                        {alert.status === 'sent' && (
                          <span className="text-low">{formatNumber(alert.recipientsCount)} dispositivos</span>
                        )}
                        <span>{alert.creatorName} · {formatRelative(alert.createdAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {alert.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleSend(alert.id)}
                            disabled={sending === alert.id}
                            className="btn-primary text-xs py-1.5 disabled:opacity-60"
                          >
                            {sending === alert.id ? (
                              <span className="animate-pulse">Enviando...</span>
                            ) : (
                              <><Send className="w-3 h-3" /> Disparar</>
                            )}
                          </button>
                          <button
                            onClick={() => handleCancel(alert.id)}
                            className="btn-ghost text-xs py-1.5 text-tertiary hover:text-critical"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateAlertModal
          onClose={() => setShowCreate(false)}
          onCreated={(a) => {
            setAlerts(prev => [a, ...prev]);
            setShowCreate(false);
            toast.success('Alerta criado como rascunho');
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// CREATE MODAL — melhorado com editor rico e templates
// ==========================================
function CreateAlertModal({ onClose, onCreated }: {
  onClose:   () => void;
  onCreated: (a: Alert) => void;
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<AlertFormData>({
    resolver: zodResolver(alertSchema),
    defaultValues: { severity: 'high', targetScope: 'all', alertType: 'flood_warning' },
  });

  const scope   = watch('targetScope');
  const message = watch('message') ?? '';
  const title   = watch('title') ?? '';
  const [preview, setPreview] = useState(false);
  const [sendNow, setSendNow] = useState(false);

  // Templates de notificação prontos
  const TEMPLATES = [
    {
      label: '🌧️ Briefing Meteorológico',
      title: 'BRIEFING METEOROLÓGICO — DEFESA CIVIL',
      message: `*SEDEC — Defesa Civil de Iguaba Grande*\n\n*CENÁRIO ATUAL*\nInforme aqui as condições meteorológicas atuais.\n\n*CENÁRIO FUTURO*\nDescreva a previsão para as próximas horas.\n\n*RISCO*\nNível de risco e regiões afetadas.\n\nFiquem atentos aos canais oficiais da Defesa Civil.`,
    },
    {
      label: '⚠️ Alerta de Alagamento',
      title: '⚠️ ALERTA DE ALAGAMENTO',
      message: `*Defesa Civil de Iguaba Grande informa:*\n\nRisco de alagamento em _[região]_. Evite áreas de baixada e próximo a rios e lagoas.\n\n*ORIENTAÇÕES:*\nAfaste-se de áreas alagadas. Não tente atravessar água em movimento. Em caso de emergência, ligue 199.`,
    },
    {
      label: '🌊 Mar Agitado',
      title: '🌊 AVISO — MAR AGITADO',
      message: `*Defesa Civil de Iguaba Grande:*\n\nMar agitado com ondas de até _[altura]_ metros previstas para hoje. *Banho de mar não recomendado.*\n\nEvite atividades náuticas e fique afastado da orla em áreas de risco.`,
    },
    {
      label: '✅ Normalização',
      title: '✅ SITUAÇÃO NORMALIZADA',
      message: `*Defesa Civil de Iguaba Grande informa:*\n\nA situação de _[evento]_ foi normalizada. As equipes de campo permanecem em monitoramento.\n\nAgradecemos a colaboração de todos os cidadãos.`,
    },
  ];

  // Renderizar preview do texto rico
  function renderPreview(text: string): React.ReactNode {
    return text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} className="h-2" />;
      const parts: React.ReactNode[] = [];
      const regex = /\*([^*]+)\*|_([^_]+)_/g;
      let last = 0, match;
      const lineContent = line;
      regex.lastIndex = 0;
      while ((match = regex.exec(lineContent)) !== null) {
        if (match.index > last) parts.push(<span key={`t${i}-${last}`}>{lineContent.slice(last, match.index)}</span>);
        if (match[1]) parts.push(<strong key={`b${i}-${match.index}`} className="text-primary">{match[1]}</strong>);
        if (match[2]) parts.push(<em key={`e${i}-${match.index}`} className="text-secondary">{match[2]}</em>);
        last = match.index + match[0].length;
      }
      if (last < lineContent.length) parts.push(<span key={`t${i}-end`}>{lineContent.slice(last)}</span>);
      return <p key={i} className="text-sm text-secondary leading-relaxed">{parts}</p>;
    });
  }

  async function onSubmit(data: AlertFormData) {
    try {
      const payload: Record<string, any> = {
        ...data,
        targetRegions: data.targetRegions
          ? data.targetRegions.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      };
      const alert = await alertsApi.create(payload);
      // Se marcou "enviar agora", disparar imediatamente
      if (sendNow) {
        await alertsApi.send(alert.id);
        toast.success(`Alerta enviado para ${alert.recipientsCount ?? '?'} dispositivos!`);
      }
      onCreated(alert);
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao criar alerta');
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="panel w-full max-w-2xl shadow-panel max-h-[92vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-primary flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Criar Alerta / Notificação
            </h2>
            <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
          </div>

          {/* Templates */}
          <div className="px-5 pt-4">
            <p className="data-label mb-2">Templates rápidos</p>
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES.map(t => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => { setValue('title', t.title); setValue('message', t.message); }}
                  className="px-2.5 py-1.5 rounded border border-border bg-panel text-xs font-mono text-secondary hover:text-primary hover:border-amber-500/30 transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="data-label block mb-1.5">Tipo</label>
                <select className="select" {...register('alertType')}>
                  {ALERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="data-label block mb-1.5">Severidade</label>
                <select className="select" {...register('severity')}>
                  <option value="critical">🔴 Crítico</option>
                  <option value="high">🟠 Alto</option>
                  <option value="medium">🟡 Médio</option>
                  <option value="info">🔵 Informativo</option>
                </select>
              </div>
            </div>

            <div>
              <label className="data-label block mb-1.5">Título *</label>
              <input {...register('title')} className="input" placeholder="Ex: ⚠️ ALERTA DE ALAGAMENTO" />
              {errors.title && <p className="text-2xs text-critical mt-1">{errors.title.message}</p>}
            </div>

            {/* Editor de mensagem com toolbar de formatação */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="data-label">Mensagem *</label>
                <div className="flex items-center gap-2">
                  {/* Dica de formatação */}
                  <span className="text-2xs font-mono text-tertiary">
                    *negrito* · _itálico_
                  </span>
                  {/* Toggle preview */}
                  <button
                    type="button"
                    onClick={() => setPreview(!preview)}
                    className={`text-2xs font-mono px-2 py-0.5 rounded border transition-colors ${
                      preview
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                        : 'border-border text-tertiary hover:text-secondary'
                    }`}
                  >
                    {preview ? 'Editar' : 'Preview'}
                  </button>
                </div>
              </div>

              {preview ? (
                /* Preview com formatação */
                <div className="input min-h-[180px] overflow-y-auto space-y-0.5">
                  {title && <p className="font-semibold text-primary mb-2">{title}</p>}
                  {renderPreview(message)}
                </div>
              ) : (
                <textarea
                  {...register('message')}
                  rows={8}
                  className="input resize-none font-mono text-xs leading-relaxed"
                  placeholder={`*TÍTULO DA SEÇÃO*\nTexto normal da mensagem\n\n*OUTRA SEÇÃO*\nMais texto com _itálico_ e *negrito*`}
                />
              )}
              {errors.message && <p className="text-2xs text-critical mt-1">{errors.message.message}</p>}
            </div>

            {/* Preview no celular */}
            {message && !preview && (
              <div className="bg-panel border border-border rounded-lg p-3">
                <p className="text-2xs font-mono text-tertiary mb-2">📱 Preview no celular</p>
                <div className="bg-[#1E293B] rounded-lg p-3 space-y-0.5">
                  <p className="text-xs font-semibold text-white">{title || 'Título do alerta'}</p>
                  <p className="text-2xs text-gray-300 leading-relaxed line-clamp-3">
                    {message.replace(/\*|_/g, '').slice(0, 120)}{message.length > 120 ? '...' : ''}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="data-label block mb-1.5">Segmentação</label>
              <div className="flex gap-2">
                {[
                  { v: 'all',     l: 'Cidade toda', i: <Globe className="w-3.5 h-3.5" /> },
                  { v: 'regions', l: 'Regiões',      i: <MapPin className="w-3.5 h-3.5" /> },
                ].map(({ v, l, i }) => (
                  <label key={v} className={`flex items-center gap-1.5 px-3 py-2 rounded border cursor-pointer text-xs font-mono transition-colors ${
                    scope === v
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                      : 'border-border text-secondary hover:border-muted'
                  }`}>
                    <input type="radio" value={v} {...register('targetScope')} className="sr-only" />
                    {i}{l}
                  </label>
                ))}
              </div>
            </div>

            {scope === 'regions' && (
              <div>
                <label className="data-label block mb-1.5">Regiões (separadas por vírgula)</label>
                <input {...register('targetRegions')} className="input" placeholder="centro, praia seca, maçabu" />
              </div>
            )}

            <div>
              <label className="data-label block mb-1.5">Expira em (opcional)</label>
              <input type="datetime-local" {...register('expiresAt')} className="input" />
            </div>

            {/* Opção de envio imediato */}
            <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <input
                type="checkbox"
                id="sendNow"
                checked={sendNow}
                onChange={e => setSendNow(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
              <label htmlFor="sendNow" className="text-sm cursor-pointer">
                <span className="font-medium text-primary">⚡ Enviar imediatamente</span>
                <span className="text-tertiary text-xs ml-2">(sem salvar como rascunho)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancelar</button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`text-xs flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  sendNow
                    ? 'bg-critical text-white hover:bg-red-600 disabled:opacity-60'
                    : 'btn-primary disabled:opacity-60'
                }`}
              >
                {isSubmitting ? (
                  <span className="animate-pulse">{sendNow ? 'Enviando...' : 'Criando...'}</span>
                ) : sendNow ? (
                  <><Send className="w-3.5 h-3.5" /> Disparar agora</>
                ) : (
                  'Salvar rascunho'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
