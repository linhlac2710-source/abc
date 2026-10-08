import React from 'react';
import { ScheduleItem } from '../../types';
import { ClassScheduleModule } from '../schedule/ClassScheduleModule';

interface LecturerScheduleProps {
  schedule: ScheduleItem[];
  onUpdateSchedule?: (updated: ScheduleItem[]) => void;
  onCreateSchedule?: (item: ScheduleItem) => Promise<void>;
  onUpdateScheduleItem?: (item: ScheduleItem) => Promise<void>;
  onDeleteSchedule?: (scheduleId: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
  onAttendance?: (item: ScheduleItem) => void;
  onGenerateCode?: (scheduleId: string) => void;
}

export const LecturerSchedule: React.FC<LecturerScheduleProps> = ({
  schedule,
  onUpdateSchedule,
  onCreateSchedule,
  onUpdateScheduleItem,
  onDeleteSchedule,
  loading,
  error,
  onAttendance,
}) => {
  return (
    <div className="space-y-6">
      {loading && <div className="text-xs text-slate-500">Refreshing schedules...</div>}
      {error && <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}
      <ClassScheduleModule
        schedule={schedule}
        currentRole="lecturer"
        onUpdateSchedule={onUpdateSchedule}
        onCreateSchedule={onCreateSchedule}
        onUpdateScheduleItem={onUpdateScheduleItem}
        onDeleteSchedule={onDeleteSchedule}
        onAttendance={onAttendance}
      />
    </div>
  );
};
