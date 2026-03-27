import { AuthUser, useAuthStore } from '@/lib/state/auth-store';

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface MeResponse extends AuthUser {
  createdAt: string;
}

const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;

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
