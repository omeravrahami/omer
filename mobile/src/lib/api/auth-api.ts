import { api } from './api';

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

export interface MeResponse {
  id: string;
  email: string;
  createdAt: string;
}

export const register = (email: string, password: string) =>
  api.post<AuthResponse>('/api/auth/register', { email, password });

export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/api/auth/login', { email, password });

export const logout = (token: string) =>
  api.post<{ success: boolean }>('/api/auth/logout', { token });

export const getMe = async (token: string): Promise<MeResponse> => {
  const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const json = await response.json();
  return json.data as MeResponse;
};
