import { AuthUser, useAuthStore } from '@/lib/state/auth-store';

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface MeResponse extends AuthUser {
  createdAt: string;
}

const _authBaseUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
if (!_authBaseUrl) {
  throw new Error('EXPO_PUBLIC_BACKEND_URL is not set. Check your .env file.');
}
const baseUrl: string = _authBaseUrl;

async function authPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message ?? json?.message ?? 'שגיאה בלתי צפויה';
    throw new Error(message);
  }
  // Unwrap { data: T } envelope (all app routes return { data: ... })
  return (json?.data ?? json) as T;
}

export const register = (email: string, password: string, username?: string): Promise<AuthResponse> =>
  authPost<AuthResponse>('/api/auth/register', {
    email,
    password,
    ...(username ? { username } : {}),
    platform: 'mobile',
  });

export const login = (identifier: string, password: string): Promise<AuthResponse> =>
  authPost<AuthResponse>('/api/auth/login', { identifier, password });

export const logout = async (): Promise<{ success: true }> => {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await response.json();
  return json as { success: true };
};

export const getMe = async (token: string): Promise<MeResponse> => {
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message ?? json?.message ?? 'שגיאה בטעינת המשתמש';
    throw new Error(message);
  }
  // Unwrap { data: T } envelope
  return (json?.data ?? json) as MeResponse;
};

export const forgotPassword = (email: string): Promise<{ success: boolean; message: string; resetToken?: string }> =>
  authPost('/api/auth/forgot-password', { email });

export const resetPassword = (token: string, newPassword: string): Promise<{ success: boolean }> =>
  authPost('/api/auth/reset-password', { token, newPassword });

export const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean }> => {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message ?? json?.message ?? 'שגיאה בשינוי סיסמה';
    throw new Error(message);
  }
  // Unwrap { data: T } envelope
  return (json?.data ?? json) as { success: boolean };
};

export interface Session {
  id: string;
  deviceName: string | null;
  platform: string | null;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
}

async function authRequest<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message ?? json?.message ?? 'שגיאה בלתי צפויה';
    throw new Error(message);
  }
  return (json?.data ?? json) as T;
}

export const updateProfile = (data: { username?: string; email?: string }): Promise<AuthUser> =>
  authRequest<AuthUser>('PUT', '/api/auth/profile', data);

export const deleteAccount = (password: string): Promise<void> =>
  authRequest<void>('DELETE', '/api/auth/account', { password });

export const getActiveSessions = (): Promise<Session[]> =>
  authRequest<Session[]>('GET', '/api/auth/sessions');

export const revokeSession = (sessionId: string): Promise<void> =>
  authRequest<void>('DELETE', `/api/auth/sessions/${sessionId}`);

export const syncUserSettings = (settings: Record<string, unknown>): Promise<{ success: boolean }> =>
  authRequest<{ success: boolean }>('PUT', '/api/auth/user-settings', settings);
