import { api } from './api';

const ORIGIN_HEADERS = {}; // o navegador envia Origin automaticamente em POST

export const signIn = (email: string, password: string) =>
  api('/api/auth/sign-in/email', {
    method: 'POST',
    json: { email, password },
    headers: ORIGIN_HEADERS,
  });
export const signOut = () => api('/api/auth/sign-out', { method: 'POST', json: {} });
export const requestReset = (email: string) =>
  api('/api/auth/request-password-reset', {
    method: 'POST',
    json: { email, redirectTo: '/redefinir-senha' },
  });
export const resetPassword = (token: string, newPassword: string) =>
  api('/api/auth/reset-password', { method: 'POST', json: { token, newPassword } });

export interface MeMembership {
  organizationId: string;
  organizationName: string;
  timezone: string;
  isDemo: boolean;
  role: 'ADMIN' | 'ATTENDANT' | 'TECHNICIAN';
}
export interface Me {
  user: { id: string; email: string; name: string };
  memberships: MeMembership[];
}
export const getMe = () => api<Me>('/api/v1/me');
