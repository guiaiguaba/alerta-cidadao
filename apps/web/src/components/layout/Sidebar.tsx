'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  AlertTriangle, LayoutDashboard, FileWarning, BellRing,
  Users, UsersRound, BarChart3, Settings, LogOut,
  ChevronLeft, ChevronRight, Shield, HardHat,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAppStore } from '@/lib/store/app.store';

const NAV_ITEMS = [
  { href: '/dashboard',            icon: LayoutDashboard, label: 'Dashboard',      exact: true },
  { href: '/dashboard/occurrences',icon: FileWarning,     label: 'Ocorrências' },
  { href: '/dashboard/alerts',     icon: BellRing,        label: 'Alertas' },
  { href: '/dashboard/analytics',  icon: BarChart3,       label: 'Relatórios' },
  { href: '/dashboard/agentes',    icon: HardHat,         label: 'Agentes' },
  { href: '/dashboard/teams',      icon: UsersRound,      label: 'Equipes' },
  { href: '/dashboard/cidadaos',   icon: Users,           label: 'Cidadãos' },
  { href: '/dashboard/settings',   icon: Settings,        label: 'Configurações' },
];

export function Sidebar() {
  const pathname         = usePathname();
  const { data: session }         = useSession();
  const { sidebarCollapsed, toggleSidebar, criticalCount } = useAppStore();
  const user = (session?.user as any);

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-surface border-r border-border transition-all duration-300 shrink-0',
        sidebarCollapsed ? 'w-[60px]' : 'w-[220px]',
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-4 border-b border-border',
        sidebarCollapsed && 'justify-center px-2',
      )}>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-gradient-amber leading-none">ALERTA</p>
            <p className="font-display text-sm font-bold text-gradient-amber leading-none">CIDADÃO</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact);
          const isCriticalBadge = href.includes('occurrences') && criticalCount > 0;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'nav-item relative',
                active && 'nav-item-active',
                sidebarCollapsed && 'justify-center px-2',
              )}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
              {isCriticalBadge && !sidebarCollapsed && (
                <span className="ml-auto bg-critical text-white text-2xs font-mono px-1.5 py-0.5 rounded-full">
                  {criticalCount}
                </span>
              )}
              {isCriticalBadge && sidebarCollapsed && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-critical rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + Collapse */}
      <div className="border-t border-border">
        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-tertiary hover:text-secondary transition-colors text-xs font-mono',
            sidebarCollapsed && 'justify-center',
          )}
        >
          {sidebarCollapsed
            ? <ChevronRight className="w-4 h-4" />
            : <><ChevronLeft className="w-4 h-4" /><span>Recolher</span></>
          }
        </button>

        {/* User info */}
        {user && (
          <div className={cn(
            'flex items-center gap-2.5 px-3 py-3 border-t border-border',
            sidebarCollapsed && 'justify-center px-2',
          )}>
            <div className="flex-shrink-0 w-7 h-7 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <span className="text-2xs font-mono font-bold text-amber-400">
                {getInitials(user.name ?? 'U')}
              </span>
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-primary truncate">{user.name}</p>
                  <p className="text-2xs font-mono text-tertiary truncate">
                    {{ admin: 'Administrador', supervisor: 'Supervisor', agent: 'Agente', citizen: 'Cidadão' }[user.role] ?? user.role}
                  </p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-tertiary hover:text-critical transition-colors p-1"
                  title="Sair"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
