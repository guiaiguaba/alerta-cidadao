// src/lib/api/client.ts
// Typed API client com injeção automática de token + tenant

import { getSession } from 'next-auth/react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public error: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getToken(): Promise<string | null> {
  // Client-side
  if (typeof window !== 'undefined') {
    const session = await getSession();
    return (session as any)?.accessToken ?? null;
  }
  // Server-side (Server Components / Route Handlers)
  try {
    const session = await getServerSession(authOptions);
    return (session as any)?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { params?: Record<string, any> } = {},
): Promise<T> {
  const token = await getToken();

  // Build URL with query params
  const url = new URL(`${API_BASE}${path}`);
  if (options.params) {
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    ...options,
    headers,
    next: { revalidate: 0 }, // sempre fresco
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new ApiError(res.status, body.error ?? 'Error', body.message ?? 'Erro na requisição');
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

// ==========================================
// OCCURRENCES
// ==========================================
export const occurrencesApi = {
  list: (params?: Record<string, any>) =>
    request<any>('/occurrences', { params }),

  get: (id: string) =>
    request<any>(`/occurrences/${id}`),

  updateStatus: (id: string, body: { status: string; note?: string; assignedTo?: string; rejectionReason?: string }) =>
    request<any>(`/occurrences/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  assign: (id: string, body: { agentId?: string; teamId?: string }) =>
    request<any>(`/occurrences/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getTimeline: (id: string) =>
    request<any[]>(`/occurrences/${id}/timeline`),

  getMapData: (params?: Record<string, any>) =>
    request<any>('/occurrences/map', { params }),
};

// ==========================================
// ALERTS
// ==========================================
export const alertsApi = {
  listActive: (params?: Record<string, any>) =>
    request<any>('/alerts', { params }),

  listAll: (params?: Record<string, any>) =>
    request<any>('/alerts/admin', { params }),

  get: (id: string) =>
    request<any>(`/alerts/${id}`),

  create: (body: Record<string, any>) =>
    request<any>('/alerts', { method: 'POST', body: JSON.stringify(body) }),

  send: (id: string) =>
    request<any>(`/alerts/${id}/send`, { method: 'POST' }),

  cancel: (id: string) =>
    request<any>(`/alerts/${id}/cancel`, { method: 'PATCH' }),
};

// ==========================================
// ANALYTICS
// ==========================================
export const analyticsApi = {
  dashboard: () =>
    request<any>('/analytics/dashboard'),

  timeline: (params: { from: string; to: string; groupBy?: string }) =>
    request<any[]>('/analytics/timeline', { params }),

  byCategory: (days?: number) =>
    request<any[]>('/analytics/categories', { params: { days } }),

  byRegion: (days?: number) =>
    request<any[]>('/analytics/regions', { params: { days } }),

  agents: (days?: number) =>
    request<any[]>('/analytics/agents', { params: { days } }),

  slaReport: (params: { from: string; to: string }) =>
    request<any[]>('/analytics/sla', { params }),

  heatmap: (params?: Record<string, any>) =>
    request<any>('/analytics/heatmap', { params }),

  exportUrl: (params: Record<string, any>) => {
    const url = new URL(`${API_BASE}/analytics/export`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    return url.toString();
  },
};

// ==========================================
// USERS
// ==========================================
export const usersApi = {
  me: () => request<any>('/users/me'),

  list: () => request<any[]>('/admin/users'),

  updateRole: (id: string, role: string) =>
    request<any>(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),

  block: (id: string, reason: string) =>
    request<any>(`/users/${id}/block`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

  unblock: (id: string) =>
    request<any>(`/users/${id}/unblock`, { method: 'PATCH' }),
};

// ==========================================
// TEAMS
// ==========================================
export const teamsApi = {
  list: () => request<any[]>('/teams'),

  create: (body: { name: string; description?: string; regionCodes?: string[] }) =>
    request<any>('/teams', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Record<string, any>) =>
    request<any>(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  addMember: (teamId: string, userId: string, role = 'member') =>
    request<any>(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    }),

  removeMember: (teamId: string, userId: string) =>
    request<any>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
};

// ==========================================
// ADMIN
// ==========================================
export const adminApi = {
  getTenantConfig: () => request<any>('/admin/tenant'),
  updateTenantConfig: (body: Record<string, any>) =>
    request<any>('/admin/tenant', { method: 'PATCH', body: JSON.stringify(body) }),
  getCategories: () => request<any[]>('/admin/categories'),
  getRegions:    () => request<any[]>('/admin/regions'),
};

export default { occurrencesApi, alertsApi, analyticsApi, usersApi, teamsApi, adminApi };
