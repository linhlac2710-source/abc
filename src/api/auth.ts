import api from './client';

export interface LoginPayload {
  username: string;
  password?: string;
  role?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer' | string;
}

export const AuthAPI = {
  login: (payload: LoginPayload) => api.post<TokenResponse>('/auth/login', payload),
  register: (payload: any) => api.post<any>('/auth/register', payload),
  me: () => api.get<any>('/auth/me'),
  changePassword: (payload: { current_password: string; new_password: string }) =>
    api.post<void>('/auth/change-password', payload),
  adminTest: () => api.get<any>('/auth/admin-test'),
  lecturerTest: () => api.get<any>('/auth/lecturer-test'),
  studentTest: () => api.get<any>('/auth/student-test'),
};

export default AuthAPI;
