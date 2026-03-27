import { useAuthStore, AuthUser } from '@/lib/state/auth-store';

export interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  userId: string | null;
  ipAddress: string | null;
  createdAt: string;
  details: Record<string, unknown> | null;
}

export interface AuditLogsResult {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminSession {
  id: string;
  deviceName: string | null;
  platform: string | null;
  lastSeenAt: string;
  createdAt: string;
}

export interface AdminUser extends AuthUser {
  createdAt: string;
  sessions?: AdminSession[];
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  adminCount: number;
  totalSessions: number;
  recentRegistrations: { date: string; count: number }[];
}

export interface AdminUsersResult {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminConfig {
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;

async function adminGet<T>(path: string): Promise<T> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message ?? json?.message ?? 'שגיאת שרת';
    throw new Error(message);
  }
  return json.data as T;
}

async function adminPost<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message ?? json?.message ?? 'שגיאת שרת';
    throw new Error(message);
  }
  return json.data as T;
}

async function adminPut<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message ?? json?.message ?? 'שגיאת שרת';
    throw new Error(message);
  }
  return json.data as T;
}

async function adminDelete<T>(path: string): Promise<T> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message ?? json?.message ?? 'שגיאת שרת';
    throw new Error(message);
  }
  return json.data as T;
}

export const getAdminStats = (): Promise<AdminStats> =>
  adminGet<AdminStats>('/api/admin/stats');

export const getUsers = (page = 1, limit = 20, search = ''): Promise<AdminUsersResult> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return adminGet<AdminUsersResult>(`/api/admin/users?${params.toString()}`);
};

export const getUser = (id: string): Promise<AdminUser> =>
  adminGet<AdminUser>(`/api/admin/users/${id}`);

export const updateUser = (id: string, data: { status?: AdminUser['status']; role?: AdminUser['role'] }): Promise<AdminUser> =>
  adminPut<AdminUser>(`/api/admin/users/${id}`, data as Record<string, unknown>);

export const resetUserPassword = (id: string): Promise<{ resetToken: string; expiresAt: string }> =>
  adminPost(`/api/admin/users/${id}/reset-password`);

export const logoutUserSessions = (id: string): Promise<{ success: boolean; deletedCount: number }> =>
  adminDelete(`/api/admin/users/${id}/sessions`);

export const getConfig = (): Promise<{ configs: AdminConfig[] }> =>
  adminGet('/api/admin/config');

export const updateConfig = (key: string, value: string, description?: string): Promise<AdminConfig> =>
  adminPut<AdminConfig>(`/api/admin/config/${key}`, { value, ...(description !== undefined ? { description } : {}) });

export const getAdminAuditLogs = (page = 1, limit = 30): Promise<AuditLogsResult> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return adminGet<AuditLogsResult>(`/api/admin/audit-logs?${params.toString()}`);
};
