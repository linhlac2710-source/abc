import api from './client';

export const SchedulesAPI = {
  createForClass: (classId: number, payload: any) => api.post<any>(`/classes/${classId}/schedules`, payload),
  getClassSchedules: (classId: number) => api.get<any[]>(`/classes/${classId}/schedules`),
  mySchedules: () => api.get<any[]>('/schedules/my'),
  updateSchedule: (scheduleId: number, payload: any) => api.put<any>(`/schedules/${scheduleId}`, payload),
  patchSchedule: (scheduleId: number, payload: any) => api.patch<any>(`/schedules/${scheduleId}`, payload),
  deleteSchedule: (scheduleId: number) => api.del<any>(`/schedules/${scheduleId}`),
};

export default SchedulesAPI;
