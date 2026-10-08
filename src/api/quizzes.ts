import api from './client';

export interface QuizRecord {
  id: number;
  class_id: number;
  title: string;
  description?: string | null;
  total_points: number;
  available_from?: string | null;
  due_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuizResultRecord {
  id: number;
  quiz_id?: number | null;
  class_id: number;
  student_id: number;
  student_code?: string | null;
  student_name?: string | null;
  topic: string;
  score: number;
  max_score: number;
  percentage: number;
  attempt_number: number;
  created_at: string;
}

export const QuizzesAPI = {
  create: (classId: number, payload: { title: string; description?: string; total_points: number; available_from?: string; due_at?: string; is_active: boolean }) =>
    api.post<QuizRecord>(`/classes/${classId}/quizzes`, payload),
  listForClass: (classId: number) => api.get<QuizRecord[]>(`/classes/${classId}/quizzes`),
  get: (quizId: number) => api.get<QuizRecord>(`/quizzes/${quizId}`),
  update: (quizId: number, payload: Partial<Omit<QuizRecord, 'id' | 'class_id' | 'created_at' | 'updated_at'>>) =>
    api.put<QuizRecord>(`/quizzes/${quizId}`, payload),
  patch: (quizId: number, payload: Partial<Omit<QuizRecord, 'id' | 'class_id' | 'created_at' | 'updated_at'>>) =>
    api.patch<QuizRecord>(`/quizzes/${quizId}`, payload),
  delete: (quizId: number) => api.del<QuizRecord>(`/quizzes/${quizId}`),
  submitResult: (quizId: number, payload: any) => api.post<any>(`/quizzes/${quizId}/results`, payload),
  myResult: (quizId: number) => api.get<any>(`/quizzes/${quizId}/results/my`),
  listResults: (quizId: number) => api.get<QuizResultRecord[]>(`/quizzes/${quizId}/results`),
  myClassResults: (classId: number) => api.get<any[]>(`/classes/${classId}/quizzes/results/my`),
};

export default QuizzesAPI;
