// src/types/index.ts

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type OccurrenceStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'rejected' | 'duplicate';
export type Role = 'citizen' | 'agent' | 'supervisor' | 'admin' | 'super_admin';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'info';
export type AlertStatus = 'draft' | 'sending' | 'sent' | 'cancelled';
export type AlertScope = 'all' | 'regions' | 'radius';

// ==========================================
// USER
// ==========================================
export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  role: Role;
  isActive: boolean;
  isBlocked: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface AuthUser extends User {
  tenantId: string;
  schemaName: string;
}

// ==========================================
// TENANT
// ==========================================
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  subdomain: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  stateCode: string;
  centerLat?: number;
  centerLng?: number;
  defaultZoom: number;
  plan: string;
}

// ==========================================
// OCCURRENCE
// ==========================================
export interface Category {
  id: number;
  code: string;
  name: string;
  icon: string;
  color: string;
  defaultPriority: Priority;
}

export interface OccurrenceMedia {
  id: string;
  url: string;
  thumbnailUrl?: string;
  mediaType: 'photo' | 'video';
  phase: 'report' | 'during' | 'after';
  createdAt: string;
}

export interface TimelineEntry {
  id: string;
  action: string;
  fromStatus?: OccurrenceStatus;
  toStatus?: OccurrenceStatus;
  note?: string;
  userId: string;
  userName: string;
  userRole: Role;
  userAvatar?: string;
  createdAt: string;
}

export interface Occurrence {
  id: string;
  protocol: string;
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  description?: string;
  lat: number;
  lng: number;
  address?: string;
  regionCode?: string;
  priority: Priority;
  status: OccurrenceStatus;
  reporterId: string;
  reporterName: string;
  reporterAvatar?: string;
  assignedTo?: string;
  agentName?: string;
  teamId?: string;
  slaDeadline?: string;
  slaBreached: boolean;
  resolvedAt?: string;
  resolutionNote?: string;
  media?: OccurrenceMedia[];
  timeline?: TimelineEntry[];
  mediaCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OccurrenceListResponse {
  data: Occurrence[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ==========================================
// ALERT
// ==========================================
export interface Alert {
  id: string;
  title: string;
  message: string;
  alertType: string;
  severity: AlertSeverity;
  targetScope: AlertScope;
  targetRegions?: string[];
  targetLat?: number;
  targetLng?: number;
  targetRadiusM?: number;
  occurrenceId?: string;
  createdBy: string;
  creatorName: string;
  status: AlertStatus;
  sentAt?: string;
  recipientsCount: number;
  expiresAt?: string;
  createdAt: string;
}

// ==========================================
// TEAM
// ==========================================
export interface TeamMember {
  id: string;
  name: string;
  role: 'member' | 'supervisor';
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  regionCodes: string[];
  memberCount: number;
  members: TeamMember[];
  isActive: boolean;
  createdAt: string;
}

// ==========================================
// ANALYTICS
// ==========================================
export interface DashboardData {
  overview: {
    total: string;
    open: string;
    in_progress: string;
    resolved: string;
  };
  byStatus: { status: string; count: string }[];
  byPriority: { priority: Priority; count: string }[];
  resolution: { avg_minutes: string; median_minutes: string };
  sla: {
    total_resolved: string;
    within_sla: string;
    breached: string;
    sla_compliance_pct: string;
  };
  today: { total_today: string; resolved_today: string };
  topAgents: {
    id: string;
    name: string;
    resolved_count: string;
    avg_minutes: string;
  }[];
  generatedAt: string;
}

export interface TimelinePoint {
  period: string;
  total: string;
  resolved: string;
  critical: string;
  sla_breaches: string;
}

export interface CategoryStat {
  id: number;
  name: string;
  icon: string;
  color: string;
  total: string;
  resolved: string;
  resolution_rate_pct: string;
  avg_minutes: string;
}

export interface AgentStat {
  id: string;
  name: string;
  avatar_url?: string;
  assigned_total: string;
  resolved_total: string;
  avg_resolution_min: string;
  sla_breaches: string;
  resolution_rate_pct: string;
}

// ==========================================
// WEBSOCKET EVENTS
// ==========================================
export type WsEvent =
  | { event: 'occurrence:created'; data: Occurrence }
  | { event: 'occurrence:updated'; data: { id: string; status: OccurrenceStatus; priority: Priority } }
  | { event: 'alert:new'; data: Alert };

// ==========================================
// PAGINATION
// ==========================================
export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface OccurrenceFilters {
  status?: OccurrenceStatus;
  priority?: Priority;
  regionCode?: string;
  categoryId?: number;
  assignedTo?: string;
  page?: number;
  limit?: number;
  bbox?: string;
}
