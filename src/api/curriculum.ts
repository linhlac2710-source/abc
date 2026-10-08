import api from './client';

export interface CurriculumSummary {
  course_count: number;
}

export const CurriculumAPI = {
  summary: () => api.get<CurriculumSummary>('/admin/curriculum'),
  uploadCsv: (csv: string) =>
    api.post<CurriculumSummary>('/admin/curriculum/upload', { csv }),
  uploadStudentCsv: (studentId: string, csv: string) =>
    api.put<CurriculumSummary>(`/admin/users/${encodeURIComponent(studentId)}/learning-path`, { csv }),
};

export default CurriculumAPI;
