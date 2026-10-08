import api from './client';

export interface AdminUserPayload {
  username?: string;
  email: string;
  full_name: string;
  role: 'student' | 'lecturer' | 'admin';
  password?: string;
  student_code?: string;
  major?: string;
  lecturer_code?: string;
  department?: string;
  learning_path_csv?: string;
}

export const UsersAPI = {
  list: () => api.get<any[]>('/users'),
  create: (payload: AdminUserPayload) =>
    api.post<any>('/users', { ...payload, role: payload.role.toUpperCase() }),
};
