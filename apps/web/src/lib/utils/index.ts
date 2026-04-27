// src/lib/utils/index.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Priority, OccurrenceStatus, AlertSeverity } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==========================================
// FORMATAÇÃO
// ==========================================

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
}

export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy HH:mm'): string {
  return format(new Date(date), pattern, { locale: ptBR });
}

export function formatMinutes(minutes: number | string): string {
  const m = Number(minutes);
  if (isNaN(m)) return '—';
  if (m < 60) return `${Math.round(m)}min`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

export function formatNumber(n: number | string): string {
  return Number(n).toLocaleString('pt-BR');
}

// ==========================================
// PRIORITY
// ==========================================

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Médio',
  low:      'Baixo',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  low:      '#22C55E',
};

export function getPriorityClass(priority: Priority): string {
  return `badge-${priority}`;
}

// ==========================================
// STATUS
// ==========================================

export const STATUS_LABELS: Record<OccurrenceStatus, string> = {
  open:        'Aberta',
  assigned:    'Atribuída',
  in_progress: 'Em Atendimento',
  resolved:    'Resolvida',
  rejected:    'Rejeitada',
  duplicate:   'Duplicata',
};

export function getStatusClass(status: OccurrenceStatus): string {
  return `badge-${status}`;
}

// ==========================================
// SEVERITY (ALERTS)
// ==========================================

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Médio',
  info:     'Informativo',
};

export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  info:     '#3B82F6',
};

// ==========================================
// SLA
// ==========================================

export function getSlaStatus(slaDeadline?: string, slaBreached?: boolean) {
  if (!slaDeadline) return null;
  if (slaBreached) return { label: 'Violado', color: 'text-critical', pct: 100 };

  const now = new Date();
  const deadline = new Date(slaDeadline);
  const minsLeft = differenceInMinutes(deadline, now);

  if (minsLeft <= 0)  return { label: 'Violado', color: 'text-critical', pct: 100 };
  if (minsLeft <= 15) return { label: `${minsLeft}min restantes`, color: 'text-high', pct: 90 };
  if (minsLeft <= 30) return { label: `${minsLeft}min restantes`, color: 'text-medium', pct: 70 };

  const h = Math.floor(minsLeft / 60);
  const m = minsLeft % 60;
  const label = h > 0 ? `${h}h ${m}min restantes` : `${m}min restantes`;
  return { label, color: 'text-low', pct: 30 };
}

// ==========================================
// MISC
// ==========================================

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    citizen:    'Cidadão',
    agent:      'Agente',
    supervisor: 'Supervisor',
    admin:      'Administrador',
    super_admin: 'Super Admin',
  };
  return map[role] ?? role;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}
