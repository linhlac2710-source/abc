import api from './client';

// Submissions are handled under assignments endpoints. This module provides convenience helpers.
export const SubmissionsAPI = {
  submit: (assignmentId: number, payload: any) => api.post<any>(`/assignments/${assignmentId}/submit`, payload),
  getMy: (assignmentId: number) => api.get<any>(`/assignments/${assignmentId}/my-submission`),
  listForAssignment: (assignmentId: number) => api.get<any[]>(`/assignments/${assignmentId}/submissions`),
};

export default SubmissionsAPI;
