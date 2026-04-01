import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';
import type { Settings, WorkSession, Stats } from '@/lib/types';

// ─── Authenticated API helper ─────────────────────────────────────────────────
// The base `api` wrapper does not support custom headers, so auth routes use
// a dedicated helper that injects the Bearer token.

const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;

interface ApiResponse<T> {
  data: T;
}

const AUTH_REQUEST_TIMEOUT_MS = 20_000;

async function authRequest<T>(
  method: string,
  path: string,
  token: string,
  body?: Record<string, unknown>
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
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
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('הבקשה נכשלה: תם הזמן הקצוב. בדוק את החיבור לאינטרנט.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Authenticated hooks ──────────────────────────────────────────────────────

export interface EditSessionPayload {
  startTime: string;
  endTime: string;
  date?: string;
  notes?: string;
  breaks: Array<{ startTime: string; endTime: string }>;
}

export interface SessionsResponse {
  sessions: WorkSession[];
  isDataRestricted: boolean;
}

// Returns just the sessions array (backward-compatible); isDataRestricted is in the raw query below.
export function useAuthSessions(token: string, month?: string) {
  return useQuery({
    queryKey: ['user-sessions-v2', token, month ?? 'all'],
    queryFn: async () => {
      const params = month ? `?month=${month}` : '';
      const result = await authRequest<SessionsResponse | WorkSession[]>('GET', `/api/user/sessions${params}`, token);
      // Unwrap to plain array so all existing callers keep working
      if (Array.isArray(result)) return result;
      return result?.sessions ?? [];
    },
    enabled: !!token,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}

// Returns the full { sessions, isDataRestricted } shape for components that need it.
export function useAuthSessionsData(token: string, month?: string) {
  return useQuery({
    queryKey: ['user-sessions-full-v2', token, month ?? 'all'],
    queryFn: async () => {
      const params = month ? `?month=${month}` : '';
      const result = await authRequest<SessionsResponse | WorkSession[]>('GET', `/api/user/sessions${params}`, token);
      if (Array.isArray(result)) return { sessions: result, isDataRestricted: false } as SessionsResponse;
      return (result ?? { sessions: [], isDataRestricted: false }) as SessionsResponse;
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
    refetchInterval: 15000, // 15s for reliable multi-device sync
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

export function useAuthStats(token: string, period: 'week' | 'month' | 'year' = 'month') {
  return useQuery({
    queryKey: ['user-stats-v2', token, period],
    queryFn: () => authRequest<Stats>('GET', `/api/user/stats?period=${period}`, token),
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

// ─── Subscription hooks ───────────────────────────────────────────────────────

export interface SubscriptionStatus {
  isPremium: boolean;
  subscriptionStatus: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  planType: string;
}

export interface SubscriptionConfig {
  premium_price_monthly: string;
  premium_enabled: string;
  retention_months_free: string;
  ads_enabled: string;
}

export function useSubscriptionStatus(token: string | null) {
  return useQuery({
    queryKey: ['subscription', 'status', token],
    queryFn: () => authRequest<SubscriptionStatus>('GET', '/api/subscription/status', token!),
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useSubscriptionConfig() {
  return useQuery({
    queryKey: ['subscription', 'config'],
    queryFn: async () => {
      const response = await fetch(`${baseUrl}/api/subscription/config`);
      const json = await response.json() as { data: SubscriptionConfig };
      return json.data;
    },
    staleTime: 10 * 60 * 1000, // 10 min
  });
}
