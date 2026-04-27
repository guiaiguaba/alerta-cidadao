// src/lib/store/app.store.ts
import { create } from 'zustand';
import { Occurrence, Alert, DashboardData } from '@/types';

interface AppStore {
  // Real-time feed de eventos
  recentEvents: { type: string; data: any; at: Date }[];
  addEvent: (type: string, data: any) => void;

  // Ocorrências abertas urgentes (para sidebar badge)
  criticalCount: number;
  setCriticalCount: (n: number) => void;

  // Alertas ativos
  activeAlerts: Alert[];
  setActiveAlerts: (alerts: Alert[]) => void;

  // Sidebar collapse
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Dashboard cache
  dashboard: DashboardData | null;
  setDashboard: (d: DashboardData) => void;
  dashboardStale: boolean;
  markDashboardStale: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  recentEvents: [],
  addEvent: (type, data) =>
    set(s => ({
      recentEvents: [{ type, data, at: new Date() }, ...s.recentEvents].slice(0, 50),
      dashboardStale: true,
    })),

  criticalCount: 0,
  setCriticalCount: (n) => set({ criticalCount: n }),

  activeAlerts: [],
  setActiveAlerts: (alerts) => set({ activeAlerts: alerts }),

  sidebarCollapsed: false,
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  dashboard: null,
  setDashboard: (d) => set({ dashboard: d, dashboardStale: false }),
  dashboardStale: false,
  markDashboardStale: () => set({ dashboardStale: true }),
}));
