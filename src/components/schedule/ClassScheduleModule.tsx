import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Building2,
  Sparkles,
  Search,
  X,
  QrCode,
  Info,
  ShieldAlert,
  Wrench,
  BookOpen,
  Ban,
} from 'lucide-react';
import { ScheduleItem, ScheduleConflict, Role } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import {
  detectScheduleConflicts,
  getConflictsForItem,
  timeToMinutes,
} from '../../utils/scheduleConflictDetector';

interface ClassScheduleModuleProps {
  schedule: ScheduleItem[];
  currentRole?: Role;
  onUpdateSchedule?: (updatedSchedule: ScheduleItem[]) => void;
  onCreateSchedule?: (item: ScheduleItem) => Promise<void>;
  onUpdateScheduleItem?: (item: ScheduleItem) => Promise<void>;
  onDeleteSchedule?: (scheduleId: string) => Promise<void>;
  onCheckIn?: (scheduleId: string, code: string) => boolean | Promise<boolean>;
  onAttendance?: (item: ScheduleItem) => void;
}

export const ClassScheduleModule: React.FC<ClassScheduleModuleProps> = ({
  schedule: initialScheduleData,
  currentRole = 'student',
  onUpdateSchedule,
  onCreateSchedule,
  onUpdateScheduleItem,
  onDeleteSchedule,
  onCheckIn,
  onAttendance,
}) => {
  const today = new Date();
  const todayDateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  // Internal state for schedule items if parent doesn't persist updates
  const [scheduleList, setScheduleList] = useState<ScheduleItem[]>(initialScheduleData);

  // Keep internal state synchronized if prop changes
  React.useEffect(() => {
    setScheduleList(initialScheduleData);
  }, [initialScheduleData]);

  const updateSchedule = (newItems: ScheduleItem[]) => {
    setScheduleList(newItems);
    if (onUpdateSchedule) {
      onUpdateSchedule(newItems);
    }
  };

  // View state: 'weekly' | 'monthly' | 'timeline'
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');

  // Week navigation starts on the current Monday.
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);

  // Month navigation state
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayDateStr);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedLecturer, setSelectedLecturer] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [selectedConflictDetail, setSelectedConflictDetail] = useState<ScheduleConflict | null>(null);
  const [activeCheckInItem, setActiveCheckInItem] = useState<ScheduleItem | null>(null);
  const [inputCheckInCode, setInputCheckInCode] = useState('');
  const [checkInMsg, setCheckInMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Session Form State
  const [formData, setFormData] = useState({
    courseCode: '',
    courseTitle: '',
    subject: '',
    lecturerName: '',
    room: '',
    building: '',
    date: new Date().toISOString().slice(0, 10),
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    type: 'Lecture' as ScheduleItem['type'],
    sessionTopic: '',
  });

  // Calculate Conflicts across all sessions
  const allConflicts = useMemo(() => {
    return detectScheduleConflicts(scheduleList);
  }, [scheduleList]);

  // Distinct conflict counts
  const roomConflictCount = useMemo(() => {
    return allConflicts.filter((c) => c.type === 'room' || c.type === 'both').length;
  }, [allConflicts]);

  const lecturerConflictCount = useMemo(() => {
    return allConflicts.filter((c) => c.type === 'lecturer' || c.type === 'both').length;
  }, [allConflicts]);

  // Unique Subjects, Lecturers, Rooms for filter menus
  const subjects = useMemo(() => {
    const set = new Set<string>();
    scheduleList.forEach((s) => {
      if (s.subject) set.add(s.subject);
    });
    return Array.from(set).sort();
  }, [scheduleList]);

  const lecturers = useMemo(() => {
    const set = new Set<string>();
    scheduleList.forEach((s) => {
      if (s.lecturerName) set.add(s.lecturerName);
    });
    return Array.from(set).sort();
  }, [scheduleList]);

  const rooms = useMemo(() => {
    const set = new Set<string>();
    scheduleList.forEach((s) => {
      if (s.room) set.add(s.room);
    });
    return Array.from(set).sort();
  }, [scheduleList]);

  // Filtered Sessions
  const filteredSchedule = useMemo(() => {
    return scheduleList.filter((item) => {
      // Search text filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQuery =
          item.courseCode.toLowerCase().includes(query) ||
          item.courseTitle.toLowerCase().includes(query) ||
          (item.subject && item.subject.toLowerCase().includes(query)) ||
          item.lecturerName.toLowerCase().includes(query) ||
          item.room.toLowerCase().includes(query) ||
          item.sessionTopic.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      // Subject filter
      if (selectedSubject !== 'all' && item.subject !== selectedSubject) {
        return false;
      }

      // Lecturer filter
      if (selectedLecturer !== 'all' && item.lecturerName !== selectedLecturer) {
        return false;
      }

      // Room filter
      if (selectedRoom !== 'all' && item.room !== selectedRoom) {
        return false;
      }

      return true;
    });
  }, [scheduleList, searchQuery, selectedSubject, selectedLecturer, selectedRoom]);

  // Days of the active week, anchored to the current week's Monday.
  const currentWeekDays = useMemo(() => {
    const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysSinceMonday = (baseDate.getDay() + 6) % 7;
    baseDate.setDate(baseDate.getDate() - daysSinceMonday);
    baseDate.setDate(baseDate.getDate() + currentWeekOffset * 7);

    const days = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayName = dayNames[i];

      days.push({
        name: dayName,
        dateStr,
        displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayNum: d.getDate(),
        isCurrentDay: dateStr === todayDateStr,
      });
    }

    return days;
  }, [currentWeekOffset, todayDateStr]);

  // Current Week Range Title
  const currentWeekLabel = useMemo(() => {
    if (currentWeekDays.length === 0) return '';
    const first = currentWeekDays[0];
    const last = currentWeekDays[currentWeekDays.length - 1];
    const yearLabel = first.dateStr.slice(0, 4) === last.dateStr.slice(0, 4)
      ? last.dateStr.slice(0, 4)
      : `${first.dateStr.slice(0, 4)}–${last.dateStr.slice(0, 4)}`;
    return `${first.displayDate} – ${last.displayDate}, ${yearLabel}`;
  }, [currentWeekDays]);

  // Month grid computation for selectedYear & selectedMonth
  const monthData = useMemo(() => {
    const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...
    // Adjust to Monday-first (0 = Mon, 6 = Sun)
    const startOffset = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    const calendarCells = [];

    // Leading days from previous month
    const prevMonthDays = new Date(selectedYear, selectedMonth, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      calendarCells.push({
        dayNum,
        isCurrentMonth: false,
        dateStr: '',
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(selectedMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${selectedYear}-${mm}-${dd}`;
      calendarCells.push({
        dayNum: d,
        isCurrentMonth: true,
        dateStr,
      });
    }

    // Trailing days to fill 35 or 42 grid cells
    const remaining = 35 - (calendarCells.length % 35);
    if (remaining < 35 && remaining > 0) {
      for (let i = 1; i <= remaining; i++) {
        calendarCells.push({
          dayNum: i,
          isCurrentMonth: false,
          dateStr: '',
        });
      }
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return {
      monthName: monthNames[selectedMonth],
      year: selectedYear,
      cells: calendarCells,
    };
  }, [selectedYear, selectedMonth]);

  // Helper to accurately derive Day of Week from YYYY-MM-DD
  const getDayOfWeekFromDate = (
    dateStr: string
  ): 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday' => {
    if (!dateStr) return 'Monday';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const dayNames: ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday')[] = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      return dayNames[d.getDay()] || 'Monday';
    }
    return 'Monday';
  };

  const occursOnDate = (item: ScheduleItem, dateStr: string, dayName: string) => {
    if (item.date) return item.date === dateStr;
    if (!item.dayOfWeek || item.dayOfWeek.toLowerCase() !== dayName.toLowerCase()) return false;
    if (!item.classStartDate || !item.classDurationWeeks) return true;
    const start = new Date(`${item.classStartDate}T00:00:00`);
    const date = new Date(`${dateStr}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + item.classDurationWeeks * 7);
    return date >= start && date < end;
  };

  const autoSelectedUpcomingWeek = React.useRef(false);
  React.useEffect(() => {
    if (autoSelectedUpcomingWeek.current || scheduleList.length === 0) return;
    autoSelectedUpcomingWeek.current = true;

    const hasSessionThisWeek = currentWeekDays.some((day) =>
      scheduleList.some((item) => occursOnDate(item, day.dateStr, day.name))
    );
    if (hasSessionThisWeek) return;

    const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));
    for (let offset = 1; offset <= 52; offset++) {
      const weekStart = new Date(currentMonday);
      weekStart.setDate(weekStart.getDate() + offset * 7);
      const hasUpcomingSession = scheduleList.some((item) =>
        Array.from({ length: 7 }, (_, dayOffset) => {
          const date = new Date(weekStart);
          date.setDate(date.getDate() + dayOffset);
          const dateStr = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'),
          ].join('-');
          return occursOnDate(item, dateStr, date.toLocaleDateString('en-US', { weekday: 'long' }));
        }).some(Boolean)
      );
      if (hasUpcomingSession) {
        setCurrentWeekOffset(offset);
        return;
      }
    }
  }, [currentWeekDays, scheduleList]);

  // Real-time conflict preview for Add Session Modal
  const newSessionConflictPreview = useMemo(() => {
    if (!isAddModalOpen) return [];
    const computedDay = getDayOfWeekFromDate(formData.date);
    const testSession: ScheduleItem = {
      id: 'sch_temp_test',
      ...formData,
      dayOfWeek: computedDay,
      status: 'upcoming',
    };
    return detectScheduleConflicts([...scheduleList, testSession]).filter(
      (c) => c.sessionA.id === 'sch_temp_test' || c.sessionB.id === 'sch_temp_test'
    );
  }, [isAddModalOpen, formData, scheduleList]);

  // Move each conflicting second session after the actual overlap, preserving its duration.
  const handleQuickResolve = (selectedConflict?: ScheduleConflict | null) => {
    const conflicts = selectedConflict ? [selectedConflict] : allConflicts;
    const updatedById = new Map(scheduleList.map((item) => [item.id, item]));

    conflicts.forEach((conflict) => {
      const target = updatedById.get(conflict.sessionB.id);
      if (!target) return;

      const duration = Math.max(0, timeToMinutes(target.endTime) - timeToMinutes(target.startTime));
      const nextStart = Math.max(timeToMinutes(target.startTime), timeToMinutes(conflict.overlapEnd));
      const nextEnd = nextStart + duration;
      if (nextEnd >= 24 * 60) return;

      const formatTime = (minutes: number) =>
        `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      updatedById.set(target.id, {
        ...target,
        startTime: formatTime(nextStart),
        endTime: formatTime(nextEnd),
      });
    });

    updateSchedule(scheduleList.map((item) => updatedById.get(item.id) || item));
  };

  // Handle Add Session - Blocked if conflict exists with existing classes
  const handleAddSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const computedDay = getDayOfWeekFromDate(formData.date);
    const newSession: ScheduleItem = {
      id: `sch_${Date.now()}`,
      courseCode: formData.courseCode.trim(),
      courseTitle: formData.courseTitle.trim(),
      subject: formData.subject.trim(),
      lecturerName: formData.lecturerName.trim(),
      room: formData.room.trim(),
      building: formData.building.trim(),
      startTime: formData.startTime,
      endTime: formData.endTime,
      date: formData.date,
      dayOfWeek: computedDay,
      type: formData.type,
      status: 'upcoming',
      sessionTopic: formData.sessionTopic.trim(),
      checkInCode: `CHK-${Math.floor(100 + Math.random() * 900)}`,
      isCheckedIn: false,
    };

    try {
      if (editingSchedule && onUpdateScheduleItem) {
        await onUpdateScheduleItem({ ...editingSchedule, ...newSession, id: editingSchedule.id });
      } else if (onCreateSchedule) {
        await onCreateSchedule(newSession);
      } else {
        updateSchedule([...scheduleList, newSession]);
      }
      setIsAddModalOpen(false);
      setEditingSchedule(null);
      setMutationError(null);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : String(err));
    }
  };

  // Handle Check In
  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCheckInItem) return;

    if (onCheckIn) {
      const ok = await onCheckIn(activeCheckInItem.id, inputCheckInCode);
      if (ok) {
        setCheckInMsg({ type: 'success', text: 'Attendance recorded successfully!' });
        updateSchedule(
          scheduleList.map((s) => (s.id === activeCheckInItem.id ? { ...s, isCheckedIn: true } : s))
        );
        setTimeout(() => {
          setActiveCheckInItem(null);
          setCheckInMsg(null);
          setInputCheckInCode('');
        }, 1200);
      } else {
        setCheckInMsg({ type: 'error', text: 'Invalid check-in code. Please verify with lecturer.' });
      }
    } else {
      // Fallback local check-in
      updateSchedule(
        scheduleList.map((s) => (s.id === activeCheckInItem.id ? { ...s, isCheckedIn: true } : s))
      );
      setCheckInMsg({ type: 'success', text: 'Attendance verified!' });
      setTimeout(() => {
        setActiveCheckInItem(null);
        setCheckInMsg(null);
        setInputCheckInCode('');
      }, 1000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & View Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Class Schedule & Timetable
              </h2>
              {allConflicts.length > 0 ? (
                <Badge variant="rose" dot size="sm">
                  {allConflicts.length} Conflict{allConflicts.length > 1 ? 's' : ''} Detected
                </Badge>
              ) : (
                <Badge variant="emerald" dot size="sm">
                  Schedule Conflict-Free
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Real-time room occupancy, lecturer allocations, and automated schedule conflict detection.
            </p>
          </div>

          {/* Conflict Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {allConflicts.length > 0 && (
              <button
                id="btn-quick-resolve-conflicts"
                onClick={() => handleQuickResolve()}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                title="Automatically adjusts double-booked rooms and overlapping lecturer hours"
              >
                <Wrench className="w-3.5 h-3.5" />
                Resolve Conflicts
              </button>
            )}
          </div>
        </div>

        {/* View Mode Tabs & Period Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Mode Switcher: Weekly vs Monthly */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              id="tab-view-weekly"
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'weekly'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Weekly Schedule
            </button>
            <button
              id="tab-view-monthly"
              onClick={() => setViewMode('monthly')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'monthly'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Monthly Schedule
            </button>
          </div>

          {/* Navigation Controls */}
          {viewMode === 'weekly' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
                className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-800 min-w-36 text-center font-mono">
                {currentWeekLabel}
              </span>
              <button
                onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
                className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {currentWeekOffset !== 0 && (
                <button
                  onClick={() => setCurrentWeekOffset(0)}
                  className="px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                >
                  Current Week
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedMonth === 0) {
                    setSelectedMonth(11);
                    setSelectedYear((prev) => prev - 1);
                  } else {
                    setSelectedMonth((prev) => prev - 1);
                  }
                }}
                className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-800 min-w-36 text-center">
                {monthData.monthName} {monthData.year}
              </span>
              <button
                onClick={() => {
                  if (selectedMonth === 11) {
                    setSelectedMonth(0);
                    setSelectedYear((prev) => prev + 1);
                  } else {
                    setSelectedMonth((prev) => prev + 1);
                  }
                }}
                className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {(selectedMonth !== 8 || selectedYear !== 2026) && (
                <button
                  onClick={() => {
                    setSelectedMonth(8);
                    setSelectedYear(2026);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                >
                  This Month
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Prominent Conflict Warning Banner (Always visible when conflicts are detected) */}
      {allConflicts.length > 0 && (
        <div
          id="schedule-conflict-warning-banner"
          className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 shadow-xs space-y-3 animate-in fade-in duration-200"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0 shadow-xs">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-extrabold text-rose-900 tracking-tight">
                    Schedule Conflicts Detected ({allConflicts.length} Collision{allConflicts.length > 1 ? 's' : ''})
                  </h3>
                  {roomConflictCount > 0 && (
                    <Badge variant="rose" size="sm">
                      {roomConflictCount} Classroom Overlap{roomConflictCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {lecturerConflictCount > 0 && (
                    <Badge variant="amber" size="sm">
                      {lecturerConflictCount} Lecturer Overlap{lecturerConflictCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-rose-700 mt-1">
                  The system detected overlapping bookings for a classroom or lecturer at the same time. Review the conflicting sessions below to prevent physical double-booking.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleQuickResolve()}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
            >
              <Wrench className="w-3.5 h-3.5" />
              Auto-Resolve All
            </button>
          </div>

          {/* Conflict Items List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {allConflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="bg-white rounded-xl border border-rose-200 p-3.5 shadow-2xs space-y-2 hover:border-rose-400 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                      conflict.type === 'room'
                        ? 'bg-rose-100 text-rose-800'
                        : conflict.type === 'lecturer'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    <ShieldAlert className="w-3 h-3" />
                    {conflict.type === 'room'
                      ? 'Classroom Overlap'
                      : conflict.type === 'lecturer'
                      ? 'Lecturer Overlap'
                      : 'Simultaneous Overlap'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 font-semibold">
                    {conflict.dayOfWeek || conflict.date} • {conflict.overlapStart} – {conflict.overlapEnd}
                  </span>
                </div>

                <div className="text-xs text-slate-800 space-y-1">
                  <p className="font-semibold text-rose-900">{conflict.warningMessage}</p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="font-bold text-indigo-700 block">{conflict.sessionA.courseCode}</span>
                      <span className="text-slate-700 block truncate">{conflict.sessionA.courseTitle}</span>
                      <span className="text-slate-500 text-[10px] block mt-0.5">
                        {conflict.sessionA.lecturerName} • {conflict.sessionA.room}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="font-bold text-amber-700 block">{conflict.sessionB.courseCode}</span>
                      <span className="text-slate-700 block truncate">{conflict.sessionB.courseTitle}</span>
                      <span className="text-slate-500 text-[10px] block mt-0.5">
                        {conflict.sessionB.lecturerName} • {conflict.sessionB.room}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject, lecturer, room, code..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Subject Filter */}
          <div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Lecturer Filter */}
          <div>
            <select
              value={selectedLecturer}
              onChange={(e) => setSelectedLecturer(e.target.value)}
              className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
            >
              <option value="all">All Lecturers</option>
              {lecturers.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Room Filter */}
          <div>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
            >
              <option value="all">All Classrooms</option>
              {rooms.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 text-xs text-slate-500 flex-wrap">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-800">{filteredSchedule.length}</strong> of{' '}
              {scheduleList.length} sessions
            </span>
            {(selectedSubject !== 'all' ||
              selectedLecturer !== 'all' ||
              selectedRoom !== 'all' ||
              searchQuery) && (
              <button
                onClick={() => {
                  setSelectedSubject('all');
                  setSelectedLecturer('all');
                  setSelectedRoom('all');
                  setSearchQuery('');
                }}
                className="text-indigo-600 font-semibold hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. WEEKLY SCHEDULE VIEW                                   */}
      {/* ========================================================= */}
      {viewMode === 'weekly' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
            {currentWeekDays.map((day) => {
              // Get sessions for this day
              const daySessions = filteredSchedule.filter((item) => {
                return occursOnDate(item, day.dateStr, day.name);
              });

              // Sort by startTime
              daySessions.sort(
                (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
              );

              // Check if this day has any conflict
              const dayHasConflict = daySessions.some(
                (s) => getConflictsForItem(s, allConflicts).length > 0
              );

              return (
                <div
                  key={day.dateStr}
                  className={`bg-white rounded-2xl border flex flex-col min-h-96 shadow-xs transition-all ${
                    day.isCurrentDay
                      ? 'border-indigo-300 ring-2 ring-indigo-100'
                      : dayHasConflict
                      ? 'border-rose-200 bg-rose-50/10'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Day Header */}
                  <div
                    className={`p-3.5 border-b rounded-t-2xl flex items-center justify-between ${
                      day.isCurrentDay
                        ? 'bg-indigo-600 text-white'
                        : dayHasConflict
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-slate-50 border-slate-100 text-slate-800'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold text-xs block">{day.name}</span>
                      <span
                        className={`text-[11px] font-medium ${
                          day.isCurrentDay ? 'text-indigo-100' : 'text-slate-500'
                        }`}
                      >
                        {day.displayDate}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {dayHasConflict && (
                        <span
                          className="p-1 bg-rose-600 text-white rounded-md text-[10px]"
                          title="Schedule conflict on this day"
                        >
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          day.isCurrentDay
                            ? 'bg-indigo-500/50 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {daySessions.length}
                      </span>
                    </div>
                  </div>

                  {/* Sessions in day */}
                  <div className="p-2.5 flex-1 space-y-2.5 overflow-y-auto">
                    {daySessions.length === 0 ? (
                      <div className="h-40 flex flex-col items-center justify-center text-center p-3 text-slate-400 text-xs">
                        <CalendarIcon className="w-6 h-6 stroke-1 mb-1 text-slate-300" />
                        <span>No classes</span>
                      </div>
                    ) : (
                      daySessions.map((item) => {
                        const itemConflicts = getConflictsForItem(item, allConflicts);
                        const hasConflict = itemConflicts.length > 0;
                        const isLive = item.status === 'in_progress';

                        return (
                          <div
                            key={item.id}
                            id={`weekly-session-${item.id}`}
                            className={`relative rounded-xl p-3 border text-left transition-all hover:shadow-sm space-y-2 ${
                              hasConflict
                                ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-200'
                                : isLive
                                ? 'bg-indigo-50/50 border-indigo-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {/* Time & Conflict Badge */}
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 font-mono">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>
                                  {item.startTime} – {item.endTime}
                                </span>
                              </div>

                              <Badge
                                variant={item.type === 'Lab' ? 'purple' : item.type === 'Tutorial' ? 'amber' : 'blue'}
                                size="sm"
                              >
                                {item.type}
                              </Badge>
                            </div>

                            {/* Overlap Warning Pill */}
                            {hasConflict && (
                              <div
                                onClick={() => setSelectedConflictDetail(itemConflicts[0])}
                                className="cursor-pointer flex items-center gap-1 px-2 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-lg shadow-2xs hover:bg-rose-700"
                              >
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {itemConflicts[0].type === 'room'
                                    ? 'Room Double-Booked'
                                    : itemConflicts[0].type === 'lecturer'
                                    ? 'Lecturer Overlap'
                                    : 'Critical Overlap'}
                                </span>
                              </div>
                            )}

                            {/* Subject & Course Title */}
                            <div>
                              {item.subject && (
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 block truncate">
                                  {item.subject}
                                </span>
                              )}
                              <span className="font-extrabold text-xs text-slate-900 block leading-tight">
                                {item.courseCode}
                              </span>
                              <p className="text-[11px] text-slate-600 font-medium line-clamp-2 leading-snug">
                                {item.courseTitle}
                              </p>
                            </div>

                            {/* Lecturer & Room Info */}
                            <div className="text-[10px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
                              <div className="flex items-center gap-1 truncate" title={item.lecturerName}>
                                <User className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate font-medium">{item.lecturerName}</span>
                              </div>
                              <div className="flex items-center gap-1 truncate" title={item.room}>
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate font-semibold text-slate-700">{item.room}</span>
                              </div>
                            </div>

                            {/* Student self check-in is optional; lecturers use manual attendance. */}
                            {currentRole === 'student' && onCheckIn && !item.isCheckedIn && (
                              <button
                                onClick={() => {
                                  setActiveCheckInItem(item);
                                  setInputCheckInCode(item.checkInCode || '');
                                }}
                                className="w-full mt-1 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition-colors"
                              >
                                Check In
                              </button>
                            )}
                            {currentRole === 'student' && item.isCheckedIn && (
                              <div className="flex items-center justify-center gap-1 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Checked In
                              </div>
                            )}
                            {currentRole === 'lecturer' && onAttendance && (
                              <button
                                type="button"
                                onClick={() =>
                                  onAttendance({
                                    ...item,
                                    date: item.date || day.dateStr,
                                    id: `${item.id}_${item.date || day.dateStr}`,
                                  })
                                }
                                className="w-full mt-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Điểm danh
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. MONTHLY SCHEDULE VIEW                                  */}
      {/* ========================================================= */}
      {viewMode === 'monthly' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {monthData.cells.map((cell, idx) => {
                if (!cell.isCurrentMonth) {
                  return (
                    <div
                      key={`empty_${idx}`}
                      className="min-h-24 sm:min-h-28 rounded-xl bg-slate-50/50 p-2 text-slate-300 text-xs border border-transparent"
                    >
                      <span className="font-mono">{cell.dayNum}</span>
                    </div>
                  );
                }

                // Get sessions on this date
                const cellDate = new Date(`${cell.dateStr}T00:00:00`);
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const daySessions = filteredSchedule.filter((s) =>
                  occursOnDate(s, cell.dateStr, dayNames[cellDate.getDay()])
                );

                // Conflicts on this date
                const dayConflicts = allConflicts.filter((c) => c.date === cell.dateStr);
                const hasConflict = dayConflicts.length > 0;
                const isSelected = selectedDateStr === cell.dateStr;

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => setSelectedDateStr(cell.dateStr)}
                    className={`cursor-pointer min-h-24 sm:min-h-28 rounded-xl p-2 border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-200 bg-indigo-50/20'
                        : hasConflict
                        ? 'border-rose-300 bg-rose-50/40 hover:border-rose-400'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-extrabold font-mono rounded-md w-6 h-6 flex items-center justify-center ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : cell.dateStr === todayDateStr
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'text-slate-800'
                        }`}
                      >
                        {cell.dayNum}
                      </span>

                      {hasConflict && (
                        <span
                          className="flex items-center gap-0.5 px-1 py-0.5 bg-rose-600 text-white text-[9px] font-bold rounded-md"
                          title="Schedule Conflict Detected"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Overlap</span>
                        </span>
                      )}
                    </div>

                    {/* Class indicators */}
                    <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                      {daySessions.slice(0, 2).map((s) => (
                        <div
                          key={s.id}
                          className="text-[10px] truncate px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-700 border border-slate-200/60"
                        >
                          <span className="font-mono text-indigo-700 mr-1">{s.startTime}</span>
                          {s.courseCode}
                        </div>
                      ))}
                      {daySessions.length > 2 && (
                        <div className="text-[9px] text-slate-400 font-bold pl-1">
                          +{daySessions.length - 2} more
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 text-right font-medium">
                      {daySessions.length > 0 && `${daySessions.length} sessions`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Detailed Day Agenda Inspector */}
          {selectedDateStr && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Day Agenda: {selectedDateStr}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comprehensive schedule details, room assignments, and conflict status
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="indigo" size="sm">
                    {
                      filteredSchedule.filter((s) => s.date === selectedDateStr).length
                    }{' '}
                    Scheduled
                  </Badge>
                </div>
              </div>

              {/* Check if conflicts on this selected day */}
              {allConflicts.filter((c) => c.date === selectedDateStr).length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>Warning:</strong> A conflict has been identified among classes scheduled on this day.
                    </span>
                  </div>
                  <button
                    onClick={() => handleQuickResolve()}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px]"
                  >
                    Resolve Conflict
                  </button>
                </div>
              )}

              {/* Sessions on this day */}
              <div className="divide-y divide-slate-100">
                {filteredSchedule
                  .filter((s) => s.date === selectedDateStr)
                  .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                  .map((item) => {
                    const itemConflicts = getConflictsForItem(item, allConflicts);
                    const hasConflict = itemConflicts.length > 0;

                    return (
                      <div
                        key={item.id}
                        className={`py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          hasConflict ? 'bg-rose-50/50 px-3 rounded-xl' : ''
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-24 shrink-0 font-mono text-center">
                            <span className="text-sm font-extrabold text-slate-900 block">
                              {item.startTime}
                            </span>
                            <span className="text-[11px] text-slate-400">to {item.endTime}</span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-indigo-700 text-sm">
                                {item.courseCode}
                              </span>
                              <span className="text-slate-300">•</span>
                              <h4 className="font-bold text-slate-900 text-sm">{item.courseTitle}</h4>
                              <Badge variant={item.type === 'Lab' ? 'purple' : 'blue'} size="sm">
                                {item.type}
                              </Badge>

                              {hasConflict && (
                                <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-md flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {itemConflicts[0].type === 'room'
                                    ? `Room Overlap (${item.room})`
                                    : `Lecturer Overlap (${item.lecturerName})`}
                                </span>
                              )}
                            </div>

                            {item.subject && (
                              <p className="text-xs text-indigo-600 font-semibold">
                                Subject: {item.subject}
                              </p>
                            )}

                            <p className="text-xs text-slate-600">
                              Topic: <span className="font-medium text-slate-800">{item.sessionTopic}</span>
                            </p>

                            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                              <span className="flex items-center gap-1 font-semibold text-slate-700">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                Room: {item.room} ({item.building})
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                Lecturer: {item.lecturerName}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {currentRole === 'lecturer' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSchedule(item);
                                  setFormData({
                                    courseCode: item.courseCode,
                                    courseTitle: item.courseTitle,
                                    subject: item.subject || '',
                                    lecturerName: item.lecturerName,
                                    room: item.room,
                                    building: item.building,
                                    date: item.date || '',
                                    dayOfWeek: item.dayOfWeek || 'Monday',
                                    startTime: item.startTime,
                                    endTime: item.endTime,
                                    type: item.type,
                                    sessionTopic: item.sessionTopic,
                                  });
                                  setMutationError(null);
                                  setIsAddModalOpen(true);
                                }}
                                className="px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!onDeleteSchedule) return;
                                  try {
                                    await onDeleteSchedule(item.id);
                                    setMutationError(null);
                                  } catch (err) {
                                    setMutationError(err instanceof Error ? err.message : String(err));
                                  }
                                }}
                                className="px-3 py-2 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {currentRole === 'student' && onCheckIn && !item.isCheckedIn && (
                            <button
                              onClick={() => {
                                setActiveCheckInItem(item);
                                setInputCheckInCode(item.checkInCode || '');
                              }}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                            >
                              Check In
                            </button>
                          )}
                          {currentRole === 'student' && item.isCheckedIn && (
                            <span className="flex items-center gap-1 text-emerald-700 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Attended
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {filteredSchedule.filter((s) => s.date === selectedDateStr).length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No classes scheduled for this date.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MODAL: ADD CLASS SESSION (With Live Conflict Preview)  */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Class Schedule Session"
          subtitle="Provision a new lecture or lab session with instant collision check"
          maxWidth="lg"
        >
          <form onSubmit={handleAddSessionSubmit} className="space-y-4 py-2">
            {mutationError && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{mutationError}</div>
            )}
            {/* Live Conflict Alert within form - Blocks creation */}
            {newSessionConflictPreview.length > 0 && (
              <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl space-y-3 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0 shadow-xs mt-0.5">
                    <Ban className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-rose-900 uppercase tracking-wide">
                        Không thể tạo lớp: Trùng lịch với lớp đã có trước
                      </span>
                      <Badge variant="rose" size="sm">
                        Bị chặn tạo mới ({newSessionConflictPreview.length} va chạm)
                      </Badge>
                    </div>
                    <p className="text-xs text-rose-700 leading-relaxed">
                      Hệ thống <strong>không cho phép lưu lớp học này</strong> vì thời gian, phòng học hoặc giảng viên đang bị trùng lặp với lớp đã xếp lịch trước đó. Vui lòng chọn một phòng học khác hoặc đổi khung giờ để tiếp tục.
                    </p>
                  </div>
                </div>

                {/* Conflicting existing class details */}
                <div className="space-y-2 pt-1">
                  {newSessionConflictPreview.map((conflict, idx) => {
                    const existingItem =
                      conflict.sessionA.id === 'sch_temp_test'
                        ? conflict.sessionB
                        : conflict.sessionA;

                    return (
                      <div
                        key={conflict.id || idx}
                        className="bg-white rounded-xl border border-rose-200 p-3 text-xs space-y-2 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              conflict.type === 'room'
                                ? 'bg-rose-100 text-rose-800'
                                : conflict.type === 'lecturer'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            <ShieldAlert className="w-3 h-3" />
                            {conflict.type === 'room'
                              ? 'Xung đột phòng học'
                              : conflict.type === 'lecturer'
                              ? 'Xung đột giảng viên'
                              : 'Xung đột cả phòng và giảng viên'}
                          </span>
                          <span className="text-slate-500 font-mono text-[11px] font-semibold">
                            Trùng lúc: {conflict.overlapStart} – {conflict.overlapEnd}
                          </span>
                        </div>

                        <p className="text-xs text-rose-800 font-medium">
                          {conflict.warningMessage}
                        </p>

                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1">
                          <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider block">
                            Thông tin lớp học đã có trước:
                          </span>
                          <div className="font-bold text-indigo-900">
                            {existingItem.courseCode} – {existingItem.courseTitle}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-slate-600">
                            <div>
                              <span className="text-slate-400">Giảng viên: </span>
                              <span className="font-semibold text-slate-800">{existingItem.lecturerName}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Phòng học: </span>
                              <span className="font-semibold text-slate-800">{existingItem.room}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Thời gian: </span>
                              <span className="font-semibold text-slate-800">
                                {existingItem.startTime} – {existingItem.endTime} ({existingItem.dayOfWeek || existingItem.date})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Course Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.courseCode}
                  onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Computer Science, Artificial Intelligence"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Course Title *
              </label>
              <input
                type="text"
                required
                value={formData.courseTitle}
                onChange={(e) => setFormData({ ...formData, courseTitle: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lecturer *
                </label>
                <input
                  type="text"
                  required
                  value={formData.lecturerName}
                  onChange={(e) => setFormData({ ...formData, lecturerName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Room / Classroom *
                </label>
                <input
                  type="text"
                  required
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Date (YYYY-MM-DD) *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setFormData({
                      ...formData,
                      date: newDate,
                      dayOfWeek: getDayOfWeekFromDate(newDate),
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Session Topic
              </label>
              <input
                type="text"
                value={formData.sessionTopic}
                onChange={(e) => setFormData({ ...formData, sessionTopic: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Introduction to Relational Normalization"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                {newSessionConflictPreview.length > 0 ? (
                  <span className="text-rose-600 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Không thể tạo do trùng lịch ({newSessionConflictPreview.length} xung đột)
                  </span>
                ) : (
                  <span className="text-emerald-600 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Lịch học hợp lệ, không có xung đột
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newSessionConflictPreview.length > 0}
                  className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 ${
                    newSessionConflictPreview.length > 0
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-80'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                  }`}
                  title={
                    newSessionConflictPreview.length > 0
                      ? 'Không thể tạo lớp: Xung đột với lớp học đã có trước'
                      : 'Xác nhận tạo lớp học'
                  }
                >
                  {newSessionConflictPreview.length > 0 ? (
                    <>
                      <Ban className="w-4 h-4 text-rose-500" />
                      Blocked (Conflict Detected)
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Confirm & Schedule
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 4. MODAL: CONFLICT DETAIL INSPECTOR                       */}
      {/* ========================================================= */}
      {selectedConflictDetail && (
        <Modal
          isOpen={!!selectedConflictDetail}
          onClose={() => setSelectedConflictDetail(null)}
          title="Schedule Conflict Inspector"
          subtitle="Detailed collision breakdown between booked sessions"
          maxWidth="md"
        >
          <div className="space-y-4 py-2">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-xs font-bold text-rose-900 block mb-1">
                Detected Problem:
              </span>
              <p className="text-xs text-rose-700">
                {selectedConflictDetail.warningMessage}
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3 border border-slate-200 rounded-xl space-y-1 bg-slate-50">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                  Session 1
                </span>
                <span className="font-bold text-xs text-slate-900 block">
                  {selectedConflictDetail.sessionA.courseCode} – {selectedConflictDetail.sessionA.courseTitle}
                </span>
                <span className="text-xs text-slate-600 block">
                  Time: {selectedConflictDetail.sessionA.startTime} – {selectedConflictDetail.sessionA.endTime}
                </span>
                <span className="text-xs text-slate-600 block">
                  Lecturer: {selectedConflictDetail.sessionA.lecturerName}
                </span>
                <span className="text-xs text-slate-600 block">
                  Room: {selectedConflictDetail.sessionA.room}
                </span>
              </div>

              <div className="p-3 border border-slate-200 rounded-xl space-y-1 bg-slate-50">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Session 2 (Colliding)
                </span>
                <span className="font-bold text-xs text-slate-900 block">
                  {selectedConflictDetail.sessionB.courseCode} – {selectedConflictDetail.sessionB.courseTitle}
                </span>
                <span className="text-xs text-slate-600 block">
                  Time: {selectedConflictDetail.sessionB.startTime} – {selectedConflictDetail.sessionB.endTime}
                </span>
                <span className="text-xs text-slate-600 block">
                  Lecturer: {selectedConflictDetail.sessionB.lecturerName}
                </span>
                <span className="text-xs text-slate-600 block">
                  Room: {selectedConflictDetail.sessionB.room}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedConflictDetail(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleQuickResolve(selectedConflictDetail);
                  setSelectedConflictDetail(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                Auto-Resolve This Conflict
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 5. MODAL: STUDENT ATTENDANCE CHECK-IN                     */}
      {/* ========================================================= */}
      {activeCheckInItem && (
        <Modal
          isOpen={!!activeCheckInItem}
          onClose={() => {
            setActiveCheckInItem(null);
            setCheckInMsg(null);
          }}
          title={`Classroom Check-In: ${activeCheckInItem.courseCode}`}
          subtitle={`${activeCheckInItem.courseTitle} • ${activeCheckInItem.room}`}
          maxWidth="sm"
        >
          <form onSubmit={handleCheckInSubmit} className="space-y-4 py-2">
            <p className="text-xs text-slate-600">
              Enter the smart classroom PIN code displayed on the classroom screen to verify your attendance.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Classroom PIN Code
              </label>
              <input
                type="text"
                required
                value={inputCheckInCode}
                onChange={(e) => setInputCheckInCode(e.target.value.toUpperCase())}
                placeholder="e.g. RAFT-894"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-center tracking-widest font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {checkInMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  checkInMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {checkInMsg.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActiveCheckInItem(null);
                  setCheckInMsg(null);
                }}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
              >
                Confirm Attendance
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
