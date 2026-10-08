import api from './client';

export interface LecturerAccount {
  id: number;
  username: string;
  full_name: string;
  email: string;
}

export const ClassesAPI = {
  list: (query?: Record<string, any>) => api.get<any[]>('/classes', query),
  listLecturerAccounts: () => api.get<LecturerAccount[]>('/classes/lecturers'),
  create: (payload: any) => api.post<any>('/classes', payload),
  delete: (classId: number) => api.del<void>(`/classes/${classId}`),
  join: (payload: { class_code: string }) => api.post<any>('/classes/join', payload),
  detail: (classId: number) => api.get<any>(`/classes/${classId}`),
  update: (classId: number, payload: any) => api.put<any>(`/classes/${classId}`, payload),
  patch: (classId: number, payload: any) => api.patch<any>(`/classes/${classId}`, payload),
  updateStatus: (classId: number, payload: any) => api.patch<any>(`/classes/${classId}/status`, payload),
  getEnrollments: (classId: number) => api.get<any[]>(`/classes/${classId}/enrollments`),
  unenroll: (classId: number) => api.post<any>(`/classes/${classId}/unenroll`),
};

export default ClassesAPI;
