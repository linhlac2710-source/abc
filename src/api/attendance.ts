import api from './client';

export interface AttendanceSessionResponse {
  id: number;
  class_id: number;
  start_time: string;
  expires_at: string;
  active: boolean;
  is_active: boolean;
  qr_token?: string | null;
  session_code?: string | null;
  attendance_method?: 'MANUAL' | 'QR';
  status?: 'UPCOMING' | 'ACTIVE' | 'LOCKED';
  lecturer_id?: number;
  lecturer_ip?: string;
  locked_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_meters: number;
  created_at?: string | null;
}

export interface AttendanceRecordResponse {
  id: number;
  session_id: number;
  student_id: number;
  student_code?: string | null;
  student_name?: string | null;
  check_in_time: string;
  status: string;
  is_anomaly?: boolean;
  anomaly_flag?: boolean;
  anomaly_score?: number;
  attendance_method?: 'MANUAL' | 'QR';
  attendance_time?: string;
  student_ip?: string;
  warning?: string | null;
}

export const AttendanceAPI = {
  createSession: (classId: number, payload: any) => api.post<any>(`/classes/${classId}/attendance/sessions`, payload),
  createQrSession: (classId: number, payload: { title: string; start_time: string; expires_at: string; room?: string }) =>
    api.post<AttendanceSessionResponse>(`/classes/${classId}/attendance/qr-sessions`, payload),
  listClassSessions: (classId: number) =>
    api.get<AttendanceSessionResponse[]>(`/classes/${classId}/attendance/sessions`),
  listStudentSessions: () =>
    api.get<AttendanceSessionResponse[]>('/attendance/student/sessions'),
  closeSession: (sessionId: number) => api.patch<any>(`/attendance/sessions/${sessionId}/close`),
  checkIn: (sessionId: number, payload: any) => api.post<any>(`/attendance/sessions/${sessionId}/check-in`, payload),
  qrCheckIn: (sessionId: number) =>
    api.post<AttendanceRecordResponse>(`/attendance/sessions/${sessionId}/check-in`, {}),
  lockSession: (sessionId: number) => api.post<AttendanceSessionResponse>(`/attendance/sessions/${sessionId}/lock`, {}),
  getSessionRecords: (sessionId: number) =>
    api.get<AttendanceRecordResponse[]>(`/attendance/sessions/${sessionId}/records`),
  setManualStatus: (sessionId: number, studentRef: string, status: string) =>
    api.put<AttendanceRecordResponse>(
      `/attendance/sessions/${sessionId}/records/${encodeURIComponent(studentRef)}`,
      { status }
    ),
  markAllPresent: (sessionId: number) =>
    api.post<AttendanceRecordResponse[]>(`/attendance/sessions/${sessionId}/mark-all-present`),
  deleteSession: (sessionId: number) =>
    api.del<void>(`/attendance/sessions/${sessionId}`),
  getClassHistory: (classId: number) => api.get<any[]>(`/classes/${classId}/attendance`),
  myAttendance: () => api.get<any[]>('/attendance/my'),
};

export default AttendanceAPI;
