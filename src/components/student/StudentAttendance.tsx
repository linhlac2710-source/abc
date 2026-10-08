import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  AlertCircle,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Building,
  KeyRound,
  Check,
  Sparkles,
  ChevronRight,
  ListFilter,
  History,
  Activity,
  Layers,
} from 'lucide-react';
import {
  StudentAttendance as AttendanceType,
  AttendanceSession,
  AttendanceStatus,
  UserProfile,
} from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

interface StudentAttendanceProps {
  attendanceData?: AttendanceType[];
  sessions?: AttendanceSession[];
  currentUser?: UserProfile | null;
  onCheckIn?: (sessionId: string, code: string) => Promise<boolean> | boolean;
}

export const StudentAttendance: React.FC<StudentAttendanceProps> = ({
  attendanceData = [],
  sessions: initialSessionsProp,
  currentUser,
  onCheckIn,
}) => {
  const currentStudentId = String(currentUser?.student_id || currentUser?.studentId || currentUser?.id || '');

  // Use sessions provided by parent; if none provided, default to empty list
  const sessions = initialSessionsProp && initialSessionsProp.length > 0 ? initialSessionsProp : [];

  // Navigation tab: 'status' | 'sessions' | 'history'
  const [activeTab, setActiveTab] = useState<'sessions' | 'status' | 'history'>('sessions');

  // Check-In Modal State
  const [activeCheckInSession, setActiveCheckInSession] = useState<AttendanceSession | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [checkInError, setCheckInError] = useState('');
  const [oneTapPendingId, setOneTapPendingId] = useState<string | null>(null);
  const [oneTapMessage, setOneTapMessage] = useState<Record<string, string>>({});
  const [checkInSuccess, setCheckInSuccess] = useState<{
    status: AttendanceStatus;
    time: string;
    courseCode: string;
  } | null>(null);
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);

  // Filters for History Tab
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [historyCourseFilter, setHistoryCourseFilter] = useState<string>('all');
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  // Course selector in Status tab
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('all');

  // Find currently active sessions for student
  const activeSessions = useMemo(() => {
    return sessions.filter((s) => s.status === 'active');
  }, [sessions]);

  // Find upcoming scheduled sessions
  const scheduledSessions = useMemo(() => {
    return sessions.filter((s) => s.status === 'scheduled');
  }, [sessions]);

  // Past closed sessions
  const closedSessions = useMemo(() => {
    return sessions.filter((s) => s.status === 'closed');
  }, [sessions]);

  const studentIdentifiers = useMemo(() => new Set(
    [
      currentUser?.student_code,
      currentUser?.studentId,
      currentUser?.student_id,
      currentUser?.id,
      currentUser?.full_name,
      currentUser?.name,
    ]
      .filter(Boolean)
      .map((v) => String(v).trim().toLowerCase())
  ), [currentUser]);

  const visibleAttendanceData = attendanceData;

  const getMyRecord = (session: AttendanceSession) =>
    session.records?.find((record) => {
      const rId = String(record.studentId || '').trim().toLowerCase();
      const rName = String(record.studentName || '').trim().toLowerCase();
      return studentIdentifiers.has(rId) || (rName && studentIdentifiers.has(rName));
    });

  // Build the complete student attendance history from all live sessions & course records
  const studentHistory = useMemo(() => {
    const list: Array<{
      sessionId: string;
      date: string;
      courseCode: string;
      courseTitle: string;
      sessionTitle: string;
      room: string;
      startTime: string;
      endTime: string;
      status: AttendanceStatus;
      checkInTime?: string;
      method?: string;
      notes?: string;
      sessionStatus: 'active' | 'scheduled' | 'closed';
    }> = [];

    const enrolledCourseCodes = new Set(
      visibleAttendanceData.map((course) => course.courseCode.trim().toLowerCase()).filter(Boolean)
    );
    const scopedSessions = enrolledCourseCodes.size > 0
      ? sessions.filter((session) => enrolledCourseCodes.has(session.courseCode.trim().toLowerCase()))
      : sessions;
    const uniqueSessions = Array.from(
      scopedSessions.reduce((map, session) => {
        const key = `${session.courseCode.trim().toLowerCase()}|${session.date}|${session.startTime}|${session.endTime}`;
        if (!map.has(key)) map.set(key, session);
        return map;
      }, new Map<string, AttendanceSession>()).values()
    ).filter((session) => session.status === 'closed' || Boolean(getMyRecord(session)));
    const liveSessionCounts = new Map<string, number>();
    uniqueSessions.forEach((session) => {
      const courseKey = session.courseCode.trim().toLowerCase();
      liveSessionCounts.set(courseKey, (liveSessionCounts.get(courseKey) || 0) + 1);
    });
    const seenSessions = new Set<string>();
    const seenCourseDates = new Set<string>();

    // Match Grade's live-session precedence and de-duplication when at least five sessions exist.
    uniqueSessions.forEach((sess) => {
      const rec = getMyRecord(sess);
      const effectiveStatus: AttendanceStatus = rec?.status || (sess.status === 'closed' ? 'absent' : 'scheduled');
      const key = `${sess.courseCode.trim().toLowerCase()}|${sess.date}|${sess.startTime}|${sess.endTime}`;
      seenSessions.add(key);
      seenCourseDates.add(`${sess.courseCode.trim().toLowerCase()}|${sess.date}`);

      list.push({
        sessionId: sess.id,
        date: sess.date,
        courseCode: sess.courseCode,
        courseTitle: sess.courseTitle,
        sessionTitle: sess.sessionTitle,
        room: sess.room,
        startTime: sess.startTime,
        endTime: sess.endTime,
        status: effectiveStatus,
        checkInTime: rec?.checkInTime,
        method: rec?.method || (rec ? 'manual' : undefined),
        notes: rec?.notes,
        sessionStatus: sess.status,
      });
    });

    // Prefer live session records once they cover the course history.
    visibleAttendanceData.forEach((course) => {
      if ((liveSessionCounts.get(course.courseCode.trim().toLowerCase()) || 0) >= 5) return;

      (course.recentSessions || []).forEach((histSess, idx) => {
        const key = `${course.courseCode.trim().toLowerCase()}|${histSess.date}|09:00|10:30`;
        const courseDateKey = `${course.courseCode.trim().toLowerCase()}|${histSess.date}`;
        if (!seenSessions.has(key) && !seenCourseDates.has(courseDateKey)) {
          seenSessions.add(key);
          seenCourseDates.add(courseDateKey);
          list.push({
            sessionId: `hist_${course.courseCode}_${histSess.date}_${idx}`,
            date: histSess.date,
            courseCode: course.courseCode,
            courseTitle: course.courseTitle,
            sessionTitle: histSess.topic || `Lecture on ${histSess.date}`,
            room: 'Smart Hall A-204',
            startTime: '09:00',
            endTime: '10:30',
            status: histSess.status as AttendanceStatus,
            checkInTime: histSess.status === 'present' ? '09:04 AM' : histSess.status === 'late' ? '09:18 AM' : undefined,
            method: histSess.status === 'present' ? 'qr' : 'manual',
            notes: histSess.status === 'late' ? 'Arrived after grace period' : undefined,
            sessionStatus: 'closed',
          });
        }
      });
    });

    const statusLimits = new Map(
      visibleAttendanceData.map((course) => [
        course.courseCode.trim().toLowerCase(),
        {
          present: course.attendedSessions || 0,
          late: course.lateSessions || 0,
          absent: course.absentSessions || 0,
        },
      ])
    );
    const includedCounts = new Map<string, { present: number; late: number; absent: number }>();

    // Keep detailed history from exceeding Grade's per-course status totals.
    return list.sort((a, b) => b.date.localeCompare(a.date)).filter((item) => {
      const courseKey = item.courseCode.trim().toLowerCase();
      const limits = statusLimits.get(courseKey);
      if (!limits) return true;
      if (limits.present + limits.late + limits.absent === 0) return true;

      const statusKey = item.status === 'excused' ? 'present' : item.status;
      if (statusKey !== 'present' && statusKey !== 'late' && statusKey !== 'absent') return false;

      const counts = includedCounts.get(courseKey) || { present: 0, late: 0, absent: 0 };
      if (counts[statusKey] >= limits[statusKey]) return false;
      counts[statusKey]++;
      includedCounts.set(courseKey, counts);
      return true;
    });
  }, [sessions, visibleAttendanceData, studentIdentifiers]);

  // Aggregate stats synchronized with attendanceData & live session history
  const studentStats = useMemo(() => {
    const totalFromCourses = visibleAttendanceData.reduce((acc, c) => acc + (c.totalSessions || 0), 0);
    const attendedFromCourses = visibleAttendanceData.reduce((acc, c) => acc + (c.attendedSessions || 0), 0);
    const lateFromCourses = visibleAttendanceData.reduce((acc, c) => acc + (c.lateSessions || 0), 0);
    const absentFromCourses = visibleAttendanceData.reduce((acc, c) => acc + (c.absentSessions || 0), 0);

    const total = totalFromCourses > 0 ? totalFromCourses : studentHistory.length;
    const present = totalFromCourses > 0 ? attendedFromCourses : studentHistory.filter((h) => h.status === 'present' || h.status === 'excused').length;
    const late = totalFromCourses > 0 ? lateFromCourses : studentHistory.filter((h) => h.status === 'late').length;
    const absent = totalFromCourses > 0 ? absentFromCourses : studentHistory.filter((h) => h.status === 'absent').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    const isEligible = visibleAttendanceData.length > 0
      ? visibleAttendanceData.every((course) => course.attendanceExceeded !== true)
      : rate >= 80;

    return { total, present, late, absent, rate, isEligible };
  }, [studentHistory, visibleAttendanceData]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return studentHistory.filter((item) => {
      const matchesStatus =
        historyStatusFilter === 'all' ||
        item.status === historyStatusFilter ||
        (historyStatusFilter === 'present' && item.status === 'excused');
      const matchesCourse =
        historyCourseFilter === 'all' || item.courseCode === historyCourseFilter;
      const matchesSearch =
        item.sessionTitle.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        item.courseCode.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        item.date.includes(historySearchTerm);

      return matchesStatus && matchesCourse && matchesSearch;
    });
  }, [studentHistory, historyStatusFilter, historyCourseFilter, historySearchTerm]);

  const statusLists = useMemo(
    () => ({
      present: studentHistory.filter((item) => item.status === 'present' || item.status === 'excused'),
      late: studentHistory.filter((item) => item.status === 'late'),
      absent: studentHistory.filter((item) => item.status === 'absent'),
    }),
    [studentHistory]
  );

  // Handle Check-in Submission (supports async API handler)
  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCheckInSession) return;

    const cleanCode = inputCode.trim();
    if (!cleanCode) {
      setCheckInError('Please enter the session code to check in.');
      return;
    }

    setIsSubmittingCheckIn(true);
    setCheckInError('');
    try {
      const ok = onCheckIn ? await onCheckIn(activeCheckInSession.id, cleanCode) : false;
      if (!ok) {
        setCheckInError('Check-in failed. The code may be invalid, session closed, or you are not enrolled.');
        return;
      }

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const decidedStatus: AttendanceStatus = 'present';

      // On success, display success message. Parent should refresh sessions/hx.
      setCheckInSuccess({ status: decidedStatus, time: nowTime, courseCode: activeCheckInSession.courseCode });
      setCheckInError('');
    } catch (err: any) {
      setCheckInError(err?.message || String(err) || 'Check-in failed.');
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  const handleOneTapCheckIn = async (session: AttendanceSession) => {
    setOneTapPendingId(session.id);
    setOneTapMessage((previous) => ({ ...previous, [session.id]: '' }));
    try {
      const ok = onCheckIn ? await onCheckIn(session.id, '') : false;
      if (!ok) {
        throw new Error('Không thể điểm danh phiên này.');
      }
      setOneTapMessage((previous) => ({ ...previous, [session.id]: 'Điểm danh thành công.' }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setOneTapMessage((previous) => ({ ...previous, [session.id]: message }));
    } finally {
      setOneTapPendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
              Student Attendance Portal
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                studentStats.isEligible
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {studentStats.isEligible ? 'Eligible for Final Exams (≥80%)' : 'Disqualification Alert (<80%)'}
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            Academic Attendance & Verification
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track live check-in sessions, review official semester standing, and audit your verified attendance logs.
          </p>
        </div>

        {/* 3 Explicit Navigation Tabs as Requested */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 text-xs font-bold">
          <button
            id="tab-attendance-sessions"
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
              activeTab === 'sessions'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Attendance Sessions
            {activeSessions.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            id="tab-attendance-status"
            type="button"
            onClick={() => setActiveTab('status')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
              activeTab === 'status'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Attendance Status
          </button>

          <button
            id="tab-attendance-history"
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Attendance History
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ATTENDANCE SESSIONS (Active & Scheduled) */}
      {/* ========================================================================= */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {/* Active Sessions Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">
                  Phiên điểm danh đang mở
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {activeSessions.length} session{activeSessions.length === 1 ? '' : 's'} available
              </span>
            </div>

            {activeSessions.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No live attendance sessions in progress right now.</p>
                <p className="text-slate-400 mt-1">
                  Trạng thái sẽ được cập nhật sau khi giảng viên điểm danh thủ công.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSessions.map((session) => {
                  const myRecord = getMyRecord(session);
                  const status = myRecord?.status || 'absent';

                  return (
                    <div
                      key={session.id}
                      id={`session-card-${session.id}`}
                      className="bg-white rounded-2xl border-2 border-indigo-500/80 shadow-sm p-5 relative overflow-hidden flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-md text-[11px]">
                              {session.courseCode}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              Đang chờ điểm danh
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm mt-2">
                            {session.sessionTitle}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">{session.courseTitle}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{session.startTime} - {session.endTime}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{session.room}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        {status !== 'absent' ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold ${
                                myRecord?.status === 'present' || myRecord?.status === 'excused'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              {status === 'present' || status === 'excused' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                              )}
                              {status === 'present' || status === 'excused' ? 'Có mặt' : 'Đi muộn'}
                              {myRecord?.checkInTime ? ` (${myRecord.checkInTime})` : ''}
                            </span>
                            {myRecord?.warning && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs" title={myRecord.warning}>
                                <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>{myRecord.warning.includes('khác') || myRecord.warning.includes('Wi-Fi') ? '⚠ Khác Wi-Fi / IP' : myRecord.warning}</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                              Chưa điểm danh
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (session.attendanceMethod === 'QR') {
                                  void handleOneTapCheckIn(session);
                                  return;
                                }
                                setActiveCheckInSession(session);
                                setInputCode('');
                                setCheckInError('');
                                setCheckInSuccess(null);
                              }}
                              disabled={oneTapPendingId === session.id}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                            >
                              {session.attendanceMethod === 'QR'
                                ? <Check className="w-3.5 h-3.5" />
                                : <KeyRound className="w-3.5 h-3.5" />}
                              {oneTapPendingId === session.id
                                ? 'Đang gửi...'
                                : session.attendanceMethod === 'QR' ? 'ĐIỂM DANH' : 'Điểm danh ngay'}
                            </button>
                          </div>
                        )}
                      </div>
                      {oneTapMessage[session.id] && (
                        <p className={`mt-2 text-xs font-semibold ${
                          oneTapMessage[session.id] === 'Điểm danh thành công.' ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {oneTapMessage[session.id]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Scheduled Sessions */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">
                Upcoming Scheduled Sessions
              </h3>
              <span className="text-xs text-slate-500">{scheduledSessions.length} upcoming</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              {scheduledSessions.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No upcoming sessions scheduled in the immediate timetable.
                </div>
              ) : (
                scheduledSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-extrabold flex flex-col items-center justify-center text-[10px] leading-tight shrink-0 border border-slate-200">
                        <span>{session.date.slice(8)}</span>
                        <span className="uppercase text-[9px] text-slate-500 font-semibold">
                          {new Date(session.date).toLocaleString('default', { month: 'short' })}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {session.courseCode}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{session.sessionTitle}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          {session.lecturerName} • {session.room}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center text-xs text-slate-500">
                      <span>{session.startTime} - {session.endTime}</span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-semibold text-[10px] uppercase border border-slate-200">
                        Scheduled
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ATTENDANCE STATUS (Overall & Breakdown) */}
      {/* ========================================================================= */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          {/* Top KPI Cards (Present, Late, Absent) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Overall Rate
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span
                  className={`text-3xl font-black ${
                    studentStats.isEligible ? 'text-slate-900' : 'text-rose-600'
                  }`}
                >
                  {studentStats.rate}%
                </span>
                <span className="text-[11px] text-slate-400">/ 80% req.</span>
              </div>
              <div className="mt-2">
                <Badge variant={studentStats.isEligible ? 'emerald' : 'rose'} size="sm">
                  {studentStats.isEligible ? 'Exam Eligible' : 'At-Risk Warning'}
                </Badge>
              </div>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                  Present
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-3xl font-black text-emerald-800 mt-1">{studentStats.present}</p>
              <span className="text-[11px] text-emerald-700 font-medium block mt-1">
                Verified on-time check-ins
              </span>
            </div>

            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                  Late
                </span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-3xl font-black text-amber-800 mt-1">{studentStats.late}</p>
              <span className="text-[11px] text-amber-700 font-medium block mt-1">
                Arrived after threshold
              </span>
            </div>

            <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                  Absent
                </span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-3xl font-black text-rose-800 mt-1">{studentStats.absent}</p>
              <span className="text-[11px] text-rose-700 font-medium block mt-1">
                Missed class sessions
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {([
              {
                key: 'present' as const,
                title: 'Danh sách có mặt',
                empty: 'Chưa có phiên được đánh dấu có mặt.',
                panel: 'bg-emerald-50/60 border-emerald-200',
                heading: 'text-emerald-800',
                icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
              },
              {
                key: 'late' as const,
                title: 'Danh sách đi muộn',
                empty: 'Chưa có phiên được đánh dấu đi muộn.',
                panel: 'bg-amber-50/60 border-amber-200',
                heading: 'text-amber-800',
                icon: <Clock className="w-4 h-4 text-amber-600" />,
              },
              {
                key: 'absent' as const,
                title: 'Danh sách vắng mặt',
                empty: 'Chưa có phiên được đánh dấu vắng mặt.',
                panel: 'bg-rose-50/60 border-rose-200',
                heading: 'text-rose-800',
                icon: <XCircle className="w-4 h-4 text-rose-600" />,
              },
            ]).map((group) => (
              <div key={group.key} className={`rounded-2xl border shadow-2xs overflow-hidden ${group.panel}`}>
                <div className="px-4 py-3 border-b border-white/70 flex items-center justify-between">
                  <div className={`flex items-center gap-2 text-sm font-bold ${group.heading}`}>
                    {group.icon}
                    {group.title}
                  </div>
                  <span className={`text-xs font-black ${group.heading}`}>{statusLists[group.key].length}</span>
                </div>
                <div className="divide-y divide-white/80 bg-white/50">
                  {statusLists[group.key].length === 0 ? (
                    <p className="px-4 py-5 text-xs text-slate-500">{group.empty}</p>
                  ) : (
                    statusLists[group.key].map((item) => (
                      <div key={`${group.key}-${item.sessionId}`} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-900">{item.courseCode}</span>
                          <span className="text-[11px] text-slate-500">{item.date}</span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1 truncate">{item.sessionTitle || item.courseTitle}</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {item.startTime} - {item.endTime}
                          {item.room ? ` • ${item.room}` : ''}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-900">Danh sách kết quả điểm danh</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kết quả được cập nhật theo từng ca học sau khi giảng viên điểm danh.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Ngày</th>
                    <th className="px-4 py-3">Lớp học</th>
                    <th className="px-4 py-3">Ca học</th>
                    <th className="px-4 py-3">Phòng</th>
                    <th className="px-4 py-3 text-center">Kết quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Chưa có kết quả điểm danh.
                      </td>
                    </tr>
                  ) : (
                    studentHistory.map((item) => {
                      const isPresent = item.status === 'present' || item.status === 'excused';
                      const statusLabel =
                        isPresent
                          ? 'Có mặt'
                          : item.status === 'late'
                            ? 'Đi muộn'
                            : 'Vắng mặt';
                      const statusClass =
                        isPresent
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : item.status === 'late'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-rose-100 text-rose-800 border-rose-200';
                      return (
                        <tr key={`result-${item.sessionId}`} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 text-slate-700">{item.date}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-indigo-700">{item.courseCode}</span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">{item.courseTitle}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <span className="font-semibold">{item.sessionTitle}</span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">
                              {item.startTime} - {item.endTime}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.room || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass}`}>
                              {isPresent ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : item.status === 'late' ? (
                                <Clock className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-Course Breakdown Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Course Attendance Breakdown & Requirements
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Academic policy requires at least 80.0% attendance in each course for final exam admission.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {visibleAttendanceData.map((item) => {
                const isWarning = item.attendanceExceeded ?? item.percentage < item.minRequiredPercentage;

                return (
                  <div
                    key={item.courseCode}
                    id={`attendance-status-${item.courseCode}`}
                    className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 max-w-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {item.courseCode}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{item.courseTitle}</h4>
                      </div>
                      <p className="text-xs text-slate-500">
                        {item.attendedSessions} of {item.totalSessions} sessions attended • Req: {item.minRequiredPercentage}%
                      </p>
                    </div>

                    {/* Status Progress Bar */}
                    <div className="flex-1 max-w-xs space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700">Tỷ lệ học phần:</span>
                        <span
                          className={`font-black ${
                            isWarning ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          {item.percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isWarning ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* 3 Explicit Status Counters for this course */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-200">
                        Present: {item.attendedSessions}
                      </span>
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-bold rounded-lg border border-amber-200">
                        Late: {item.lateSessions}
                      </span>
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-800 font-bold rounded-lg border border-rose-200">
                        Absent: {item.absentSessions}
                      </span>
                    </div>

                    {/* Eligibility Badge & Recent Sessions */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge variant={isWarning ? 'rose' : 'emerald'} size="sm">
                        {isWarning ? 'Vắng quá 20% (Cấm thi)' : 'Đủ điều kiện dự thi'}
                      </Badge>
                      {item.recentSessions && item.recentSessions.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {item.recentSessions.slice(0, 3).map((rs, idx) => (
                            <span
                              key={idx}
                              title={`${rs.date}: ${rs.topic || ''}`}
                              className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${
                                rs.status === 'present' || rs.status === 'excused'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : rs.status === 'late'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {rs.date.slice(5)}: {rs.status === 'present' || rs.status === 'excused' ? 'Có mặt' : rs.status === 'late' ? 'Muộn' : 'Vắng'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ATTENDANCE HISTORY (Chronological Log) */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* History Search and Filter Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search history by topic, course, or date..."
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Filter by Attendance Status (Present / Late / Absent) */}
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                {(['all', 'present', 'late', 'absent'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setHistoryStatusFilter(status)}
                    className={`px-3 py-1 rounded-lg capitalize text-[11px] font-bold transition-colors ${
                      historyStatusFilter === status
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Course Selector Filter */}
              <select
                value={historyCourseFilter}
                onChange={(e) => setHistoryCourseFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Courses</option>
                {visibleAttendanceData.map((course) => (
                  <option key={course.courseCode} value={course.courseCode}>{course.courseCode}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Chronological History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Ngày học</th>
                    <th className="px-5 py-3.5">Học phần</th>
                    <th className="px-5 py-3.5">Bài giảng / chủ đề</th>
                    <th className="px-5 py-3.5">Phòng học</th>
                    <th className="px-5 py-3.5">Thời gian điểm danh</th>
                    <th className="px-5 py-3.5">Phương thức</th>
                    <th className="px-5 py-3.5 text-right">Trạng thái điểm danh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400 text-xs">
                        No attendance history records match your selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => {
                      const status = item.status;

                      return (
                        <tr
                          key={item.sessionId}
                          id={`history-row-${item.sessionId}`}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="px-5 py-3.5 font-medium text-slate-700 whitespace-nowrap">
                            {item.date}
                          </td>

                          <td className="px-5 py-3.5 font-bold text-indigo-700 whitespace-nowrap">
                            {item.courseCode}
                          </td>

                          <td className="px-5 py-3.5 font-medium text-slate-900 max-w-xs truncate">
                            {item.sessionTitle}
                          </td>

                          <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                            {item.room}
                          </td>

                          <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                            {item.checkInTime ? (
                              <span className="font-semibold text-slate-800">{item.checkInTime}</span>
                            ) : (
                              <span className="text-slate-400 italic">Chưa điểm danh</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5">
                            {item.method ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                {item.method}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Attendance Status (Present, Late, Absent) */}
                          <td className="px-5 py-3.5 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold ${
                                status === 'present' || status === 'excused'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : status === 'late'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            >
                              {(status === 'present' || status === 'excused') && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                              {status === 'late' && <Clock className="w-3 h-3 text-amber-600" />}
                              {status === 'absent' && <XCircle className="w-3 h-3 text-rose-600" />}
                              {status === 'present' || status === 'excused' ? 'Có mặt' : status === 'late' ? 'Đi muộn' : 'Vắng mặt'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* History Summary Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
              <span>Showing {filteredHistory.length} total attendance session records</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present: {studentStats.present}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Late: {studentStats.late}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Absent: {studentStats.absent}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHECK-IN MODAL (With PIN code & QR Scan) */}
      {/* ========================================================================= */}
      {activeCheckInSession && (
        <Modal
          isOpen={!!activeCheckInSession}
          onClose={() => {
            setActiveCheckInSession(null);
            setCheckInSuccess(null);
          }}
          title={`Classroom Attendance Check-In: ${activeCheckInSession.courseCode}`}
          subtitle={`${activeCheckInSession.room} • ${activeCheckInSession.sessionTitle}`}
          maxWidth="md"
        >
          {checkInSuccess ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">
                  Check-In Verified Successfully!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  You have been recorded as{' '}
                  <strong className="text-emerald-700 uppercase font-extrabold">
                    {checkInSuccess.status}
                  </strong>{' '}
                  at {checkInSuccess.time} in {activeCheckInSession.room}.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCheckInSession(null);
                    setCheckInSuccess(null);
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Class:</span>
                  <span className="text-slate-900">{activeCheckInSession.courseCode} - {activeCheckInSession.courseTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span>Room / Hall:</span>
                  <span className="text-slate-900 font-medium">{activeCheckInSession.room}</span>
                </div>
                <div className="flex justify-between">
                  <span>Giảng viên:</span>
                  <span className="text-slate-900 font-medium">{activeCheckInSession.lecturerName}</span>
                </div>
              </div>

              {/* Method 1: Enter Room PIN */}
              <form onSubmit={handleCheckInSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Enter Classroom PIN / Session Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RAFT-894"
                    value={inputCode}
                    onChange={(e) => {
                      setInputCode(e.target.value);
                      setCheckInError('');
                    }}
                    className="w-full px-3.5 py-2.5 text-center font-mono text-lg font-bold uppercase tracking-widest border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    autoFocus
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block text-center">
                    Enter the code projected on the classroom smart board (e.g. <code>RAFT-894</code>)
                  </span>
                </div>

                {checkInError && (
                  <div className="p-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{checkInError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  Verify PIN & Submit Attendance
                </button>
              </form>

            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
