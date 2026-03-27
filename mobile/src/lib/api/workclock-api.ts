import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';
import { api } from '@/lib/api/api';
import type { Settings, WorkSession, Stats } from '@/lib/types';

// ─── Authenticated API helper ─────────────────────────────────────────────────
// The base `api` wrapper does not support custom headers, so auth routes use
// a dedicated helper that injects the Bearer token.

const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;

interface ApiResponse<T> {
  data: T;
}

async function authRequest<T>(
  method: string,
  path: string,
  token: string,
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 204) {
    return null as unknown as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const json: ApiResponse<T> = await response.json();
    return (json.data ?? null) as T;
  }

  return null as unknown as T;
}

// Settings
export function useSettings(deviceId: string) {
  return useQuery({
    queryKey: ['settings', deviceId],
    queryFn: () => api.get<Settings>(`/api/settings/${deviceId}`),
    enabled: !!deviceId,
  });
}

export function useUpdateSettings(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Settings>) =>
      api.put<Settings>(`/api/settings/${deviceId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', deviceId] }),
  });
}

// Sessions
export function useActiveSession(deviceId: string) {
  return useQuery({
    queryKey: ['active-session', deviceId],
    queryFn: () => api.get<WorkSession | null>(`/api/sessions/${deviceId}/active`),
    enabled: !!deviceId,
    refetchInterval: 30000,
  });
}

export function useSessions(deviceId: string, month?: string) {
  return useQuery({
    queryKey: ['sessions', deviceId, month ?? 'all'],
    queryFn: () => {
      const params = month ? `?month=${month}` : '';
      return api.get<WorkSession[]>(`/api/sessions/${deviceId}${params}`);
    },
    enabled: !!deviceId,
    staleTime: 5 * 60 * 1000,   // 5 minutes — don't re-fetch if data is fresh
    gcTime: 60 * 60 * 1000,     // keep cached months in memory for 1 hour
  });
}

export function useStartWork(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { notes?: string; workplaceName?: string }) =>
      api.post<WorkSession>(`/api/sessions/${deviceId}`, body ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-session', deviceId] });
      qc.invalidateQueries({ queryKey: ['sessions', deviceId] });
      qc.invalidateQueries({ queryKey: ['stats', deviceId] });
    },
  });
}

export function useEndWork(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.put<WorkSession>(`/api/sessions/${deviceId}/${sessionId}`, {
        status: 'completed',
        endTime: new Date().toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-session', deviceId] });
      qc.invalidateQueries({ queryKey: ['sessions', deviceId] });
      qc.invalidateQueries({ queryKey: ['stats', deviceId] });
    },
  });
}

export function useDeleteSession(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, month }: { sessionId: string; month: string }) =>
      api.delete<void>(`/api/sessions/${deviceId}/${sessionId}`),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['sessions', deviceId, variables.month] });
      qc.invalidateQueries({ queryKey: ['stats', deviceId] });
    },
  });
}

export function useUpdateSession(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, body }: { sessionId: string; body: Partial<WorkSession> }) =>
      api.put<WorkSession>(`/api/sessions/${deviceId}/${sessionId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-session', deviceId] });
      qc.invalidateQueries({ queryKey: ['sessions', deviceId] });
      qc.invalidateQueries({ queryKey: ['stats', deviceId] });
    },
  });
}

export function useStartBreak(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post<WorkSession>(`/api/sessions/${deviceId}/${sessionId}/breaks`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-session', deviceId] });
      qc.invalidateQueries({ queryKey: ['sessions', deviceId] });
    },
  });
}

export function useEndBreak(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, breakId }: { sessionId: string; breakId: string }) =>
      api.put<WorkSession>(`/api/sessions/${deviceId}/${sessionId}/breaks/${breakId}`, {
        endTime: new Date().toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-session', deviceId] });
      qc.invalidateQueries({ queryKey: ['sessions', deviceId] });
    },
  });
}

export function useStats(deviceId: string, period: 'week' | 'month' | 'year', date?: string) {
  return useQuery({
    queryKey: ['stats', deviceId, period, date ?? 'today'],
    queryFn: () => {
      const params = date ? `?period=${period}&date=${date}` : `?period=${period}`;
      return api.get<Stats>(`/api/stats/${deviceId}${params}`);
    },
    enabled: !!deviceId,
  });
}

export function useCreateSession(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      date: string;
      startTime: string;
      endTime: string;
      sessionType?: 'shift' | 'sick' | 'vacation';
      notes?: string;
      breaks?: { startTime: string; endTime: string }[];
    }) => api.post<WorkSession>(`/api/sessions/${deviceId}`, body),
    onSuccess: (_, variables) => {
      const month = variables.date.slice(0, 7);
      qc.invalidateQueries({ queryKey: ['sessions', deviceId, month] });
      qc.invalidateQueries({ queryKey: ['stats', deviceId] });
    },
  });
}

export function useCreateDayRecord(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      date: string;
      sessionType: 'shift' | 'sick' | 'vacation';
      startTime?: string;
      endTime?: string;
      notes?: string;
    }) => api.post<WorkSession>(`/api/sessions/${deviceId}`, body),
    onSuccess: (_, variables) => {
      const month = variables.date.slice(0, 7);
      qc.invalidateQueries({ queryKey: ['sessions', deviceId, month] });
      qc.invalidateQueries({ queryKey: ['stats', deviceId] });
    },
  });
}

export interface EditSessionPayload {
  startTime: string;
  endTime: string;
  date?: string;
  notes?: string;
  breaks: Array<{ startTime: string; endTime: string }>;
}

export function useEditSession(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: EditSessionPayload }) =>
      api.patch<WorkSession>(`/api/sessions/${deviceId}/${sessionId}/edit`, data),
    onSuccess: (_, variables) => {
      const month = variables.data.date
        ? variables.data.date.slice(0, 7)
        : new Date().toISOString().slice(0, 7);
      qc.invalidateQueries({ queryKey: ['sessions', deviceId, month] });
      qc.invalidateQueries({ queryKey: ['stats', deviceId] });
    },
  });
}

// ─── Authenticated hooks (token-based, no deviceId in URL) ───────────────────

export function useAuthSessions(token: string, month?: string) {
  return useQuery({
    queryKey: ['user-sessions-v2', token, month ?? 'all'],
    queryFn: () => {
      const params = month ? `?month=${month}` : '';
      return authRequest<WorkSession[]>('GET', `/api/user/sessions${params}`, token);
    },
    enabled: !!token,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}

export function useAuthActiveSession(token: string) {
  return useQuery({
    queryKey: ['user-active-session-v2', token],
    queryFn: () => authRequest<WorkSession | null>('GET', '/api/user/sessions/active', token),
    enabled: !!token,
    refetchInterval: 30000,
  });
}

export function useAuthStartWork(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { notes?: string; workplaceName?: string }) =>
      authRequest<WorkSession>('POST', '/api/user/sessions', token, body ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-active-session-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-sessions-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-stats-v2', token] });
    },
  });
}

export function useAuthEndWork(token: string, sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authRequest<WorkSession>('PUT', `/api/user/sessions/${sessionId}`, token, {
        status: 'completed',
        endTime: new Date().toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-active-session-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-sessions-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-stats-v2', token] });
    },
  });
}

export function useAuthStartBreak(token: string, sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authRequest<WorkSession>('POST', `/api/user/sessions/${sessionId}/breaks`, token, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-active-session-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-sessions-v2', token] });
    },
  });
}

export function useAuthEndBreak(token: string, sessionId: string, breakId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authRequest<WorkSession>('PUT', `/api/user/sessions/${sessionId}/breaks/${breakId}`, token, {
        endTime: new Date().toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-active-session-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-sessions-v2', token] });
    },
  });
}

export function useAuthStats(token: string) {
  return useQuery({
    queryKey: ['user-stats-v2', token],
    queryFn: () => authRequest<Stats>('GET', '/api/user/stats', token),
    enabled: !!token,
  });
}

export function useAuthSettings(token: string) {
  return useQuery({
    queryKey: ['user-settings-v2', token],
    queryFn: () => authRequest<Settings>('GET', '/api/user/settings', token),
    enabled: !!token,
  });
}

export function useAuthUpdateSettings(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Settings>) =>
      authRequest<Settings>('PUT', '/api/user/settings', token, body as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-settings-v2', token] });
    },
  });
}

export function useAuthDeleteSession(token: string, sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authRequest<void>('DELETE', `/api/user/sessions/${sessionId}`, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-sessions-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-stats-v2', token] });
    },
  });
}

// Variant that accepts sessionId at mutate()-time (useful when sessionId is not known at hook init)
export function useAuthDeleteSessionById(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      authRequest<void>('DELETE', `/api/user/sessions/${sessionId}`, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-sessions-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-stats-v2', token] });
    },
  });
}

export function useAuthCreateSession(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      date: string;
      startTime: string;
      endTime: string;
      sessionType?: 'shift' | 'sick' | 'vacation';
      notes?: string;
      breaks?: { startTime: string; endTime: string }[];
    }) => authRequest<WorkSession>('POST', '/api/user/sessions', token, body as Record<string, unknown>),
    onSuccess: (_, variables) => {
      const month = variables.date.slice(0, 7);
      qc.invalidateQueries({ queryKey: ['user-sessions-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-stats-v2', token] });
      void month;
    },
  });
}

export function useAuthEditSession(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: EditSessionPayload }) =>
      authRequest<WorkSession>('PATCH', `/api/user/sessions/${sessionId}/edit`, token, data as unknown as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-sessions-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-active-session-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-stats-v2', token] });
    },
  });
}

export function useAuthCreateDayRecord(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      date: string;
      sessionType: 'shift' | 'sick' | 'vacation';
      startTime?: string;
      endTime?: string;
      notes?: string;
    }) => authRequest<WorkSession>('POST', '/api/user/sessions', token, body as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-sessions-v2', token] });
      qc.invalidateQueries({ queryKey: ['user-stats-v2', token] });
    },
  });
}

// ─── Smart hooks: use device routes for guests, auth routes for logged-in ────

export function useSmartSessions(opts: { deviceId: string; token: string; isGuest: boolean; month?: string }) {
  const guest = useSessions(opts.deviceId, opts.month);
  const auth = useAuthSessions(opts.token, opts.month);
  return opts.isGuest ? guest : auth;
}

export function useSmartActiveSession(opts: { deviceId: string; token: string; isGuest: boolean }) {
  const guest = useActiveSession(opts.deviceId);
  const auth = useAuthActiveSession(opts.token);
  return opts.isGuest ? guest : auth;
}

export function useSmartStats(opts: { deviceId: string; token: string; isGuest: boolean }) {
  const guest = useStats(opts.deviceId, 'week');
  const auth = useAuthStats(opts.token);
  return opts.isGuest ? guest : auth;
}

export function useSmartSettings(opts: { deviceId: string; token: string; isGuest: boolean }) {
  const guest = useSettings(opts.deviceId);
  const auth = useAuthSettings(opts.token);
  return opts.isGuest ? guest : auth;
}

export function useSmartUpdateSettings(opts: { deviceId: string; token: string; isGuest: boolean }) {
  const guest = useUpdateSettings(opts.deviceId);
  const auth = useAuthUpdateSettings(opts.token);
  return opts.isGuest ? guest : auth;
}

export function useSmartStartWork(opts: { deviceId: string; token: string; isGuest: boolean }) {
  const guest = useStartWork(opts.deviceId);
  const auth = useAuthStartWork(opts.token);
  return opts.isGuest ? guest : auth;
}

export function useSmartEndWork(opts: { deviceId: string; token: string; isGuest: boolean; sessionId: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (opts.isGuest) {
        return api.put<WorkSession>(`/api/sessions/${opts.deviceId}/${opts.sessionId}`, {
          status: 'completed',
          endTime: new Date().toISOString(),
        });
      }
      return authRequest<WorkSession>('PUT', `/api/user/sessions/${opts.sessionId}`, opts.token, {
        status: 'completed',
        endTime: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      if (opts.isGuest) {
        qc.invalidateQueries({ queryKey: ['active-session', opts.deviceId] });
        qc.invalidateQueries({ queryKey: ['sessions', opts.deviceId] });
        qc.invalidateQueries({ queryKey: ['stats', opts.deviceId] });
      } else {
        qc.invalidateQueries({ queryKey: ['user-active-session-v2', opts.token] });
        qc.invalidateQueries({ queryKey: ['user-sessions-v2', opts.token] });
        qc.invalidateQueries({ queryKey: ['user-stats-v2', opts.token] });
      }
    },
  });
}

export function useSmartStartBreak(opts: { deviceId: string; token: string; isGuest: boolean; sessionId: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (opts.isGuest) {
        return api.post<WorkSession>(`/api/sessions/${opts.deviceId}/${opts.sessionId}/breaks`, {});
      }
      return authRequest<WorkSession>('POST', `/api/user/sessions/${opts.sessionId}/breaks`, opts.token, {});
    },
    onSuccess: () => {
      if (opts.isGuest) {
        qc.invalidateQueries({ queryKey: ['active-session', opts.deviceId] });
        qc.invalidateQueries({ queryKey: ['sessions', opts.deviceId] });
      } else {
        qc.invalidateQueries({ queryKey: ['user-active-session-v2', opts.token] });
        qc.invalidateQueries({ queryKey: ['user-sessions-v2', opts.token] });
      }
    },
  });
}

export function useSmartEndBreak(opts: { deviceId: string; token: string; isGuest: boolean; sessionId: string; breakId: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (opts.isGuest) {
        return api.put<WorkSession>(`/api/sessions/${opts.deviceId}/${opts.sessionId}/breaks/${opts.breakId}`, {
          endTime: new Date().toISOString(),
        });
      }
      return authRequest<WorkSession>('PUT', `/api/user/sessions/${opts.sessionId}/breaks/${opts.breakId}`, opts.token, {
        endTime: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      if (opts.isGuest) {
        qc.invalidateQueries({ queryKey: ['active-session', opts.deviceId] });
        qc.invalidateQueries({ queryKey: ['sessions', opts.deviceId] });
      } else {
        qc.invalidateQueries({ queryKey: ['user-active-session-v2', opts.token] });
        qc.invalidateQueries({ queryKey: ['user-sessions-v2', opts.token] });
      }
    },
  });
}

export function useSmartDeleteSession(opts: { deviceId: string; token: string; isGuest: boolean }) {
  const guest = useDeleteSession(opts.deviceId);
  const auth = useAuthDeleteSessionById(opts.token);
  return opts.isGuest ? guest : auth;
}

export function useSmartCreateSession(opts: { deviceId: string; token: string; isGuest: boolean }) {
  const guest = useCreateSession(opts.deviceId);
  const auth = useAuthCreateSession(opts.token);
  return opts.isGuest ? guest : auth;
}

export function useSmartEditSession(opts: { deviceId: string; token: string; isGuest: boolean }) {
  const guest = useEditSession(opts.deviceId);
  const auth = useAuthEditSession(opts.token);
  return opts.isGuest ? guest : auth;
}

export function useSmartCreateDayRecord(opts: { deviceId: string; token: string; isGuest: boolean }) {
  const guest = useCreateDayRecord(opts.deviceId);
  const auth = useAuthCreateDayRecord(opts.token);
  return opts.isGuest ? guest : auth;
}
