'use client';
import { useEffect, useState } from 'react';
import { Bell, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useAppStore } from '@/lib/store/app.store';
import { formatRelative, PRIORITY_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { isConnected, on } = useWebSocket();
  const { recentEvents, dashboardStale, addEvent } = useAppStore();
  const [showEvents, setShowEvents] = useState(false);
  const [newEventCount, setNewEventCount] = useState(0);

  useEffect(() => {
    const off1 = on('occurrence:created', (data) => {
      addEvent('occurrence:created', data);
      setNewEventCount(c => c + 1);
    });
    const off2 = on('occurrence:updated', (data) => {
      addEvent('occurrence:updated', data);
    });
    const off3 = on('alert:new', (data) => {
      addEvent('alert:new', data);
      setNewEventCount(c => c + 1);
    });
    return () => { off1(); off2(); off3(); };
  }, [on, addEvent]);

  function getEventLabel(type: string, data: any): string {
    if (type === 'occurrence:created') return `Nova ocorrência: ${data.protocol}`;
    if (type === 'occurrence:updated') return `Ocorrência atualizada → ${data.status}`;
    if (type === 'alert:new')          return `Novo alerta: ${data.title}`;
    return 'Evento desconhecido';
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-20">
      {/* Title */}
      <div>
        <h1 className="font-display text-lg font-bold text-primary">{title}</h1>
        {subtitle && <p className="text-xs font-mono text-tertiary mt-0.5">{subtitle}</p>}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Stale indicator */}
        {dashboardStale && (
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 text-2xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 hover:bg-amber-500/20 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Dados desatualizados
          </button>
        )}

        {/* WS status */}
        <div
          title={isConnected ? 'Tempo real ativo' : 'Desconectado — reconectando...'}
          className={cn(
            'flex items-center gap-1.5 text-2xs font-mono px-2 py-1 rounded',
            isConnected
              ? 'text-low bg-low-bg border border-low-border'
              : 'text-critical bg-critical-bg border border-critical-border',
          )}
        >
          {isConnected
            ? <><span className="live-dot" /><Wifi className="w-3 h-3" /> AO VIVO</>
            : <><WifiOff className="w-3 h-3" /> OFFLINE</>
          }
        </div>

        {/* Events bell */}
        <div className="relative">
          <button
            onClick={() => { setShowEvents(!showEvents); setNewEventCount(0); }}
            className={cn(
              'btn-ghost relative',
              newEventCount > 0 && 'text-amber-400',
            )}
          >
            <Bell className="w-4 h-4" />
            {newEventCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-black text-2xs font-mono font-bold rounded-full flex items-center justify-center leading-none">
                {newEventCount > 9 ? '9+' : newEventCount}
              </span>
            )}
          </button>

          {showEvents && (
            <div className="absolute right-0 top-full mt-2 w-80 panel shadow-panel z-50 max-h-80 overflow-y-auto">
              <div className="p-3 border-b border-border">
                <p className="text-xs font-mono text-tertiary uppercase tracking-wider">Eventos Recentes</p>
              </div>
              {recentEvents.length === 0 ? (
                <p className="p-4 text-xs font-mono text-tertiary text-center">Nenhum evento ainda</p>
              ) : (
                <div className="divide-y divide-border">
                  {recentEvents.slice(0, 20).map((ev, i) => (
                    <div key={i} className="px-3 py-2.5">
                      <p className="text-xs text-primary">{getEventLabel(ev.type, ev.data)}</p>
                      <p className="text-2xs font-mono text-tertiary mt-0.5">{formatRelative(ev.at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Page actions */}
        {actions}
      </div>
    </header>
  );
}
