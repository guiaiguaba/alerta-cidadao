// src/components/analytics/MetricCard.tsx
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label:    string;
  value:    string | number;
  icon:     React.ReactNode;
  color:    'amber' | 'orange' | 'green' | 'violet' | 'red';
  sublabel?: string;
  trend?:   { value: number; label: string };
}

const COLOR_MAP = {
  amber:  'shadow-glow-amber/30',
  orange: 'shadow-orange-500/10',
  green:  'shadow-green-500/10',
  violet: 'shadow-violet-500/10',
  red:    'shadow-red-500/10',
};

export function MetricCard({ label, value, icon, color, sublabel, trend }: MetricCardProps) {
  return (
    <div className={cn('metric-card', COLOR_MAP[color])}>
      <div className="flex items-center justify-between">
        <p className="data-label">{label}</p>
        <span className="opacity-80">{icon}</span>
      </div>
      <p className="font-mono text-3xl font-bold text-primary leading-none">{value}</p>
      {sublabel && <p className="text-2xs font-mono text-tertiary">{sublabel}</p>}
      {trend && (
        <p className={cn(
          'text-2xs font-mono',
          trend.value >= 0 ? 'text-low' : 'text-critical',
        )}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}

// ===================================================

// src/components/analytics/OccurrenceChart.tsx
'use client';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OccurrenceChartProps {
  data:    any[];
  loading: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="panel px-3 py-2 text-xs font-mono space-y-1 shadow-panel">
      <p className="text-secondary mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="text-primary font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export function OccurrenceChart({ data, loading }: OccurrenceChartProps) {
  const formatted = data.map(d => ({
    ...d,
    period: (() => {
      try { return format(new Date(d.period), 'dd/MM', { locale: ptBR }); }
      catch { return d.period; }
    })(),
  }));

  return (
    <div className="panel p-5">
      <p className="data-label mb-4">Volume de Ocorrências · 30 dias</p>
      {loading ? (
        <div className="h-48 animate-pulse bg-muted rounded" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={formatted} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2535" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: '#4E5A6B', fontFamily: 'IBM Plex Mono', fontSize: 10 }}
              axisLine={{ stroke: '#1E2535' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#4E5A6B', fontFamily: 'IBM Plex Mono', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend
              wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#4E5A6B' }}
            />
            <Bar dataKey="total"    name="Total"     fill="#F59E0B" opacity={0.7} radius={[2,2,0,0]} />
            <Bar dataKey="resolved" name="Resolvidas" fill="#22C55E" opacity={0.7} radius={[2,2,0,0]} />
            <Line
              dataKey="sla_breaches"
              name="Violações SLA"
              stroke="#EF4444"
              strokeWidth={1.5}
              dot={false}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ===================================================

// src/components/analytics/SlaGauge.tsx
'use client';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

interface SlaGaugeProps {
  compliancePct: number;
  breached:      number;
  total:         number;
  loading:       boolean;
}

export function SlaGauge({ compliancePct, breached, total, loading }: SlaGaugeProps) {
  const pct   = Math.min(100, Math.max(0, compliancePct));
  const color = pct >= 90 ? '#22C55E' : pct >= 70 ? '#EAB308' : '#EF4444';
  const data  = [{ name: 'SLA', value: pct, fill: color }];

  return (
    <div className="panel p-5 flex flex-col gap-2">
      <p className="data-label">Conformidade SLA</p>
      {loading ? (
        <div className="h-32 animate-pulse bg-muted rounded" />
      ) : (
        <>
          <div className="relative flex items-center justify-center" style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height={120}>
              <RadialBarChart
                cx="50%" cy="85%"
                innerRadius="70%" outerRadius="100%"
                startAngle={180} endAngle={0}
                data={data}
              >
                <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#1E2535' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute bottom-0 text-center">
              <p className="font-mono text-3xl font-bold" style={{ color }}>
                {pct.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="flex justify-between text-2xs font-mono mt-1">
            <span className="text-tertiary">{total} resolvidas</span>
            <span className="text-critical">{breached} violadas</span>
          </div>
        </>
      )}
    </div>
  );
}
