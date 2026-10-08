import api from './client';

export interface TeachingQualityAnalytics {
  class_id: number;
  class_name: string;
  overview: {
    total_students: number;
    active_students: number;
    total_assignments: number;
    total_quizzes: number;
    total_attendance_sessions: number;
    average_grade?: number | null;
    attendance_rate?: number | null;
    assignment_completion_rate?: number | null;
    quiz_average?: number | null;
  };
  assignments: { total_submissions: number; assignment_completion_rate: number; overdue_missing_count: number; per_assignment: Array<{ assignment_id: number; title: string; submitted_count: number; missing_count: number; completion_rate: number }> };
  grades: { average_grade?: number | null; minimum_grade?: number | null; maximum_grade?: number | null; graded_student_count: number; grade_distribution: Array<{ category: string; student_count: number; percentage: number }> };
  attendance: { total_sessions: number; total_records: number; present_count: number; absent_count: number; attendance_rate: number; absence_rate: number };
  quizzes: { total_quizzes: number; total_results: number; average_percentage?: number | null; per_quiz: Array<{ quiz_id?: number | null; title: string; total_attempts: number; average_percentage: number }> };
  risks: {
    total_evaluated: number;
    low_risk_count: number;
    medium_risk_count: number;
    high_risk_count: number;
    low_risk_percentage: number;
    medium_risk_percentage: number;
    high_risk_percentage: number;
    students: Array<{
      student_id: number;
      student_code?: string | null;
      student_name?: string | null;
      risk_score: number;
      risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
      attendance_rate: number | null;
      assignment_submission_rate: number | null;
      average_grade: number | null;
      missing_assignment_count: number;
      absence_count: number;
      reasons: string[];
    }>;
  };
  recommendations: { total_recommendations: number; high_priority_count: number; medium_priority_count: number; low_priority_count: number };
  insights: string[];
  generated_at: string;
}

export const TeachingAnalyticsAPI = {
  teachingQuality: (classId: number) => api.get<TeachingQualityAnalytics>(`/classes/${classId}/analytics/teaching-quality`),
  assignments: (classId: number) => api.get<any>(`/classes/${classId}/analytics/teaching-quality/assignments`),
  grades: (classId: number) => api.get<any>(`/classes/${classId}/analytics/teaching-quality/grades`),
  attendance: (classId: number) => api.get<any>(`/classes/${classId}/analytics/teaching-quality/attendance`),
  quizzes: (classId: number) => api.get<any>(`/classes/${classId}/analytics/teaching-quality/quizzes`),
  risks: (classId: number) => api.get<any>(`/classes/${classId}/analytics/teaching-quality/risks`),
};

export default TeachingAnalyticsAPI;
