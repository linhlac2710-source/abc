import React from 'react';
import { ScheduleItem } from '../../types';
import { ClassScheduleModule } from '../schedule/ClassScheduleModule';

interface StudentScheduleProps {
  schedule: ScheduleItem[];
  onCheckIn?: (scheduleId: string, code: string) => boolean | Promise<boolean>;
  onUpdateSchedule?: (updated: ScheduleItem[]) => void;
}

export const StudentSchedule: React.FC<StudentScheduleProps> = ({
  schedule,
  onCheckIn,
  onUpdateSchedule,
}) => {
  return (
    <ClassScheduleModule
      schedule={schedule}
      currentRole="student"
      onCheckIn={onCheckIn}
      onUpdateSchedule={onUpdateSchedule}
    />
  );
};
