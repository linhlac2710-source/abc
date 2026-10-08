import api from './client';

export const EnrollmentsAPI = {
  my: () => api.get<any[]>('/enrollments/my'),
  approve: (enrollmentId: number) => api.patch<any>(`/enrollments/${enrollmentId}/approve`),
  reject: (enrollmentId: number) => api.patch<any>(`/enrollments/${enrollmentId}/reject`),
  cancel: (enrollmentId: number) => api.patch<any>(`/enrollments/${enrollmentId}/cancel`),
  delete: (enrollmentId: number) => api.del<any>(`/enrollments/${enrollmentId}`),
};

export default EnrollmentsAPI;
