import api from './client';

export interface GradeRecord {
  id: number;
  class_id: number;
  student_id: number;
  student_code?: string | null;
  student_name?: string | null;
  component: string;
  score: number;
  weight: number;
  created_at: string;
  updated_at?: string | null;
}

export interface ClassStudentResult {
  student_id: number;
  student_code: string;
  student_name: string;
  grades: Array<{ id: number; component: string; score: number; weight: number; created_at: string }>;
  total_weight: number;
  aggregate_score: number;
  is_complete: boolean;
}

export const GradesAPI = {
  create: (classId: number, payload: { student_id: number; component: string; score: number; weight: number }) =>
    api.post<GradeRecord>(`/classes/${classId}/grades`, payload),
  listForClass: (classId: number) => api.get<GradeRecord[]>(`/classes/${classId}/grades`),
  myClassGrades: (classId: number) => api.get<any>(`/classes/${classId}/grades/my`),
  classResults: (classId: number) => api.get<ClassStudentResult[]>(`/classes/${classId}/results`),
  update: (gradeId: number, payload: { score?: number; weight?: number }) =>
    api.put<GradeRecord>(`/grades/${gradeId}`, payload),
  patch: (gradeId: number, payload: { score?: number; weight?: number }) =>
    api.patch<GradeRecord>(`/grades/${gradeId}`, payload),
  delete: (gradeId: number) => api.del<GradeRecord>(`/grades/${gradeId}`),
};

export default GradesAPI;
