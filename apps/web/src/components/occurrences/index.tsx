// src/components/occurrences/OccurrenceRow.tsx
import { Occurrence } from '@/types';
import { cn, getPriorityClass, getStatusClass, formatRelative, getSlaStatus, formatDate } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface OccurrenceRowProps {
  occurrence: Occurrence;
  onClick:    () => void;
  isSelected: boolean;
}

export function OccurrenceRow({ occurrence: o, onClick, isSelected }: OccurrenceRowProps) {
  const sla = getSlaStatus(o.slaDeadline, o.slaBreached);

  return (
    <tr
      onClick={onClick}
      className={cn(
        'table-row-hover',
        isSelected && 'bg-amber-500/5 border-l-2 border-l-amber-500',
        o.priority === 'critical' && !isSelected && 'bg-critical-bg/30',
      )}
    >
      {/* Protocolo */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {o.priority === 'critical' && <AlertTriangle className="w-3 h-3 text-critical flex-shrink-0" />}
          <span className="font-mono text-xs text-amber-400">{o.protocol}</span>
        </div>
      </td>

      {/* Categoria */}
      <td className="px-4 py-3">
        <span className="text-sm text-primary">{o.categoryName}</span>
        {o.description && (
          <p className="text-xs text-tertiary truncate max-w-[200px]">{o.description}</p>
        )}
      </td>

      {/* Endereço */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-secondary truncate max-w-[180px] block">
          {o.address ?? o.regionCode ?? '—'}
        </span>
      </td>

      {/* Prioridade */}
      <td className="px-4 py-3">
        <span className={getPriorityClass(o.priority)}>{o.priority}</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={getStatusClass(o.status)}>{o.status.replace('_', ' ')}</span>
      </td>

      {/* Agente */}
      <td className="px-4 py-3 hidden xl:table-cell">
        <span className="text-xs text-secondary">{o.agentName ?? '—'}</span>
      </td>

      {/* SLA */}
      <td className="px-4 py-3 hidden xl:table-cell">
        {sla ? (
          <span className={cn('text-2xs font-mono', sla.color)}>{sla.label}</span>
        ) : <span className="text-tertiary">—</span>}
      </td>

      {/* Data */}
      <td className="px-4 py-3">
        <span className="text-2xs font-mono text-tertiary" title={formatDate(o.createdAt)}>
          {formatRelative(o.createdAt)}
        </span>
      </td>
    </tr>
  );
}

// ============================================================

// src/components/occurrences/OccurrenceFiltersBar.tsx
'use client';
import { OccurrenceFilters, OccurrenceStatus, Priority } from '@/types';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

const STATUSES: OccurrenceStatus[] = ['open', 'assigned', 'in_progress', 'resolved', 'rejected'];
const PRIORITIES: Priority[]       = ['critical', 'high', 'medium', 'low'];

interface FiltersBarProps {
  filters:  OccurrenceFilters;
  onChange: (f: Partial<OccurrenceFilters>) => void;
}

export function OccurrenceFiltersBar({ filters, onChange }: FiltersBarProps) {
  const hasFilters = filters.status || filters.priority || filters.regionCode;

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface/30 overflow-x-auto shrink-0">
      {/* Status tabs */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onChange({ status: undefined })}
          className={cn('text-2xs font-mono px-2 py-1 rounded transition-colors',
            !filters.status
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'text-tertiary hover:text-secondary'
          )}
        >
          Todos
        </button>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => onChange({ status: s === filters.status ? undefined : s })}
            className={cn(
              'text-2xs font-mono px-2 py-1 rounded transition-colors capitalize',
              filters.status === s
                ? `badge-${s}`
                : 'text-tertiary hover:text-secondary',
            )}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-border mx-1 shrink-0" />

      {/* Prioridade */}
      <div className="flex items-center gap-1 shrink-0">
        {PRIORITIES.map(p => (
          <button
            key={p}
            onClick={() => onChange({ priority: p === filters.priority ? undefined : p })}
            className={cn(
              'text-2xs font-mono px-2 py-1 rounded transition-colors',
              filters.priority === p
                ? `badge-${p}`
                : 'text-tertiary hover:text-secondary',
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => onChange({ status: undefined, priority: undefined, regionCode: undefined })}
          className="ml-auto flex items-center gap-1 text-2xs font-mono text-tertiary hover:text-critical transition-colors shrink-0"
        >
          <X className="w-3 h-3" /> Limpar
        </button>
      )}
    </div>
  );
}

// ============================================================

// src/components/occurrences/OccurrenceDrawer.tsx
'use client';
import { useEffect, useState } from 'react';
import { occurrencesApi } from '@/lib/api/client';
import { Occurrence } from '@/types';
import {
  getPriorityClass, getStatusClass, getSlaStatus,
  formatDate, formatRelative, STATUS_LABELS, truncate,
} from '@/lib/utils';
import { X, MapPin, Clock, User, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface DrawerProps {
  occurrenceId:   string;
  onClose:        () => void;
  onStatusUpdate: (id: string, status: string, note?: string) => Promise<void>;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open:        ['assigned', 'rejected'],
  assigned:    ['in_progress', 'rejected'],
  in_progress: ['resolved', 'assigned'],
  rejected:    ['open'],
};

export function OccurrenceDrawer({ occurrenceId, onClose, onStatusUpdate }: DrawerProps) {
  const [occ,        setOcc]       = useState<Occurrence | null>(null);
  const [loading,    setLoading]   = useState(true);
  const [noteText,   setNoteText]  = useState('');
  const [updating,   setUpdating]  = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    setLoading(true);
    occurrencesApi.get(occurrenceId)
      .then(setOcc)
      .catch(() => toast.error('Erro ao carregar ocorrência'))
      .finally(() => setLoading(false));
  }, [occurrenceId]);

  async function handleStatusChange(newStatus: string) {
    if (!occ) return;
    setUpdating(true);
    try {
      await onStatusUpdate(occ.id, newStatus, noteText || undefined);
      setOcc(prev => prev ? { ...prev, status: newStatus as any } : null);
      setNoteText('');
      toast.success(`Status → ${STATUS_LABELS[newStatus as keyof typeof STATUS_LABELS]}`);
    } catch { /* toast já feito no parent */ }
    finally { setUpdating(false); }
  }

  const sla = getSlaStatus(occ?.slaDeadline, occ?.slaBreached);
  const nextStatuses = occ ? (STATUS_TRANSITIONS[occ.status] ?? []) : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 bottom-0 w-[420px] bg-surface border-l border-border z-50 flex flex-col shadow-panel animate-slide-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          {loading ? (
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
          ) : (
            <div>
              <p className="font-mono text-sm text-amber-400">{occ?.protocol}</p>
              <p className="text-xs text-tertiary mt-0.5">{occ?.categoryName}</p>
            </div>
          )}
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={cn('h-4 bg-muted animate-pulse rounded', i % 2 === 0 ? 'w-3/4' : 'w-1/2')} />
              ))}
            </div>
          ) : occ && (
            <div className="p-5 space-y-5">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={getPriorityClass(occ.priority)}>{occ.priority}</span>
                <span className={getStatusClass(occ.status)}>{occ.status.replace('_', ' ')}</span>
                {occ.slaBreached && <span className="badge-critical">SLA Violado</span>}
              </div>

              {/* Descrição */}
              {occ.description && (
                <div>
                  <p className="data-label mb-1">Descrição</p>
                  <p className="text-sm text-primary leading-relaxed">{occ.description}</p>
                </div>
              )}

              {/* Localização */}
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-primary">{occ.address ?? 'Endereço não informado'}</p>
                  <p className="text-2xs font-mono text-tertiary">
                    {occ.lat.toFixed(6)}, {occ.lng.toFixed(6)}
                  </p>
                </div>
              </div>

              {/* SLA */}
              {sla && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-tertiary" />
                  <span className={cn('text-xs font-mono', sla.color)}>{sla.label}</span>
                  {occ.slaDeadline && (
                    <span className="text-2xs font-mono text-tertiary">
                      Prazo: {formatDate(occ.slaDeadline)}
                    </span>
                  )}
                </div>
              )}

              {/* Reporter */}
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-tertiary" />
                <div>
                  <p className="text-xs text-primary">{occ.reporterName}</p>
                  <p className="text-2xs font-mono text-tertiary">Registrado {formatRelative(occ.createdAt)}</p>
                </div>
              </div>

              {/* Agente */}
              {occ.agentName && (
                <div className="bg-panel border border-border rounded p-3">
                  <p className="data-label mb-1">Agente Responsável</p>
                  <p className="text-sm text-primary">{occ.agentName}</p>
                  {occ.assignedTo && (
                    <p className="text-2xs font-mono text-tertiary">Atribuído em {formatRelative(occ.createdAt)}</p>
                  )}
                </div>
              )}

              {/* Mídia */}
              {(occ.media?.length ?? 0) > 0 && (
                <div>
                  <p className="data-label mb-2">
                    <ImageIcon className="w-3 h-3 inline mr-1" />
                    Fotos ({occ.media!.length})
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {occ.media!.map(m => (
                      <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={m.thumbnailUrl ?? m.url}
                          alt=""
                          className="w-full h-20 object-cover rounded border border-border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline toggle */}
              {(occ.timeline?.length ?? 0) > 0 && (
                <div>
                  <button
                    onClick={() => setShowTimeline(!showTimeline)}
                    className="data-label flex items-center gap-1 hover:text-secondary transition-colors w-full"
                  >
                    Histórico ({occ.timeline!.length})
                    {showTimeline ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showTimeline && (
                    <div className="mt-3 space-y-2 border-l-2 border-border pl-4">
                      {occ.timeline!.map(t => (
                        <div key={t.id} className="relative">
                          <div className="absolute -left-[21px] w-2 h-2 rounded-full bg-border top-1.5" />
                          <p className="text-xs text-primary">
                            {t.action === 'status_changed'
                              ? `${t.fromStatus} → ${t.toStatus}`
                              : t.action
                            }
                          </p>
                          {t.note && <p className="text-xs text-secondary mt-0.5 italic">"{t.note}"</p>}
                          <p className="text-2xs font-mono text-tertiary">{t.userName} · {formatRelative(t.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — Ações de status */}
        {occ && nextStatuses.length > 0 && (
          <div className="border-t border-border p-4 space-y-3">
            <div>
              <p className="data-label mb-1.5">Observação (opcional)</p>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Adicionar nota..."
                rows={2}
                className="input resize-none text-xs"
              />
            </div>
            <div className="flex gap-2">
              {nextStatuses.map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={updating}
                  className={cn(
                    'flex-1 text-xs py-2 rounded-md font-mono border transition-colors disabled:opacity-50',
                    s === 'resolved'
                      ? 'bg-low/10 border-low/30 text-low hover:bg-low/20'
                      : s === 'rejected'
                      ? 'bg-critical/10 border-critical/30 text-critical hover:bg-critical/20'
                      : 'bg-info/10 border-info/30 text-info hover:bg-info/20',
                  )}
                >
                  {STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

// ============================================================

// src/components/occurrences/RecentOccurrences.tsx
'use client';
import { useEffect, useState } from 'react';
import { occurrencesApi } from '@/lib/api/client';
import { Occurrence } from '@/types';
import { getPriorityClass, formatRelative } from '@/lib/utils';
import { useWebSocket } from '@/lib/hooks/useWebSocket';

export function RecentOccurrences() {
  const [items,  setItems]  = useState<Occurrence[]>([]);
  const { on }              = useWebSocket();

  useEffect(() => {
    occurrencesApi.list({ limit: 15, status: 'open' }).then(res => setItems(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const off = on('occurrence:created', (occ) => {
      setItems(prev => [occ, ...prev].slice(0, 15));
    });
    return off;
  }, [on]);

  if (items.length === 0) {
    return <p className="text-center text-xs font-mono text-tertiary py-8">Sem ocorrências abertas</p>;
  }

  return (
    <div className="divide-y divide-border/50">
      {items.map(o => (
        <div key={o.id} className="px-4 py-2.5 hover:bg-muted/30 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-mono text-amber-400">{o.protocol}</p>
              <p className="text-xs text-primary truncate">{o.categoryName}</p>
              <p className="text-2xs text-tertiary truncate">{o.address ?? o.regionCode ?? ''}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={getPriorityClass(o.priority)}>{o.priority}</span>
              <span className="text-2xs font-mono text-tertiary">{formatRelative(o.createdAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
