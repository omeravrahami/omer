import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/api';
import type { Settings, WorkSession, Stats } from '@/lib/types';

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
    mutationFn: (sessionId: string) =>
      api.delete<void>(`/api/sessions/${deviceId}/${sessionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', deviceId] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', deviceId] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', deviceId] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', deviceId] });
      qc.invalidateQueries({ queryKey: ['stats', deviceId] });
    },
  });
}
