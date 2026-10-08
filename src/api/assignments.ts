import api from './client';

export const AssignmentsAPI = {
  create: (classId: number, payload: any) => api.post<any>(`/classes/${classId}/assignments`, payload),
  listForClass: (classId: number) => api.get<any[]>(`/classes/${classId}/assignments`),
  get: (assignmentId: number) => api.get<any>(`/assignments/${assignmentId}`),
  update: (assignmentId: number, payload: any) => api.put<any>(`/assignments/${assignmentId}`, payload),
  patch: (assignmentId: number, payload: any) => api.patch<any>(`/assignments/${assignmentId}`, payload),
  delete: (assignmentId: number) => api.del<any>(`/assignments/${assignmentId}`),
  submit: (assignmentId: number, payload: any) => api.post<any>(`/assignments/${assignmentId}/submit`, payload),
  mySubmission: (assignmentId: number) => api.get<any>(`/assignments/${assignmentId}/my-submission`),
  submissions: (assignmentId: number) => api.get<any[]>(`/assignments/${assignmentId}/submissions`),
  gradeSubmission: (submissionId: number, score: number, feedback?: string) =>
    api.patch<any>(`/submissions/${submissionId}/grade`, { score, feedback }),
};

export default AssignmentsAPI;
