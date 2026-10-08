import api from './client';

export interface ClassAssignmentRequest {
  id: number;
  class_id: number;
  lecturer_user_id: number;
  status: 'pending' | 'approved' | 'rejected';
  title: string;
  message: string;
  created_at: string;
  responded_at: string | null;
  class_code: string;
  class_name: string;
}

export const NotificationsAPI = {
  listClassAssignments: () => api.get<ClassAssignmentRequest[]>('/notifications'),
  approveClassAssignment: (requestId: number) =>
    api.patch(`/notifications/${requestId}/approve`),
  rejectClassAssignment: (requestId: number) =>
    api.patch<void>(`/notifications/${requestId}/reject`),
};
