import React, { useEffect, useState } from 'react';
import { SchedulesAPI } from '../../api/schedules';
import api from '../../api/client';
import { ScheduleItem } from '../../types';

interface Props {
  classId: string;
}

export const ClassSchedulesForClass: React.FC<Props> = ({ classId }) => {
  const [schedules, setSchedules] = useState<ScheduleItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await SchedulesAPI.getClassSchedules(Number(classId));
        if (!mounted) return;
        setSchedules(res || []);
      } catch (err: any) {
        if (err instanceof api.ApiError) setError(err.message || 'Failed to load schedules');
        else setError(err?.message || String(err) || 'Failed to load schedules');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [classId]);

  if (loading) return <div className="text-xs text-slate-600">Loading schedules...</div>;
  if (error) return <div className="text-xs text-rose-700">{error}</div>;
  if (!schedules || schedules.length === 0) return <div className="text-xs text-slate-500">No schedule entries found for this class.</div>;

  return (
    <div className="space-y-2 text-xs">
      {schedules.map((s) => (
        <div key={s.id} className="p-2 bg-slate-50 rounded border border-slate-100">
          <div className="font-semibold text-slate-800">{s.courseTitle || s.courseCode}</div>
          <div className="text-slate-600 text-[12px]">
            {s.dayOfWeek || s.date} ⬢ {s.startTime} - {s.endTime} ⬢ {s.room} ⬢ {s.lecturerName}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClassSchedulesForClass;
