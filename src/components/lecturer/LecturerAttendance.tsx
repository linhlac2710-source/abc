import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Download,
  Filter,
  Users,
  Calendar,
  Play,
  StopCircle,
  Plus,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Building,
  Sparkles,
  UserCheck,
  UserX,
  Trash2,
} from 'lucide-react';
import {
  AttendanceSession,
  AttendanceRecord,
  AttendanceStatus,
  StudentRosterItem,
  Course,
  ScheduleItem,
} from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

interface LecturerAttendanceProps {
  roster: StudentRosterItem[];
  courses?: Course[];
  schedule?: import('../../types').ScheduleItem[];
  selectedSchedule?: ScheduleItem | null;
  sessions?: AttendanceSession[];
  onUpdateAttendance?: (studentId: string, newStatus: AttendanceStatus) => void;
  onMarkAllPresent?: () => void;
  onCreateSession?: (newSession: {
    courseId: string;
    courseCode: string;
    courseTitle: string;
    sessionTitle: string;
    date: string;
    startTime: string;
    endTime: string;
    room: string;
    checkInCode: string;
    allowLateMinutes: number;
    startImmediately?: boolean;
    attendanceMethod?: 'MANUAL' | 'QR';
  }) => void | Promise<void>;
  onStartSession?: (sessionId: string) => void | Promise<void>;
  onCloseSession?: (sessionId: string) => void | Promise<void>;
  onDeleteSession?: (sessionId: string) => void | Promise<void>;
  onUpdateSessionRecord?: (
    sessionId: string,
    studentId: string,
    newStatus: AttendanceStatus,
    notes?: string
  ) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export const LecturerAttendance: React.FC<LecturerAttendanceProps> = ({
  roster,
  courses = [],
  schedule = [],
  selectedSchedule = null,
  sessions: initialSessionsProp,
  onUpdateAttendance,
  onMarkAllPresent,
  onCreateSession,
  onStartSession,
  onCloseSession,
  onDeleteSession,
  onUpdateSessionRecord,
  loading = false,
  error = null,
}) => {
  const sessions = initialSessionsProp || [];
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const getNextCheckInTimes = () => {
    const now = new Date();
    now.setMinutes(Math.ceil((now.getMinutes() + 1) / 5) * 5, 0, 0);
    const end = new Date(now.getTime() + 30 * 60 * 1000);
    const toTime = (value: Date) =>
      `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
    return { date: localDate, startTime: toTime(now), endTime: toTime(end) };
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [statusOverrides, setStatusOverrides] = useState<Record<string, AttendanceStatus>>({});
  const lecturerCourses = useMemo(() => courses || [], [courses]);
  const visibleSessions = useMemo(
    () => {
      let result = courseFilter === 'all'
        ? sessions
        : sessions.filter((session) => session.courseId === courseFilter);
      if (selectedSchedule) {
        result = result.filter(
          (session) =>
            session.courseCode === selectedSchedule.courseCode &&
            session.startTime === selectedSchedule.startTime &&
            session.endTime === selectedSchedule.endTime &&
            (!selectedSchedule.date || session.date === selectedSchedule.date)
        );
      }
      return result;
    },
    [courseFilter, selectedSchedule, sessions]
  );

  const scheduleSessions = useMemo(() => {
    const existingKeys = new Set(
      visibleSessions.map((session) =>
        `${session.courseCode}|${session.date}|${session.startTime}|${session.endTime}`
      )
    );
    return schedule
      .filter((item) => {
        const course = lecturerCourses.find(
          (candidate) =>
            (candidate.code || candidate.class_code) === item.courseCode
        );
        return Boolean(course) && (courseFilter === 'all' || String(course?.id) === courseFilter);
      })
      .filter((item) => {
        if (
          selectedSchedule &&
          (item.courseCode !== selectedSchedule.courseCode ||
            item.startTime !== selectedSchedule.startTime ||
            item.endTime !== selectedSchedule.endTime ||
            (selectedSchedule.date && item.date !== selectedSchedule.date))
        ) {
          return false;
        }
        return !existingKeys.has(
          `${item.courseCode}|${item.date || ''}|${item.startTime}|${item.endTime}`
        );
      })
      .map((item) => {
        const course = lecturerCourses.find(
          (candidate) => (candidate.code || candidate.class_code) === item.courseCode
        );
        return {
          id: `schedule_${item.id}_${item.date || 'undated'}`,
          courseId: String(course?.id || ''),
          courseCode: item.courseCode,
          courseTitle: item.courseTitle,
          lecturerId: String(course?.lecturerId || ''),
          lecturerName: item.lecturerName,
          sessionTitle: item.sessionTopic || 'Buổi học',
          date: item.date || '',
          startTime: item.startTime,
          endTime: item.endTime,
          room: item.room,
          status: 'scheduled' as const,
          checkInCode: '',
          createdAt: '',
          records: [],
        };
      });
  }, [courseFilter, lecturerCourses, schedule, selectedSchedule, visibleSessions]);

  const sessionOptions = useMemo(
    () => [...visibleSessions, ...scheduleSessions],
    [scheduleSessions, visibleSessions]
  );

  // Selected session ID (default to first active session, or first session)
  const defaultSelectedSessionId = useMemo(() => {
    const active = sessionOptions.find((s) => s.status === 'active');
    return active ? active.id : sessionOptions[0]?.id || '';
  }, [sessionOptions]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>(defaultSelectedSessionId);

  useEffect(() => {
    if (!sessionOptions.length) return;
    if (!sessionOptions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(defaultSelectedSessionId);
    }
  }, [defaultSelectedSessionId, selectedSessionId, sessionOptions]);

  useEffect(() => {
    if (!selectedSchedule) return;
    const selectedCourse = courses.find(
      (course) =>
        (course.code || course.class_code) === selectedSchedule.courseCode
    );
    if (selectedCourse) {
      setCourseFilter(String(selectedCourse.id));
    }
  }, [courses, selectedSchedule]);

  useEffect(() => {
    if (!selectedSchedule || !sessionOptions.length) return;
    const matchingSession = sessionOptions.find(
      (session) =>
        session.courseCode === selectedSchedule.courseCode &&
        session.startTime === selectedSchedule.startTime &&
        session.endTime === selectedSchedule.endTime &&
        (!selectedSchedule.date || session.date === selectedSchedule.date)
    );
    if (matchingSession) {
      setSelectedSessionId(matchingSession.id);
    }
  }, [selectedSchedule, sessionOptions]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createSessionError, setCreateSessionError] = useState('');
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  const getCourseLabel = (course: Course) => `${course.code || course.class_code || course.title || course.class_name || 'Course'}`;

  // New Session Form State
  const [formData, setFormData] = useState({
    courseCode: lecturerCourses[0]?.code || lecturerCourses[0]?.class_code || '',
    courseTitle: lecturerCourses[0]?.title || lecturerCourses[0]?.class_name || 'Lecture Course',
    sessionTitle: 'Lecture Session',
    date: localDate,
    startTime: '09:00',
    endTime: '10:30',
    room: lecturerCourses[0]?.room || 'Classroom',
    checkInCode: '',
    allowLateMinutes: 15,
    startImmediately: true,
    attendanceMethod: 'MANUAL' as 'MANUAL' | 'QR',
  });

  useEffect(() => {
    if (!lecturerCourses.length) return;
    const matchesCurrentCourse = lecturerCourses.some(
      (course) => (course.code || course.class_code) === formData.courseCode
    );
    if (!matchesCurrentCourse) {
      const firstCourse = lecturerCourses[0];
      setFormData((prev) => ({
        ...prev,
        courseCode: firstCourse.code || firstCourse.class_code || '',
        courseTitle: firstCourse.title || firstCourse.class_name || prev.courseTitle,
        room: firstCourse.room || prev.room,
      }));
    }
  }, [lecturerCourses, formData.courseCode]);

  const getScheduleOccurrences = (item: ScheduleItem, course?: Course): ScheduleItem[] => {
    const classStartDate = item.classStartDate || course?.startDate;
    const classDurationWeeks = item.classDurationWeeks || course?.durationWeeks;
    if (item.date || !classStartDate || !classDurationWeeks || !item.dayOfWeek) {
      return [item];
    }
    const dayIndexes: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const targetDay = Object.entries(dayIndexes).find(
      ([day]) => day.toLowerCase() === item.dayOfWeek?.toLowerCase()
    )?.[1];
    if (targetDay === undefined) return [item];

    const start = new Date(`${classStartDate}T00:00:00`);
    const totalDays = Math.max(1, Math.min(Number(classDurationWeeks), 52)) * 7;
    const firstOffset = (targetDay - start.getDay() + 7) % 7;
    const occurrences: ScheduleItem[] = [];
    for (let offset = firstOffset; offset < totalDays; offset += 7) {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      occurrences.push({
        ...item,
        date: date.toISOString().slice(0, 10),
        courseTitle: item.courseTitle || course?.title || course?.class_name || '',
      });
    }
    return occurrences;
  };

  const scheduleOptions = useMemo(() => {
    const courseCode = formData.courseCode;
    return schedule
      .filter((item) =>
        item.courseCode === courseCode ||
        lecturerCourses.some(
          (course) =>
            String(course.id) === courseCode &&
            (course.code || course.class_code) === item.courseCode
        )
      )
      .flatMap((item) => {
        const course = lecturerCourses.find(
          (candidate) => (candidate.code || candidate.class_code) === item.courseCode
        );
        return getScheduleOccurrences(item, course);
      });
  }, [formData.courseCode, lecturerCourses, schedule]);

  useEffect(() => {
    if (formData.attendanceMethod === 'QR') return;
    const matchingSchedule = scheduleOptions.find((item) => item.date === formData.date) || scheduleOptions[0];
    if (!matchingSchedule) return;
    setFormData((previous) => {
      if (
        previous.startTime === matchingSchedule.startTime &&
        previous.endTime === matchingSchedule.endTime &&
        previous.room === matchingSchedule.room &&
        previous.sessionTitle === matchingSchedule.sessionTopic
      ) {
        return previous;
      }
      return {
        ...previous,
        date: matchingSchedule.date || previous.date,
        startTime: matchingSchedule.startTime,
        endTime: matchingSchedule.endTime,
        room: matchingSchedule.room,
        sessionTitle: matchingSchedule.sessionTopic,
      };
    });
  }, [scheduleOptions, formData.date, formData.attendanceMethod]);

  // Active Selected Session
  const activeSession = useMemo<AttendanceSession | null>(() => {
    const existingSession = selectedSchedule
      ? sessionOptions.find(
          (session) =>
            session.courseCode === selectedSchedule.courseCode &&
            session.startTime === selectedSchedule.startTime &&
            session.endTime === selectedSchedule.endTime &&
            (!selectedSchedule.date || session.date === selectedSchedule.date)
        )
      : sessionOptions.find((s) => s.id === selectedSessionId) || sessionOptions[0];
    if (existingSession) return existingSession;
    if (!selectedSchedule) return null;

    const course = lecturerCourses.find(
      (item) =>
        (item.code || item.class_code) === selectedSchedule.courseCode ||
        String(item.id) === String(selectedSchedule.courseCode)
    );
    if (!course) return null;

    return {
      id: `schedule_${selectedSchedule.id}`,
      courseId: String(course.id),
      courseCode: course.code || course.class_code,
      courseTitle: course.title || course.class_name,
      lecturerId: '',
      lecturerName: selectedSchedule.lecturerName,
      sessionTitle: selectedSchedule.sessionTopic || 'Buổi học',
      date: selectedSchedule.date || course.startDate || '',
      startTime: selectedSchedule.startTime,
      endTime: selectedSchedule.endTime,
      room: selectedSchedule.room,
      status: 'scheduled' as const,
      checkInCode: '',
      createdAt: '',
      records: [],
    };
  }, [lecturerCourses, selectedSchedule, selectedSessionId, sessionOptions]);

  // Records for the selected session
  const sessionRecords = useMemo<AttendanceRecord[]>(() => {
    if (!activeSession) return [];
    const course = lecturerCourses.find(
      (item) =>
        String(item.id) === String(activeSession.courseId) ||
        (item.code || item.class_code) === activeSession.courseCode
    );
    if (!course) {
      return roster
        .filter((student) => String(student.courseId) === String(activeSession.courseId))
        .map((student) => ({
          id: `absent_${activeSession.id}_${student.studentId}`,
          sessionId: activeSession.id,
          studentId: student.studentId,
          studentName: student.name,
          studentEmail: student.email,
          avatarUrl: student.avatarUrl,
          status: 'absent' as const,
        }));
    }

    const students = course.enrolledStudents || [];
    const enrolledIds = course.enrolledStudentIds || [];
    if (students.length === 0 && enrolledIds.length === 0) {
      return roster
        .filter((student) => String(student.courseId) === String(course.id))
        .map((student) => ({
          id: `absent_${activeSession.id}_${student.studentId}`,
          sessionId: activeSession.id,
          studentId: student.studentId,
          studentName: student.name,
          studentEmail: student.email,
          avatarUrl: student.avatarUrl,
          status: 'absent' as const,
        }));
    }
    const existingById = new Map(
      (activeSession.records || []).map((record) => [String(record.studentId), record])
    );

    const records = students.length > 0
      ? students.map((student) => {
          const studentId = String(student.student_id || student.studentId || student.id);
          const existing = existingById.get(studentId) || existingById.get(String(student.id));
          return existing || {
            id: `absent_${activeSession.id}_${studentId}`,
            sessionId: activeSession.id,
            studentId,
            studentName: student.full_name,
            studentEmail: student.email || '',
            avatarUrl: student.avatarUrl,
            status: 'absent' as const,
          };
        })
      : enrolledIds.map((studentId) => {
          const normalizedId = String(studentId);
          return existingById.get(normalizedId) || {
            id: `absent_${activeSession.id}_${normalizedId}`,
            sessionId: activeSession.id,
            studentId: normalizedId,
            studentName: normalizedId,
            studentEmail: '',
            status: 'absent' as const,
          };
        });
    return records.map((record) => ({
      ...record,
      status: statusOverrides[`${activeSession.id}:${record.studentId}`] || record.status,
    }));
  }, [activeSession, lecturerCourses, roster, statusOverrides]);

  const activeCourse = useMemo(() => {
    if (!activeSession) return null;
    return lecturerCourses.find(
      (course) =>
        String(course.id) === String(activeSession.courseId) ||
        (course.code || course.class_code) === activeSession.courseCode
    ) || null;
  }, [activeSession, lecturerCourses]);

  // Statistics for current session
  const stats = useMemo(() => {
    const enrolledCount = activeCourse
      ? Math.max(
          activeCourse.enrolledStudents?.length || 0,
          activeCourse.enrolledStudentIds?.length || 0,
          Number(activeCourse.enrolledCount) || 0,
        )
      : 0;
    const total = Math.max(sessionRecords.length, enrolledCount);
    const present = sessionRecords.filter((r) => r.status === 'present').length;
    const late = sessionRecords.filter((r) => r.status === 'late').length;
    const absent = sessionRecords.filter((r) => r.status === 'absent').length;
    const rate = total > 0 ? Math.round(((present + late * 0.7) / total) * 1000) / 10 : 0;
    return { total, present, late, absent, rate };
  }, [activeCourse, sessionRecords]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return sessionRecords.filter((r) => {
      const matchesSearch =
        String(r.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.studentId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.studentEmail || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sessionRecords, searchTerm, statusFilter]);

  // Handlers for session actions
  const handleStartAttendance = (sessId: string) => {
    if (onStartSession) {
      onStartSession(sessId);
    }
  };

  const handleCloseAttendance = async (sessId: string) => {
    if (onCloseSession) {
      try {
        await onCloseSession(sessId);
      } catch (err) {
        return;
      }
    }
    setIsCloseConfirmOpen(false);
  };

  const handleDeleteSession = async (sessId: string) => {
    if (!onDeleteSession) return;
    try {
      await onDeleteSession(sessId);
    } catch (err) {
      return;
    }
  };

  const handleUpdateRecordStatus = (
    studentId: string,
    newStatus: AttendanceStatus,
    notes?: string
  ) => {
    if (!activeSession) return;
    setStatusOverrides((previous) => ({
      ...previous,
      [`${activeSession.id}:${studentId}`]: newStatus,
    }));
    if (onUpdateSessionRecord) {
      void Promise.resolve()
        .then(() => onUpdateSessionRecord(activeSession.id, studentId, newStatus, notes))
        .catch(() => {
        setStatusOverrides((previous) => {
          const next = { ...previous };
          delete next[`${activeSession.id}:${studentId}`];
          return next;
        });
        });
    }

    // Also notify general roster if handler available
    if (onUpdateAttendance) {
      onUpdateAttendance(studentId, newStatus);
    }
  };

  const handleMarkAllPresentClick = () => {
    if (!activeSession) return;
    if (onMarkAllPresent) {
      onMarkAllPresent();
    }
  };

  const handleCreateSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSessionError('');
    if (onCreateSession) {
      try {
        if (!formData.sessionTitle.trim()) {
          throw new Error('Vui lòng nhập tên phiên điểm danh.');
        }
        const startAt = new Date(`${formData.date}T${formData.startTime}:00`);
        const endAt = new Date(`${formData.date}T${formData.endTime}:00`);
        if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) {
          throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu.');
        }
        if (formData.attendanceMethod === 'QR' && endAt.getTime() < Date.now()) {
          throw new Error('Thời gian kết thúc đã qua. Hãy chọn một khoảng thời gian hiện tại hoặc sắp tới.');
        }
        const course = lecturerCourses.find(
          (c) => (c.code || c.class_code) === formData.courseCode || String(c.id) === formData.courseCode
        );
        if (!course) {
          throw new Error('Vui lòng chọn một khoá học thuộc quyền giảng dạy của bạn.');
        }
        await onCreateSession({
          ...formData,
          checkInCode: '',
          courseId: String(course.id),
          courseCode: course.code || course.class_code || formData.courseCode,
          courseTitle: course.title || course.class_name || formData.courseTitle,
          attendanceMethod: formData.attendanceMethod,
        });
        setIsCreateModalOpen(false);
      } catch (err: unknown) {
        setCreateSessionError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const handleExportCSV = () => {
    if (!activeSession) return;
    const headers = ['Mã sinh viên', 'Student Name', 'Email', 'Trạng thái', 'Thời gian điểm danh', 'Phương thức', 'Cảnh báo', 'Notes'];
    const rows = activeSession.records.map((r) => [
      r.studentId,
      `"${r.studentName}"`,
      r.studentEmail,
      r.status.toUpperCase(),
      r.checkInTime || 'N/A',
      r.method || 'N/A',
      r.warning || '',
      `"${r.notes || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${activeSession.courseCode}_${activeSession.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {loading && <div className="text-xs text-slate-500">Đang tải lại điểm danh...</div>}
      {error && <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}
      {/* Header & Quick Action Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
              Lecturer Attendance Console
            </span>
            {activeSession?.status === 'active' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Đang điểm danh
              </span>
            )}
          </div>
          <h2 className="text-2xl md:text-[2rem] font-black text-slate-900 tracking-[-0.04em] mt-2 leading-tight">
            Attendance Session Management &amp; Roster
          </h2>
          <p className="text-xs text-slate-500 mt-1.5">
            Chọn lớp và cập nhật trạng thái điểm danh thủ công theo từng ngày.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-create-session"
            onClick={() => {
              setCreateSessionError('');
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold rounded-xl shadow-[0_8px_20px_rgba(79,70,229,0.28)] transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Tạo phiên theo ca
          </button>

          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors border border-slate-200 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Session Switcher & Control Strip */}
      <div className="bg-[#071b31] text-white p-4 sm:p-5 rounded-[26px] shadow-[0_18px_45px_rgba(15,23,42,0.22)] border border-slate-700/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-3 shrink-0 rounded-[22px] border border-slate-400/60 bg-slate-900/35 px-3 py-2.5">
            <span className="text-[12px] font-black uppercase tracking-[0.14em] text-slate-200 whitespace-nowrap">
              PHIÊN ĐIỂM DANH:
            </span>
            <div className="min-w-[72px] rounded-full border border-slate-400/60 bg-slate-900/50 px-3 py-1.5 text-center">
              <span className="text-[13px] font-black text-slate-100">{sessionOptions.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative min-w-[210px] w-[260px] shrink-0">
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="w-full appearance-none rounded-[22px] border border-slate-400/60 bg-slate-900/35 px-3.5 py-2.5 pr-9 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Filter attendance sessions by class"
              >
                <option value="all" className="bg-slate-900 text-white">Tất cả lớp của giảng viên</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id} className="bg-slate-900 text-white">
                    {course.code || course.class_code}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-300 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-0">
              <select
                id="select-attendance-session"
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full appearance-none rounded-[22px] border border-slate-400/60 bg-slate-900/35 px-3.5 py-2.5 pr-9 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {sessionOptions.length === 0 ? (
                  <option value="" className="bg-slate-900 text-white">Không có phiên điểm danh</option>
                ) : (
                  sessionOptions.map((sess) => (
                    <option key={sess.id} value={sess.id} className="bg-slate-900 text-white">
                      {sess.status === 'active' ? '[ĐANG ĐIỂM DANH] ' : sess.status === 'scheduled' ? '[ĐÃ LÊN LỊCH] ' : '[ĐÃ KHÓA] '}
                      {sess.courseCode}: {sess.date} ({sess.startTime})
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-200 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {activeSession && activeSession.status === 'scheduled' && activeSession.attendanceMethod !== 'QR' && (
            <button
              id="btn-start-attendance"
              onClick={() => handleStartAttendance(activeSession.id)}
              className="whitespace-nowrap rounded-[20px] bg-emerald-500/90 px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(16,185,129,0.3)] hover:bg-emerald-400 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Play className="w-3.5 h-3.5 fill-current" />
                Bắt đầu điểm danh
              </span>
            </button>
          )}

          {activeSession && activeSession.status === 'active' && (
            <>
              <button
                id="btn-close-attendance"
                onClick={() => setIsCloseConfirmOpen(true)}
                className="whitespace-nowrap rounded-[20px] bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2.5 text-xs font-bold text-white shadow-[0_10px_28px_rgba(239,68,68,0.35)] hover:brightness-110 transition-all"
              >
                <span className="flex items-center gap-2">
                  <StopCircle className="w-3.5 h-3.5" />
                  {activeSession.attendanceMethod === 'QR' ? 'KHÓA PHIÊN' : 'Khóa phiên điểm danh'}
                </span>
              </button>
            </>
          )}

          {activeSession?.attendanceMethod === 'QR' && (
            <div className="rounded-xl border border-indigo-300/40 bg-indigo-950/60 px-4 py-2 text-xs text-indigo-100">
              <span className="font-semibold">Mã phiên: </span>
              <span className="font-mono font-black tracking-widest">{activeSession.sessionCode || '—'}</span>
              <span className="ml-3">
                {activeSession.sessionStatus === 'LOCKED' ? 'Đã khóa' : activeSession.sessionStatus === 'UPCOMING' ? 'Sắp diễn ra' : 'Đang mở'}
              </span>
              <span className="ml-3 font-semibold">
                Đã điểm danh: {stats.present + stats.late}/{stats.total}
              </span>
            </div>
          )}

          {activeSession && activeSession.status === 'closed' && activeSession.attendanceMethod !== 'QR' && (
            <button
              id="btn-reopen-attendance"
              onClick={() => handleStartAttendance(activeSession.id)}
              className="whitespace-nowrap rounded-[20px] bg-slate-700/90 px-4 py-2.5 text-xs font-semibold text-slate-100 border border-slate-500/60 hover:bg-slate-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                Mở lại phiên điểm danh
              </span>
            </button>
          )}

          {activeSession && (
            <button
              id="btn-delete-attendance-session"
              onClick={() => handleDeleteSession(activeSession.id)}
              className="whitespace-nowrap rounded-[20px] bg-rose-500/15 border border-rose-400/60 px-4 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-500/25 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" />
                Xoá phiên
              </span>
            </button>
          )}

          <button
            id="btn-mark-all-present"
            onClick={handleMarkAllPresentClick}
            className="whitespace-nowrap rounded-[20px] bg-emerald-500/15 border border-emerald-400/60 px-4 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 transition-colors"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark All Present
            </span>
          </button>
        </div>
      </div>

      {/* Attendance Status KPI Counters */}
      <div className="hidden grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng số đăng ký</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">100% sĩ số</span>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Có mặt</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-1">{stats.present}</p>
          <span className="text-[11px] text-emerald-700 mt-0.5 block font-medium">
            {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}% of class
          </span>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Đi muộn</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-800 mt-1">{stats.late}</p>
          <span className="text-[11px] text-amber-700 mt-0.5 block font-medium">
            {stats.total > 0 ? Math.round((stats.late / stats.total) * 100) : 0}% arrived late
          </span>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Vắng mặt</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-800 mt-1">{stats.absent}</p>
          <span className="text-[11px] text-rose-700 mt-0.5 block font-medium">
            {stats.total > 0 ? Math.round((stats.absent / stats.total) * 100) : 0}% absent
          </span>
        </div>
      </div>

      {/* Attendance List Header, Search & Filter Tools */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Attendance Roster List ({filteredRecords.length} Students)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Click status toggles below to directly adjust student verification status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 text-xs">
              {(['all', 'present', 'late', 'absent'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg capitalize text-[11px] font-bold transition-colors ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Roster Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Student</th>
                <th className="px-5 py-3.5">Mã sinh viên</th>
                <th className="px-5 py-3.5">Thời gian điểm danh</th>
                <th className="px-5 py-3.5">Phương thức</th>
                <th className="px-5 py-3.5">Cảnh báo</th>
                <th className="px-5 py-3.5 text-center">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Đổi trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400 text-xs">
                    No students found matching your search or filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const status = record.status;

                  return (
                    <tr
                      key={record.id}
                      id={`attendance-row-${record.studentId}`}
                      className={`transition-colors ${
                        record.warning
                          ? 'bg-amber-50/70 hover:bg-amber-100/60'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              record.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                record.studentName || 'Student'
                              )}&background=random`
                            }
                            alt={record.studentName}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">{record.studentName}</span>
                            <span className="text-[11px] text-slate-400">{record.studentEmail}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-mono font-medium text-slate-700">
                        {record.studentId}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600">
                        {'checkInTime' in record && (record as any).checkInTime ? (
                          <span className="font-medium text-slate-800">{(record as any).checkInTime}</span>
                        ) : (
                          <span className="text-slate-400 italic">Chưa điểm danh</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        {'method' in record && (record as any).method ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                            {(record as any).method}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        {record.warning ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-2xs" title={record.warning}>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            {record.warning.includes('khác') || record.warning.includes('Wi-Fi')
                              ? '⚠ Khác Wi-Fi / IP'
                              : record.warning}
                          </span>
                        ) : record.method === 'qr' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Cùng mạng (Bình thường)
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            status === 'present'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : status === 'late'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {status === 'present' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {status === 'late' && <Clock className="w-3 h-3 text-amber-600" />}
                          {status === 'absent' && <XCircle className="w-3 h-3 text-rose-600" />}
                          {status === 'present' ? 'Có mặt' : status === 'late' ? 'Đi muộn' : 'Vắng mặt'}
                        </span>
                      </td>

                      {/* Explicit 3-State Interactive Toggle */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 gap-1">
                          <button
                            id={`btn-set-present-${record.studentId}`}
                            type="button"
                            onClick={() => handleUpdateRecordStatus(record.studentId, 'present')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                              status === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            id={`btn-set-late-${record.studentId}`}
                            type="button"
                            onClick={() => handleUpdateRecordStatus(record.studentId, 'late')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                              status === 'late'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            Late
                          </button>
                          <button
                            id={`btn-set-absent-${record.studentId}`}
                            type="button"
                            onClick={() => handleUpdateRecordStatus(record.studentId, 'absent')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                              status === 'absent'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Attendance Session */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Tạo phiên điểm danh theo ca"
          subtitle="Tạo phiên điểm danh thủ công hoặc QR một chạm cho lớp của bạn."
          maxWidth="lg"
        >
          <form onSubmit={handleCreateSessionSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              {([
                ['MANUAL', 'Điểm danh thủ công'],
                ['QR', 'QR một chạm'],
              ] as const).map(([method, label]) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setCreateSessionError('');
                    setFormData((previous) => ({
                      ...previous,
                      ...(method === 'QR' ? getNextCheckInTimes() : {}),
                      attendanceMethod: method,
                    }));
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    formData.attendanceMethod === method
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {createSessionError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
                {createSessionError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Course Selection *
                </label>
                <select
                  value={formData.courseCode}
                  onChange={(e) => {
                    const selectedCode = e.target.value;
                    const selectedCourse = lecturerCourses.find(
                      (course) => (course.code || course.class_code) === selectedCode || String(course.id) === selectedCode
                    );
                    setFormData((p) => ({
                      ...p,
                      courseCode: selectedCode,
                      courseTitle: selectedCourse?.title || selectedCourse?.class_name || p.courseTitle,
                      room: selectedCourse?.room || p.room,
                    }));
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                  disabled={lecturerCourses.length === 0}
                >
                  {lecturerCourses.length === 0 ? (
                    <option value="">Bạn chưa có lớp nào được giao dạy</option>
                  ) : (
                    lecturerCourses.map((course) => (
                      <option key={course.id} value={course.code || course.class_code || course.id}>
                        {(course.code || course.class_code || course.title || course.class_name)} - {course.title || course.class_name || 'Lecture Course'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên phiên điểm danh *</label>
                <input
                  type="text"
                  value={formData.sessionTitle}
                  onChange={(e) => setFormData({ ...formData, sessionTitle: e.target.value })}
                  maxLength={120}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ví dụ: Buổi 1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Session Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ca học theo lịch *
              </label>
              {formData.attendanceMethod === 'QR' ? (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                  Nhập thời gian bắt đầu và kết thúc bên dưới. Phiên QR không bắt buộc gắn với một ca học trong lịch.
                </div>
              ) : scheduleOptions.length > 0 ? (
                <select
                  value={`${formData.date}|${formData.startTime}|${formData.endTime}`}
                  onChange={(event) => {
                    const selected = scheduleOptions.find(
                      (item) => `${item.date}|${item.startTime}|${item.endTime}` === event.target.value
                    );
                    if (!selected) return;
                    setFormData((previous) => ({
                      ...previous,
                      date: selected.date || previous.date,
                      startTime: selected.startTime,
                      endTime: selected.endTime,
                      room: selected.room,
                      sessionTitle: selected.sessionTopic,
                    }));
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                  required
                >
                  {scheduleOptions.map((item) => (
                    <option key={`${item.id}_${item.date || 'undated'}`} value={`${item.date}|${item.startTime}|${item.endTime}`}>
                      {item.date || 'Không có ngày'} · {item.startTime} - {item.endTime} · {item.room} · {item.sessionTopic}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Chưa có ca học trong lịch cho lớp này. Hãy tạo lịch học trước khi điểm danh.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Giờ bắt đầu theo lịch *
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  readOnly={scheduleOptions.length > 0 && formData.attendanceMethod === 'MANUAL'}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Giờ kết thúc theo lịch *
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  readOnly={scheduleOptions.length > 0 && formData.attendanceMethod === 'MANUAL'}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phòng theo lịch *
                </label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  readOnly={scheduleOptions.length > 0 && formData.attendanceMethod === 'MANUAL'}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            {formData.attendanceMethod === 'MANUAL' && (
              <div className="grid grid-cols-1 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Late Arrival Grace Period (Minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={formData.allowLateMinutes}
                    onChange={(e) => setFormData({ ...formData, allowLateMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Dùng để tham khảo khi giảng viên đánh dấu trạng thái <strong>Đi muộn</strong>.
                  </span>
                </div>
              </div>
            )}

            {formData.attendanceMethod === 'MANUAL' && <div className="pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.startImmediately}
                  onChange={(e) => setFormData({ ...formData, startImmediately: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold">
                  Bắt đầu điểm danh ngay sau khi tạo
                </span>
              </label>
            </div>}

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                {formData.attendanceMethod === 'QR'
                  ? 'Tạo phiên QR'
                  : formData.startImmediately ? 'Tạo & bắt đầu điểm danh' : 'Lưu phiên theo lịch'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Close Attendance Confirmation */}
      {isCloseConfirmOpen && activeSession && (
        <Modal
          isOpen={isCloseConfirmOpen}
          onClose={() => setIsCloseConfirmOpen(false)}
          title="Xác nhận khóa phiên điểm danh"
          maxWidth="sm"
        >
          <div className="space-y-4 pt-2 text-xs text-slate-600">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Khóa phiên điểm danh này?</span>
                Sinh viên chưa được giảng viên cập nhật trạng thái sẽ được ghi nhận là{' '}
                <strong className="text-rose-700">Vắng mặt</strong>.
              </div>
            </div>

            <p>
              Session: <strong>{activeSession.courseCode}</strong> ({activeSession.date})
              <br />
              Current Status: {stats.present} Present, {stats.late} Late, {stats.absent} Absent.
            </p>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCloseConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCloseAttendance(activeSession.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Confirm & Close Window
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
