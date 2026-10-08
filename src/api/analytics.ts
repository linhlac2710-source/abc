import api from './client';
import { StudentRiskResponse, StudentLearningPathResponse, LearningRecommendationItemSimple } from '../types';

export const AnalyticsAPI = {
  myRisk: (classId: number) => api.get<StudentRiskResponse>(`/analytics/my-risk/${classId}`),
  classRisk: (classId: number) => api.get<StudentRiskResponse[]>(`/classes/${classId}/analytics/risk`),
  lecturerStudentRisk: (classId: number, studentId: number) => api.get<StudentRiskResponse>(`/classes/${classId}/analytics/risk/${studentId}`),
  myLearningPath: (classId?: number) =>
    api.get<StudentLearningPathResponse>(
      classId === undefined ? '/analytics/my-learning-path' : `/analytics/my-learning-path/${classId}`
    ),
  updateMyLearningRecommendation: (classId: number, recommendationId: number, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') =>
    api.patch<LearningRecommendationItemSimple>(`/analytics/my-learning-path/${classId}/recommendations/${recommendationId}`, { status }),
  classLearningPaths: (classId: number) => api.get<StudentLearningPathResponse[]>(`/classes/${classId}/analytics/learning-path`),
  lecturerStudentLearningPath: (classId: number, studentId: number) => api.get<StudentLearningPathResponse>(`/classes/${classId}/analytics/learning-path/${studentId}`),
};

export default AnalyticsAPI;
