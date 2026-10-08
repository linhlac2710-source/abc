/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Role,
  UserProfile,
  Course,
  ScheduleItem,
  Assignment,
  AssignmentSubmission,
  ClassJoinRequest,
  AttendanceSession,
  AttendanceStatus,
  AttendanceRecord,
  GradeWeightConfig,
  GradeItem,
  SystemStatSummary,
  EnrolledStudentProfile,
} from './types';
import {
  calculateOverallScore,
  getLetterGrade,
  getGradePoints,
  getGradeStatus,
  DEFAULT_GRADE_WEIGHTS,
} from './utils/gradeCalculations';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { StudentDashboard } from './components/student/StudentDashboard';
import { LecturerDashboard } from './components/lecturer/LecturerDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { LoginPage } from './components/auth/LoginPage';
import { getAuthToken, setAuthToken } from './api/client';
import { AuthAPI } from './api/auth';
import { UsersAPI } from './api/users';
import { AttendanceAPI, AttendanceRecordResponse, AttendanceSessionResponse } from './api/attendance';
import { AssignmentsAPI } from './api/assignments';
import { ClassesAPI, LecturerAccount } from './api/classes';
import { CurriculumAPI } from './api/curriculum';
import { EnrollmentsAPI } from './api/enrollments';
import { NotificationsAPI, ClassAssignmentRequest } from './api/notifications';
import { SchedulesAPI } from './api/schedules';
import { GradesAPI, GradeRecord, ClassStudentResult } from './api/grades';
import { hasClassScheduleConflict } from './utils/scheduleConflictDetector';

export default function App() {
  // Helper to normalize enrollment status from backend to frontend union
  const mapEnrollStatus = (s: any): ClassJoinRequest['status'] => {
    const v = String(s || '').toLowerCase();
    if (v.includes('approve') || v === 'approved' || v === 'enrolled') return 'approved';
    if (v.includes('reject') || v === 'rejected') return 'rejected';
    return 'pending';
  };

  const schedulePayload = (item: ScheduleItem) => ({
    class_id: Number(courses.find((course) => course.code === item.courseCode || course.class_code === item.courseCode)?.id),
    day_of_week: item.dayOfWeek?.toUpperCase(),
    start_time: item.startTime,
    end_time: item.endTime,
    date: item.date || '',
    room: item.room,
    building: item.building,
    topic: item.sessionTopic,
    type: item.type,
    semester: courses.find((c) => c.code === item.courseCode || c.class_code === item.courseCode)?.semester || 'Fall 2026',
  });

  const refreshClassSchedule = async (classId: number) => {
    const classDetail = await ClassesAPI.detail(classId);
    setCourses((prev) =>
      prev.map((course) =>
        String(course.id) === String(classId)
          ? { ...course, schedule: classDetail.schedule || '', room: classDetail.room || '' }
          : course
      )
    );
  };

  const handleLecturerCreateSchedule = async (item: ScheduleItem): Promise<void> => {
    setScheduleError(null);
    try {
      const course = courses.find((c) => c.code === item.courseCode || c.class_code === item.courseCode);
      const classId = Number(course?.id);
      if (!Number.isFinite(classId)) throw new Error(`Class not found for ${item.courseCode}`);
      await SchedulesAPI.createForClass(classId, schedulePayload(item));
      await refreshSchedules();
      await refreshClassSchedule(classId);
    } catch (err: any) {
      setScheduleError(err?.message || String(err));
      throw err;
    }
  };

  const handleLecturerUpdateSchedule = async (item: ScheduleItem): Promise<void> => {
    const scheduleId = Number(item.id);
    if (!Number.isFinite(scheduleId)) throw new Error('Mã lịch học không hợp lệ');
    try {
      const previousSchedule = schedule.find((entry) => entry.id === item.id);
      const previousClass = courses.find((course) =>
        course.code === previousSchedule?.courseCode || course.class_code === previousSchedule?.courseCode
      );
      const nextClassId = Number(schedulePayload(item).class_id);
      if (!Number.isFinite(nextClassId) || nextClassId <= 0) throw new Error(`Không tìm thấy lớp ${item.courseCode}`);
      await SchedulesAPI.updateSchedule(scheduleId, schedulePayload(item));
      await refreshSchedules();
      if (previousClass) await refreshClassSchedule(Number(previousClass.id));
      if (!previousClass || Number(previousClass.id) !== nextClassId) await refreshClassSchedule(nextClassId);
    } catch (err: any) {
      setScheduleError(err?.message || String(err));
      throw err;
    }
  };

  const handleLecturerDeleteSchedule = async (scheduleId: string): Promise<void> => {
    const id = Number(scheduleId);
    if (!Number.isFinite(id)) throw new Error('Mã lịch học không hợp lệ');
    try {
      const deletedSchedule = schedule.find((entry) => entry.id === scheduleId);
      const deletedClass = courses.find((course) =>
        course.code === deletedSchedule?.courseCode || course.class_code === deletedSchedule?.courseCode
      );
      await SchedulesAPI.deleteSchedule(id);
      await refreshSchedules();
      if (deletedClass) await refreshClassSchedule(Number(deletedClass.id));
    } catch (err: any) {
      setScheduleError(err?.message || String(err));
      throw err;
    }
  };
  
  const findClassIdByCourseCode = (courseCode: string): number | null => {
    const found = courses.find(
      (c) => (c.code && String(c.code).toLowerCase() === String(courseCode).toLowerCase()) || (c.class_code && String(c.class_code).toLowerCase() === String(courseCode).toLowerCase())
    );
    if (!found) return null;
    const n = Number(found.id);
    return Number.isFinite(n) ? n : null;
  };

  // Refresh schedules for lecturer
  const refreshSchedules = async () => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const sch = await SchedulesAPI.mySchedules();
      const mapTime = (value: unknown) => {
        const text = String(value || '');
        return text.length > 5 ? text.slice(11, 16) : text.slice(0, 5);
      };
      const mappedSch = (sch || []).map((s: any) => ({
        id: String(s.schedule_id || s.id),
        courseCode: s.class_code || s.course_code || '',
        courseTitle: s.class_name || s.course_name || '',
        lecturerName: s.lecturer_name || currentUser?.full_name || '',
        room: s.room || '',
        building: s.building || '',
        startTime: mapTime(s.start_time),
        endTime: mapTime(s.end_time),
        date: s.date || '',
        classStartDate: s.class_start_date || '',
        classDurationWeeks: Number(s.class_duration_weeks || 0),
        dayOfWeek: s.day_of_week || undefined,
        type: (s.type || 'Lecture') as ScheduleItem['type'],
        status: (s.status || 'upcoming') as ScheduleItem['status'],
        sessionTopic: s.topic || s.session_topic || '',
        checkInCode: s.check_in_code || s.checkInCode || '',
      })) as ScheduleItem[];
      setSchedule(mappedSch);
    } catch (err: any) {
      setScheduleError(err?.message || String(err));
    } finally {
      setScheduleLoading(false);
    }
  };

  const refreshAssignmentRequests = async () => {
    setAssignmentRequestLoading(true);
    setAssignmentRequestError(null);
    try {
      setAssignmentRequests(await NotificationsAPI.listClassAssignments());
    } catch (err) {
      setAssignmentRequestError(err instanceof Error ? err.message : String(err));
    } finally {
      setAssignmentRequestLoading(false);
    }
  };

  const handleApproveClassAssignment = async (requestId: number) => {
    try {
      await NotificationsAPI.approveClassAssignment(requestId);
      const approvedRequest = assignmentRequests.find((request) => request.id === requestId);
      if (approvedRequest) {
        setCourses((prev) =>
          prev.map((course) =>
            String(course.id) === String(approvedRequest.class_id)
              ? { ...course, classStatus: 'active' }
              : course,
          ),
        );
      }
      await refreshAssignmentRequests();
      await refreshSchedules();
    } catch (err) {
      setAssignmentRequestError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRejectClassAssignment = async (requestId: number) => {
    try {
      await NotificationsAPI.rejectClassAssignment(requestId);
      const rejectedRequest = assignmentRequests.find((request) => request.id === requestId);
      if (rejectedRequest) {
        setCourses((prev) =>
          prev.map((course) =>
            String(course.id) === String(rejectedRequest.class_id)
              ? { ...course, classStatus: 'rejected' }
              : course,
          ),
        );
      }
      await refreshAssignmentRequests();
      await refreshSchedules();
    } catch (err) {
      setAssignmentRequestError(err instanceof Error ? err.message : String(err));
    }
  };

  const attendanceDeletedSessionStorageKey = 'smart-classroom-deleted-attendance-session-ids';
  const getDeletedAttendanceSessionIds = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(attendanceDeletedSessionStorageKey);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item)) : []);
    } catch {
      return new Set();
    }
  };
  const persistDeletedAttendanceSessionIds = (ids: Set<string>) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(attendanceDeletedSessionStorageKey, JSON.stringify([...ids]));
    } catch {
      // Ignore storage quota issues.
    }
  };
  const filterVisibleAttendanceSessions = (sessions: AttendanceSession[]) =>
    sessions.filter((session) => !deletedAttendanceSessionIdsRef.current.has(String(session.id)));

  // Refresh attendance sessions for lecturer & student
  const refreshAttendanceSessions = async (classList: Course[] = courses) => {
    setAttendanceLoading(true);
    setAttendanceError(null);
    try {
      const activeList = classList && classList.length > 0 ? classList : courses;
      const sessionsByClass = await Promise.all(
        activeList
          .map((course) => Number(course.id))
          .filter((id) => Number.isFinite(id) && id > 0)
          .map(async (classId) => ({
            classId,
            sessions: await AttendanceAPI.listClassSessions(classId).catch(() => []),
          }))
      );
      const sessionEntries = sessionsByClass.flatMap(({ classId, sessions }) =>
        (sessions || []).map((session) => ({ classId, session }))
      );
      const mapped = await Promise.all(
        sessionEntries.map(async ({ classId, session }) => {
          const effectiveClassId = session.class_id || classId;
          const course = activeList.find((c) => String(c.id) === String(effectiveClassId));
          const records = await AttendanceAPI.getSessionRecords(session.id).catch(() => []);
          try {
            return mapAttendanceSession(session, course, records);
          } catch {
            return null;
          }
        })
      );
      const filteredMapped = filterVisibleAttendanceSessions(
        mapped.filter((session): session is AttendanceSession => session !== null)
      );
      const latestByOccurrence = new Map<string, AttendanceSession>();
      filteredMapped.forEach((session) => {
        const key = `${session.courseId}|${session.date}|${session.startTime}|${session.endTime}`;
        const existing = latestByOccurrence.get(key);
        if (!existing || String(session.id) > String(existing.id)) {
          latestByOccurrence.set(key, session);
        }
      });
      setAttendanceSessions(Array.from(latestByOccurrence.values()));
    } catch (err: any) {
      setAttendanceError(err?.message || String(err));
    } finally {
      setAttendanceLoading(false);
    }
  };

  const latestCreatedSessionPinRef = useRef<{ courseId: number; date: string; startTime: string; endTime: string; pin: string } | null>(null);
  const deletedAttendanceSessionIdsRef = useRef<Set<string>>(getDeletedAttendanceSessionIds());

  const mapAttendanceSession = (
    session: AttendanceSessionResponse,
    course: Course | undefined,
    records: AttendanceRecordResponse[]
  ): AttendanceSession => {
    const startTime = String(session.start_time || '');
    const expiresAt = String(session.expires_at || '');
    if (!startTime || !expiresAt) {
      throw new Error('Attendance session is missing its time range.');
    }
    const isQrSession = session.attendance_method === 'QR';
    const startDate = new Date(startTime);
    const endDate = new Date(expiresAt);
    const localParts = (date: Date) => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(date);
      return Object.fromEntries(parts.map((part) => [part.type, part.value]));
    };
    const localStart = isQrSession ? localParts(startDate) : null;
    const localEnd = isQrSession ? localParts(endDate) : null;
    const lateGraceMinutes = Number((session as any).late_minutes ?? (session as any).allow_late_minutes ?? 15);
    const qrToken = String((session as any).qr_token || '').trim();
    const overridePin = latestCreatedSessionPinRef.current &&
      Number(session.class_id) === latestCreatedSessionPinRef.current.courseId &&
      startTime.slice(0, 10) === latestCreatedSessionPinRef.current.date &&
      startTime.slice(11, 16) === latestCreatedSessionPinRef.current.startTime &&
      expiresAt.slice(11, 16) === latestCreatedSessionPinRef.current.endTime
      ? latestCreatedSessionPinRef.current.pin
      : qrToken;

    return {
      id: String(session.id),
      courseId: String(session.class_id),
      courseCode: course?.code || course?.class_code || '',
      courseTitle: course?.title || course?.class_name || '',
      lecturerId: String(currentUser?.id || ''),
      lecturerName: currentUser?.full_name || '',
      sessionTitle: (session as any).title || 'Phiên Attendance',
      date: localStart
        ? `${localStart.year}-${localStart.month}-${localStart.day}`
        : startTime.slice(0, 10),
      startTime: localStart ? `${localStart.hour}:${localStart.minute}` : startTime.slice(11, 16),
      endTime: localEnd ? `${localEnd.hour}:${localEnd.minute}` : expiresAt.slice(11, 16),
      room: '',
      status: session.status === 'UPCOMING'
        ? 'scheduled'
        : session.status === 'LOCKED'
          ? 'closed'
          : session.is_active ? 'active' : 'closed',
      sessionStatus: session.status,
      attendanceMethod: session.attendance_method || 'MANUAL',
      sessionCode: session.session_code || undefined,
      checkInCode: isQrSession ? '' : overridePin || 'ATTENDANCEPIN',
      allowLateMinutes: Number.isFinite(lateGraceMinutes) && lateGraceMinutes > 0 ? lateGraceMinutes : 15,
      createdAt: session.created_at || startTime,
      records: records.map((record) => ({
        id: String(record.id),
        sessionId: String(record.session_id),
        studentId: String(record.student_id || record.student_code),
        studentName: record.student_name || '',
        studentEmail: '',
        status: normalizeAttendanceStatus(record.status),
        checkInTime: record.check_in_time,
        method: record.attendance_method === 'QR' ? 'qr' : record.attendance_method === 'MANUAL' ? 'manual' : undefined,
        warning: record.warning || undefined,
        notes: record.warning || undefined,
      })),
    };
  };

  const normalizeAttendanceStatus = (status: string): AttendanceStatus => {
    const normalized = (status || '').toLowerCase();
    return normalized === 'late' ? 'late' : normalized === 'absent' ? 'absent' : normalized === 'excused' ? 'excused' : 'present';
  };

  const getAttendanceWindow = (session: AttendanceSession) => {
    const start = new Date(`${session.date}T${session.startTime}:00`);
    const graceDeadline = new Date(start.getTime() + (Number(session.allowLateMinutes || 15) * 60 * 1000));
    return { start, graceDeadline };
  };

  const getCurrentStudentAttendanceId = () => {
    if (!currentUser) return '';
    return String(currentUser.student_id || currentUser.studentId || currentUser.id || '');
  };

  const normalizeAttendancePin = (value: string) =>
    String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

  // Refresh assignments for lecturer by listing assignments per class
  const assignmentsRefreshVersion = useRef(0);
  const refreshAssignments = async (classList: Course[] = courses) => {
    if (classList.length === 0) return;
    const refreshVersion = ++assignmentsRefreshVersion.current;
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    try {
      const all: Assignment[] = [];
      for (const c of classList) {
        const classIdNum = Number(c.id);
        if (!Number.isFinite(classIdNum) || classIdNum <= 0) continue;
        const lst = await AssignmentsAPI.listForClass(classIdNum);
        for (const a of lst || []) {
          const assignmentId = Number(a.id || a.assignment_id);
          const submissions = Number.isFinite(assignmentId)
            ? await AssignmentsAPI.submissions(assignmentId)
            : [];
          const normalizedSubmissions = (submissions || []).map((s: any) => ({
            id: String(s.id),
            assignmentId: String(s.assignment_id),
            studentId: String(s.student_code || s.student_id),
            studentName: s.student_name || '',
            studentEmail: '',
            submittedAt: s.submitted_at || '',
            fileName: s.content || '',
            status: s.status === 'GRADED' ? 'graded' : s.status === 'LATE' ? 'late' : s.status === 'MISSING' ? 'missing' : 'submitted',
            score: s.score ?? undefined,
            maxScore: Number(a.max_score || 10),
          })) as AssignmentSubmission[];
          const submittedCount = normalizedSubmissions.filter((s) => s.status !== 'missing').length;
          const pendingCount = normalizedSubmissions.filter((s) => s.status === 'submitted' || s.status === 'late').length;
          all.push({
              id: String(a.id || a.assignment_id),
              courseId: String(classIdNum),
              courseCode: a.class_code || c.code || c.class_code || '',
              courseTitle: a.class_name || c.title || c.class_name || '',
              title: a.title || a.name || '',
              description: a.description || '',
              dueDate: a.deadline || a.due_date || a.due || '',
              weightPercent: Number(a.weight || a.weight_percent || 0),
              maxScore: Number(a.max_score || a.maxScore || 10),
              status: (a.status || 'pending') as Assignment['status'],
              totalSubmissions: Number(a.total_submissions ?? a.totalSubmissions ?? submittedCount),
              pendingGradingCount: Number(a.pending_count ?? a.pendingGradingCount ?? pendingCount),
              submissions: normalizedSubmissions,
            });
        }
      }
      if (refreshVersion === assignmentsRefreshVersion.current) {
        setAssignments(all);
      }
    } catch (err: any) {
      setAssignmentsError(err?.message || String(err));
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const refreshStudentAssignments = async () => {
    try {
      const enrollments = await EnrollmentsAPI.my();
      const activeEnrollments = (enrollments || []).filter((item: any) => getApprovedEnrollmentIds([item]).length > 0);
      const classIds = [...new Set(activeEnrollments
        .map((enrollment: any) => Number(enrollment.class_id ?? enrollment.classId ?? enrollment.class?.id))
        .filter((classId) => Number.isFinite(classId) && classId > 0))];
      const loaded = (await Promise.all(classIds.map(async (classId) => {
        const classInfo = courses.find((course) => String(course.id) === String(classId));
        const items = await AssignmentsAPI.listForClass(classId);
        return Promise.all((items || []).map(async (item: any) => {
          let submission: any = null;
          try {
            submission = await AssignmentsAPI.mySubmission(Number(item.id));
          } catch (error) {
            if ((error as { status?: number })?.status !== 404) throw error;
          }
          const dueTime = Date.parse(item.deadline || '');
          const submittedTime = Date.parse(submission?.submitted_at || '');
          const submissionStatus = String(submission?.status || '').trim().toLowerCase();
          const isLate = Boolean(submission) && (
            submissionStatus === 'late' ||
            Number.isFinite(dueTime) && Number.isFinite(submittedTime) && submittedTime > dueTime
          );
          const status = submission
            ? submissionStatus === 'graded' ? 'graded' : isLate ? 'late' : 'submitted'
            : Number.isFinite(dueTime) && dueTime < Date.now() ? 'missing' : 'pending';
          return {
            id: String(item.id),
            courseId: String(classId),
            courseCode: classInfo?.code || classInfo?.class_code || '',
            courseTitle: classInfo?.title || classInfo?.class_name || '',
            title: item.title || '',
            description: item.description || '',
            startDate: item.start_date || '',
            durationWeeks: Number(item.duration_weeks || 0),
            dueDate: item.deadline || '',
            weightPercent: Number(item.weight_percent ?? item.weight ?? 0),
            maxScore: Number(item.max_score || 10),
            status,
            studentScore: submission?.score ?? undefined,
            feedback: submission?.feedback || '',
            submittedAt: submission?.submitted_at || '',
            totalSubmissions: submission ? 1 : 0,
            pendingGradingCount: 0,
            submissions: submission ? [{
              id: String(submission.id), assignmentId: String(item.id), studentId: String(submission.student_id),
              studentName: submission.student_name || '', studentEmail: '', submittedAt: submission.submitted_at || '',
              fileName: submission.content || '', status: status === 'graded' ? 'graded' : status === 'late' ? 'late' : 'submitted',
              score: submission.score ?? undefined, maxScore: Number(item.max_score || 10),
            }] : [],
          } as Assignment;
        }));
      }))).flat();
      setAssignments(loaded);
    } catch (err: any) {
      setAssignmentsError(err?.message || String(err));
    }
  };

  const refreshStudentGrades = async () => {
    if (currentRole !== 'student' || !currentUser) return;
    try {
      const enrollments = await EnrollmentsAPI.my();
      const activeClassIds = (enrollments || [])
        .filter((item: any) => getApprovedEnrollmentIds([item]).length > 0)
        .map((item: any) => Number(item.class_id ?? item.classId ?? item.class?.id))
        .filter((id) => Number.isFinite(id) && id > 0);

      const mapped = await Promise.all(activeClassIds.map(async (classId) => {
        const course = courses.find((item) => String(item.id) === String(classId));
        try {
          const result = await GradesAPI.myClassGrades(classId);
          const studentIdentifiers = new Set(
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
          );

          // Compute live attendance stats from attendanceSessions
          const classSessions = attendanceSessions.filter(
            (s) =>
              String(s.courseId) === String(classId) ||
              (course && (
                String(s.courseId) === String(course.id) ||
                String(s.courseCode).toLowerCase() === String(course.code || course.class_code).toLowerCase()
              ))
          );
          const uniqueSessions = Array.from(
            classSessions.reduce((map, session) => {
              const key = `${session.date}|${session.startTime}|${session.endTime}`;
              if (!map.has(key)) map.set(key, session);
              return map;
            }, new Map<string, AttendanceSession>())
            .values()
          );

          const recordedSessions = uniqueSessions.filter((session) => {
            if (session.status === 'closed') return true;
            return session.records?.some((record) => {
              const recordId = String(record.studentId || '').trim().toLowerCase();
              const recordName = String(record.studentName || '').trim().toLowerCase();
              return studentIdentifiers.has(recordId) || (recordName && studentIdentifiers.has(recordName));
            }) ?? false;
          });

          let pres = 0;
          let lt = 0;
          let abs = 0;
          let exc = 0;
          recordedSessions.forEach((session) => {
            const rec = session.records?.find((r) => {
              const rId = String(r.studentId || '').trim().toLowerCase();
              const rName = String(r.studentName || '').trim().toLowerCase();
              return studentIdentifiers.has(rId) || (rName && studentIdentifiers.has(rName));
            });
            if (rec) {
              const status = String(rec.status || '').toLowerCase();
              if (status === 'present') pres++;
              else if (status === 'late') lt++;
              else if (status === 'excused') {
                pres++;
                exc++;
              } else if (status === 'absent') abs++;
            } else {
              abs++;
            }
          });

          const totalSes = recordedSessions.length;
          const liveAttRate = totalSes > 0 ? Number((((pres + lt) / totalSes) * 100).toFixed(1)) : 100;
          const liveAbsCount = totalSes > 0 ? Math.max(0, totalSes - pres - lt) : 0;
          const liveAbsRate = totalSes > 0 ? Number(((liveAbsCount / totalSes) * 100).toFixed(1)) : 0;
          const liveExceeded = totalSes > 0 && (liveAbsCount / totalSes) > 0.2;

          const courseAtt = attendanceData.find(
            (a) =>
              String(a.courseCode).toLowerCase() === String(course?.code || course?.class_code).toLowerCase() ||
              String(a.courseCode).toLowerCase() === String(classId)
          );

          const effectiveTotal = totalSes > 0 ? totalSes : (courseAtt ? courseAtt.totalSessions : 18);
          const effectivePresent = totalSes > 0 ? pres : (courseAtt ? courseAtt.attendedSessions : pres);
          const effectiveLate = totalSes > 0 ? lt : (courseAtt ? courseAtt.lateSessions : lt);
          const effectiveAbsent = totalSes > 0 ? liveAbsCount : (courseAtt ? courseAtt.absentSessions : liveAbsCount);
          const effectiveRate = totalSes > 0
            ? liveAttRate
            : courseAtt && courseAtt.totalSessions > 0
            ? Number((((courseAtt.attendedSessions + courseAtt.lateSessions) / courseAtt.totalSessions) * 100).toFixed(1))
            : 90;
          const isExceeded = effectiveTotal > 0 && effectiveAbsent / effectiveTotal > 0.2;

          const liveAttendanceStats = totalSes > 0 ? {
            total: effectiveTotal,
            present: effectivePresent,
            late: effectiveLate,
            absent: effectiveAbsent,
            excused: exc,
            attendanceRate: Math.round(effectiveRate),
            absenceRate: effectiveTotal > 0 ? Math.round((effectiveAbsent / effectiveTotal) * 100) : 0,
            attendanceExceeded: isExceeded,
            attendanceScore: isExceeded ? 0 : effectiveRate,
          } : null;
          const attendanceStats = liveAttendanceStats || (result as any)?.attendance_stats || {
            total: effectiveTotal,
            present: effectivePresent,
            late: effectiveLate,
            absent: effectiveAbsent,
            excused: exc,
            attendanceRate: Math.round(effectiveRate),
            absenceRate: effectiveTotal > 0 ? Math.round((effectiveAbsent / effectiveTotal) * 100) : 0,
            attendanceExceeded: isExceeded,
            attendanceScore: isExceeded ? 0 : effectiveRate,
          };

          const rawOverall = Number(result?.aggregate_score ?? 0);
          const overallScore = rawOverall;
          const letter = getLetterGrade(overallScore);
          const gradePoints = getGradePoints(letter);
          const status = attendanceStats.attendanceExceeded
            ? { status: 'warning' as const, label: 'Vắng quá 20%' }
            : getGradeStatus(overallScore, overallScore > 0);

          const components: GradeItem['components'] = Array.isArray(result?.grades)
            ? result.grades.map((item: any) => {
                const isAtt = String(item.component || 'Component').toLowerCase().includes('attendance');
                return {
                  name: String(item.component || 'Component'),
                  key: isAtt
                    ? 'attendance'
                    : String(item.component || 'Component').toLowerCase().includes('assignment')
                    ? 'assignment'
                    : String(item.component || 'Component').toLowerCase().includes('quiz')
                    ? 'quiz'
                    : String(item.component || 'Component').toLowerCase().includes('midterm')
                    ? 'midterm'
                    : 'finalExam',
                  weight: isAtt ? 0 : Number(item.weight ?? 0),
                  score: isAtt ? (attendanceStats.attendanceScore ?? Number(item.score || 0)) : Number(item.score || 0),
                  maxScore: 100,
                };
              })
            : [];

          if (!components.some((c) => c.key === 'attendance')) {
            components.unshift({
              name: 'Attendance',
              key: 'attendance',
              weight: 0,
              score: attendanceStats.attendanceScore ?? 100,
              maxScore: 100,
            });
          }

          const courseKey = course?.code || course?.class_code || '';
          const configuredWeights = courseWeights[courseKey] || DEFAULT_GRADE_WEIGHTS;
          const weightFor = (key: NonNullable<GradeItem['components']>[number]['key'], fallback: number) =>
            components.find((component) => component.key === key)?.weight ?? fallback;
          const activeWeights: GradeWeightConfig = {
            attendance: 0,
            assignment: weightFor('assignment', configuredWeights.assignment),
            quiz: weightFor('quiz', configuredWeights.quiz),
            midterm: weightFor('midterm', configuredWeights.midterm),
            finalExam: weightFor('finalExam', configuredWeights.finalExam),
          };

          return {
            id: String(classId),
            courseCode: course?.code || course?.class_code || '',
            courseTitle: course?.title || course?.class_name || '',
            credits: Number(course?.credits || 3),
            components,
            attendanceScore: attendanceStats.attendanceScore ?? (components.find((item) => item.key === 'attendance')?.score ?? 100),
            assignmentScore: components.find((item) => item.key === 'assignment')?.score ?? 0,
            quizScore: components.find((item) => item.key === 'quiz')?.score ?? 0,
            midtermScore: components.find((item) => item.key === 'midterm')?.score ?? 0,
            finalScore: components.find((item) => item.key === 'finalExam')?.score ?? null,
            currentPercentage: overallScore,
            letterGrade: letter,
            gradePoints,
            classAverage: overallScore,
            weights: activeWeights,
            gradeStatus: status.status,
            gradeStatusLabel: status.label,
            attendanceStats,
          } as GradeItem;
        } catch {
          return null;
        }
      }));

      setGrades(mapped.filter(Boolean) as GradeItem[]);
    } catch {
      setGrades([]);
    }
  };

  const handleLecturerCreateAssignment = async (newAsg: Omit<Assignment, 'id'>): Promise<void> => {
    setAssignmentsError(null);
    try {
      const classId = Number(newAsg.courseId);
      if (!Number.isFinite(classId)) throw new Error('Invalid class id for assignment creation');
      const created = await AssignmentsAPI.create(classId, {
        title: newAsg.title,
        description: newAsg.description,
        deadline: newAsg.dueDate.replace(' ', 'T'),
        max_score: newAsg.maxScore,
        weight: newAsg.weightPercent,
      });
      setAssignments((previous) => [
        ...previous,
        { ...newAsg, id: String(created.id), status: 'pending', submissions: [] },
      ]);
      await refreshAssignments();
    } catch (err: any) {
      setAssignmentsError(err?.message || String(err));
      throw err;
    }
  };

  const handleLecturerUpdateAssignment = async (assignment: Assignment): Promise<void> => {
    const id = Number(assignment.id);
    if (!Number.isFinite(id)) throw new Error('Invalid assignment id');
    try {
      await AssignmentsAPI.update(id, {
        title: assignment.title,
        description: assignment.description,
        deadline: assignment.dueDate.replace(' ', 'T'),
        weight: assignment.weightPercent,
      });
      await refreshAssignments();
    } catch (err: any) {
      setAssignmentsError(err?.message || String(err));
      throw err;
    }
  };

  const handleLecturerDeleteAssignment = async (assignmentId: string): Promise<void> => {
    const id = Number(assignmentId);
    if (!Number.isFinite(id)) throw new Error('Invalid assignment id');
    try {
      await AssignmentsAPI.delete(id);
      await refreshAssignments();
    } catch (err: any) {
      setAssignmentsError(err?.message || String(err));
      throw err;
    }
  };
  // Authentication & Role State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentRole, setCurrentRole] = useState<Role>('student');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Data Collections
  const [courses, setCourses] = useState<Course[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [courseWeights, setCourseWeights] = useState<Record<string, GradeWeightConfig>>({});
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [riskFactors, setRiskFactors] = useState<any[]>([]);
  const [learningPaths, setLearningPaths] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<SystemStatSummary>({
    totalStudents: 0,
    totalLecturers: 0,
    totalCourses: 0,
    overallAttendanceRate: 0,
    smartClassroomsActive: 0,
    totalSmartClassrooms: 0,
    iotDevicesOnline: 0,
    iotTotalDevices: 0,
    systemLoadPercent: 0,
    activeSessionsNow: 0,
  });

  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      totalCourses: courses.length,
    }));
  }, [courses.length]);

  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      totalStudents: users.filter((user) => user.role === 'student').length,
      totalLecturers: users.filter((user) => user.role === 'lecturer').length,
    }));
  }, [users]);
  const [adminClassLoading, setAdminClassLoading] = useState(false);
  const [adminClassError, setAdminClassError] = useState<string | null>(null);
  const [adminLecturerAccounts, setAdminLecturerAccounts] = useState<LecturerAccount[]>([]);
  const [assignmentRequests, setAssignmentRequests] = useState<ClassAssignmentRequest[]>([]);
  const [assignmentRequestLoading, setAssignmentRequestLoading] = useState(false);
  const [assignmentRequestError, setAssignmentRequestError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [gradeRecords, setGradeRecords] = useState<GradeRecord[]>([]);
  const [classResults, setClassResults] = useState<ClassStudentResult[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesError, setGradesError] = useState<string | null>(null);
  const [activeGradeClassId, setActiveGradeClassId] = useState<number | null>(null);

  const normalizeAttendanceCourseKey = (value?: string | number | null) =>
    String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const filterAttendanceDataForCourses = (items: any[] = [], courseList: Course[] = []) => {
    const allowedKeys = new Set(
      courseList
        .flatMap((course) => [course.code, course.class_code, course.title, course.class_name])
        .filter(Boolean)
        .map((value) => normalizeAttendanceCourseKey(value))
        .filter(Boolean)
    );

    return items.filter((item) => {
      const code = normalizeAttendanceCourseKey(item?.courseCode);
      const title = normalizeAttendanceCourseKey(item?.courseTitle);
      return !!code && (allowedKeys.has(code) || allowedKeys.has(title));
    });
  };

  useEffect(() => {
    if (currentUser?.role !== 'student' || !courses.length) return;

    setAttendanceData((previous) => filterAttendanceDataForCourses(previous, courses));
  }, [currentUser?.role, courses]);

  const refreshGrades = async (requestedClassId?: number) => {
    const classId = requestedClassId || activeGradeClassId || Number(courses[0]?.id);
    if (!Number.isFinite(classId)) return;
    setGradesLoading(true);
    setGradesError(null);
    try {
      const [records, results] = await Promise.all([GradesAPI.listForClass(classId), GradesAPI.classResults(classId)]);
      setGradeRecords(records);
      setClassResults(results);
    } catch (err) {
      setGradesError(err instanceof Error ? err.message : String(err));
    } finally {
      setGradesLoading(false);
    }
  };

  const gradeClassId = () => activeGradeClassId || Number(courses[0]?.id);
  const handleCreateGrade = async (payload: { student_id: number; component: string; score: number; weight: number }) => {
    try { await GradesAPI.create(gradeClassId(), payload); await refreshGrades(); }
    catch (err) { setGradesError(err instanceof Error ? err.message : String(err)); throw err; }
  };
  const handleSaveGrades = async (studentId: number, items: Array<{ component: string; score: number; weight: number }>) => {
    const classId = gradeClassId();
    if (!Number.isFinite(classId) || classId <= 0) {
      throw new Error('Không xác định được lớp cần lưu điểm.');
    }
    try {
      const existing = gradeRecords.filter((grade) => grade.student_id === studentId);
      const legacyAttendance = existing.filter((grade) => grade.component.trim().toLowerCase() === 'attendance');
      for (const grade of legacyAttendance) {
        await GradesAPI.delete(grade.id);
      }
      for (const item of items) {
        const normalizedComponent = item.component.trim().toLowerCase();
        const current = existing.find(
          (grade) =>
            grade.component.trim().toLowerCase() === normalizedComponent &&
            !legacyAttendance.some((legacy) => legacy.id === grade.id)
        );
        if (current) {
          await GradesAPI.update(current.id, { score: item.score, weight: item.weight });
        } else {
          await GradesAPI.create(classId, { student_id: studentId, ...item });
        }
      }
      await refreshGrades(classId);
    } catch (err) {
      setGradesError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };
  const handleUpdateGrade = async (gradeId: number, payload: { score?: number; weight?: number }) => {
    try { await GradesAPI.update(gradeId, payload); await refreshGrades(); }
    catch (err) { setGradesError(err instanceof Error ? err.message : String(err)); throw err; }
  };
  const handleDeleteGrade = async (gradeId: number) => {
    try { await GradesAPI.delete(gradeId); await refreshGrades(); }
    catch (err) { setGradesError(err instanceof Error ? err.message : String(err)); throw err; }
  };

  const getEnrollmentStudentId = (entry: any): string => {
    const directValues = [
      entry?.student_id,
      entry?.student_code,
      entry?.studentId,
      entry?.student?.id,
      entry?.student?.student_id,
      entry?.user_id,
      entry?.user?.id,
      entry?.user?.student_id,
      entry?.id,
    ];

    for (const value of directValues) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }

    return '';
  };

  const getApprovedEnrollmentIds = (enrollments: any[] = []): string[] => {
    const validStatuses = new Set([
      'approved',
      'enrolled',
      'accepted',
      'confirmed',
      'registered',
      'active',
      'joined',
    ]);

    return [...new Set(
      (enrollments || [])
        .filter((entry: any) => {
          const status = String(entry?.status ?? entry?.state ?? '').trim().toLowerCase();
          return validStatuses.has(status) || status.includes('approve') || status.includes('enroll') || status.includes('accept');
        })
        .map(getEnrollmentStudentId)
        .filter(Boolean)
    )];
  };

  const normalizeEnrollmentCount = (course: Course): Course => {
    const approvedIds = Array.isArray(course.enrolledStudentIds) ? Array.from(new Set(course.enrolledStudentIds.filter(Boolean))) : [];
    const count = Math.max(approvedIds.length, Number(course.enrolledCount || 0));
    return {
      ...course,
      enrolledStudentIds: approvedIds,
      enrolledCount: count,
    };
  };

  const refreshStudentCourses = async () => {
    try {
      const classes = await ClassesAPI.list();
      const activeClasses = (classes || []).filter(
        (item: any) => String(item.status || '').toLowerCase() === 'active'
      );

      const mappedClasses = await Promise.all(
        activeClasses.map(async (item: any) => {
          const classId = Number(item.id);
          const existingCourse = courses.find((course) => String(course.id) === String(item.id));
          let classDetail: any = null;
          let classSchedules: any[] = [];
          if (Number.isFinite(classId) && classId > 0) {
            try {
              [classDetail, classSchedules] = await Promise.all([
                ClassesAPI.detail(classId),
                SchedulesAPI.getClassSchedules(classId),
              ]);
            } catch {
              // Continue with the catalog fields when detail or schedule data is unavailable.
            }
          }
          let enrolledCount = Number(item.approved_enrollment_count ?? item.enrolled_count ?? 0);
          let enrolledStudentIds: string[] = [];

          if (Number.isFinite(classId) && classId > 0) {
            try {
              const enrollments = await ClassesAPI.getEnrollments(classId);
              enrolledStudentIds = getApprovedEnrollmentIds(enrollments);
              if (enrolledStudentIds.length > 0) {
                enrolledCount = enrolledStudentIds.length;
              }
            } catch {
              // Fall back to server-provided count when enrollment detail is unavailable.
            }
          }

          return normalizeEnrollmentCount({
            id: String(item.id),
            class_code: item.class_code || '',
            class_name: item.name || item.class_name || existingCourse?.class_name || existingCourse?.title || '',
            subject: item.subject || item.department || existingCourse?.subject || existingCourse?.department || '',
            lecturer: classDetail?.lecturer?.full_name || item.lecturer_name || item.lecturer || existingCourse?.lecturer || existingCourse?.lecturerName || '',
            room: item.room || classSchedules[0]?.room || existingCourse?.room || '',
            capacity: Number(item.capacity || classDetail?.capacity || existingCourse?.capacity || 0),
            schedule: item.schedule || classSchedules
              .map((entry: any) => `${entry.day_of_week || ''} ${entry.start_time || ''}-${entry.end_time || ''}`.trim())
              .filter(Boolean)
              .join(', ') || existingCourse?.schedule || '',
            code: item.class_code || '',
            title: item.name || item.class_name || existingCourse?.class_name || existingCourse?.title || '',
            department: item.department || existingCourse?.department || '',
            credits: Number(item.credits || existingCourse?.credits || 0),
            lecturerName: classDetail?.lecturer?.full_name || item.lecturer_name || item.lecturer || existingCourse?.lecturerName || '',
            lecturerId: String(item.lecturer_id || classDetail?.lecturer_id || existingCourse?.lecturerId || ''),
            virtualLink: item.virtual_link || '',
            enrolledCount,
            progressPercent: 0,
            semester: item.semester || '',
            bannerColor: 'bg-indigo-600',
            description: item.description || '',
            startDate: item.start_date || classDetail?.start_date || existingCourse?.startDate || '',
            durationWeeks: Number(item.duration_weeks || classDetail?.duration_weeks || existingCourse?.durationWeeks || 0),
            attendanceRate: 0,
            averageGrade: 0,
            classStatus: String(item.status || 'active').toLowerCase() as Course['classStatus'],
            enrolledStudentIds,
            joinRequests: [],
          } as Course);
        })
      );

      setCourses(mappedClasses);
    } catch {
      setCourses([]);
    }
  };

  // Login & Logout Handlers
  const handleLogin = async (user: UserProfile) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    setActiveTab('overview');
    try {
      if (user.role === 'admin') {
        await refreshAdminUsers();
      }
      if (user.role === 'student') {
        await refreshStudentCourses();
      }
      if (user.role === 'lecturer') {
        setAttendanceSessions([]);
      } else {
        setAttendanceSessions([]);
      }
    } catch (err) {
      console.warn('Initial data refresh warning, continuing to dashboard:', err);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      setAuthToken(null);
    } catch {
      // ignore
    }
    setActiveTab('overview');
  };

  // Restore auth on mount
  const [authChecking, setAuthChecking] = useState(true);
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    setAuthChecking(true);
    AuthAPI.me()
      .then(async (me) => {
        const mapped: UserProfile = {
          id: String((me as any).id),
          full_name: (me as any).full_name || (me as any).fullName || 'Người dùng',
          name: (me as any).full_name || (me as any).fullName || 'Người dùng',
          email: (me as any).email || '',
          role: ((me as any).role || 'STUDENT').toLowerCase() === 'lecturer' ? 'lecturer' : ((me as any).role || 'STUDENT').toLowerCase() === 'admin' ? 'admin' : 'student',
          student_code: (me as any).student_code || '',
          studentId: (me as any).student_code || '',
          student_id: (me as any).student_code || '',
          lecturer_code: (me as any).lecturer_code || '',
          lecturer_id: (me as any).lecturer_code || '',
          facultyId: (me as any).lecturer_code || '',
          major: (me as any).major || '',
          department: (me as any).department || '',
          avatarUrl: (me as any).avatar_url || (me as any).avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent((me as any).full_name || (me as any).fullName || 'User')}&background=6366f1&color=fff`,
          status: (me as any).is_active !== false ? 'active' : 'suspended',
          joinedDate: new Date().toISOString(),
        };
        await handleLogin(mapped);
      })
      .catch(() => {
        // token invalid or expired
        try {
          setAuthToken(null);
        } catch {}
        setCurrentUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
      setCurrentRole('student');
      setActiveTab('overview');
      setMobileSidebarOpen(false);
    };
    window.addEventListener('smart-classroom:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('smart-classroom:unauthorized', handleUnauthorized);
  }, []);

  // Switch Role Handler
  // Switch Role Handler (no longer allowed for real auth) - keep for demo fallback
  const handleRoleChange = (newRole: Role) => {
    // Allow role change only when no authenticated user (demo/testing)
    if (!currentUser) {
      setCurrentRole(newRole);
      setCurrentUser(null);
      setActiveTab('overview');
    }
  };

  // Student Attendance Check-in
  const handleStudentCheckIn = async (scheduleId: string, code: string): Promise<boolean> => {
    const targetSession = schedule.find((s) => s.id === scheduleId);
    if (!targetSession) return false;

    const matchingSession = attendanceSessions.find(
      (session) =>
        session.courseCode === targetSession.courseCode &&
        session.status === 'active' &&
        (!targetSession.date || session.date === targetSession.date)
    );
    if (!matchingSession) return false;

    try {
      const enteredCode = String(code || '').trim();
      const scheduleCode = String(targetSession.checkInCode || '').trim();
      const attendanceCode = enteredCode === scheduleCode
        ? matchingSession.checkInCode
        : enteredCode;
      await handleStudentCheckInAttendanceSession(matchingSession.id, attendanceCode);
      setSchedule((prev) =>
        prev.map((s) => (s.id === scheduleId ? { ...s, isCheckedIn: true } : s))
      );
      return true;
    } catch {
      return false;
    }
  };

  // Student Submit Assignment
  const handleStudentSubmitAssignment = (
    assignmentId: string,
    fileName: string,
    notes?: string
  ) => {
    // Call backend submission endpoint and refresh my submission
    return (async () => {
      try {
        await AssignmentsAPI.submit(Number(assignmentId), { content: fileName });
        // After successful submission, attempt to fetch my submission to update UI
        const mySub = await AssignmentsAPI.mySubmission(Number(assignmentId));

        // Update local assignments with returned submission where possible
        setAssignments((prev) =>
          prev.map((a) => {
            if (a.id !== assignmentId) return a;
            const updatedSubs = a.submissions ? [...a.submissions] : [];
            // replace or add student's submission based on student id
            const idx = updatedSubs.findIndex((s) => s.studentId === String((mySub as any).student_id));
            const newSub = {
              id: String((mySub as any).id),
              assignmentId: a.id,
              studentId: String((mySub as any).student_id),
              studentName: (mySub as any).student_name || 'You',
              studentEmail: '',
              avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent((mySub as any).student_name || 'You')}&background=6366f1&color=fff`,
              submittedAt: String((mySub as any).submitted_at),
              fileName: (mySub as any).content || fileName,
              fileSize: '',
              notes: notes || '',
              status: String((mySub as any).status) as any,
              maxScore: a.maxScore,
            };

            if (idx >= 0) {
              updatedSubs[idx] = newSub;
            } else {
              updatedSubs.push(newSub);
            }

            return {
              ...a,
              status: newSub.status === 'late' ? 'late' : 'submitted',
              submissions: updatedSubs,
            };
          })
        );

        // notify
        setNotifications((prev) => [
          {
            id: `notif_${Date.now()}`,
            title: 'Submission Sent',
            message: `Your submission for assignment ${assignmentId} was uploaded.`,
            timestamp: 'Just now',
            type: 'academic',
            unread: true,
            roleTarget: 'student',
          },
          ...prev,
        ]);

        return true;
      } catch (err) {
        // propagate to UI
        throw err;
      }
    })();
  };

  // Lecturer Update Attendance
  const handleLecturerUpdateAttendance = async (
    studentId: string,
    newStatus: AttendanceStatus
  ) => {
    setRoster((prev) =>
      prev.map((s) =>
        s.id === studentId || s.studentId === studentId ? { ...s, lastAttendanceStatus: newStatus } : s
      )
    );
    const activeSession = attendanceSessions.find((s) => s.status === 'active') || attendanceSessions[0];
    if (activeSession) {
      await handleLecturerUpdateAttendanceRecord(activeSession.id, studentId, newStatus);
    }
  };

  // Lecturer Mark All Present
  const handleLecturerMarkAllPresent = async () => {
    setRoster((prev) =>
      prev.map((s) => ({ ...s, lastAttendanceStatus: 'present' }))
    );
    const activeSession = attendanceSessions.find((s) => s.status === 'active') || attendanceSessions[0];
    if (activeSession) {
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setAttendanceSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSession.id) return s;
          const updatedRecords = (s.records || []).map((r) => ({
            ...r,
            status: 'present' as AttendanceStatus,
            checkInTime: r.checkInTime || nowTime,
          }));
          return { ...s, records: updatedRecords };
        })
      );
      if (Number.isFinite(Number(activeSession.id)) && Number(activeSession.id) > 0) {
        try {
          await AttendanceAPI.markAllPresent(Number(activeSession.id));
          await refreshAttendanceSessions(courses);
          await refreshStudentGrades();
        } catch {
          // ignore
        }
      }

      // Synchronize attendanceData course stats with all present
      setAttendanceData((prev) =>
        prev.map((item) => {
          const matchesCourse =
            String(item.courseCode || '').toLowerCase() === String(activeSession.courseCode || '').toLowerCase() ||
            String(item.courseCode || '').toLowerCase() === String(activeSession.courseId || '').toLowerCase();
          if (!matchesCourse) return item;

          const existingRecent = item.recentSessions || [];
          const hasRecentForDate = existingRecent.some((r: any) => r.date === activeSession.date);
          const nextRecent = hasRecentForDate
            ? existingRecent.map((r: any) => (r.date === activeSession.date ? { ...r, status: 'present' as AttendanceStatus } : r))
            : [{ date: activeSession.date, topic: activeSession.sessionTitle, status: 'present' as AttendanceStatus }, ...existingRecent];

          const newAttended = Math.min(item.totalSessions, item.attendedSessions + 1);
          const newAbsent = Math.max(0, item.absentSessions - 1);
          const newRate = item.totalSessions > 0 ? Number(((newAttended / item.totalSessions) * 100).toFixed(1)) : 100;
          return {
            ...item,
            attendedSessions: newAttended,
            absentSessions: newAbsent,
            percentage: newRate,
            status: newRate >= item.minRequiredPercentage ? 'good' : 'warning',
            recentSessions: nextRecent,
          };
        })
      );
    }
  };

  // Lecturer Create Attendance Session
  const handleLecturerCreateAttendanceSession = async (newSession: {
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
  }): Promise<void> => {
    setAttendanceLoading(true);
    setAttendanceError(null);
    try {
      const classIdNumeric = Number(newSession.courseId);
      if (!Number.isFinite(classIdNumeric) || classIdNumeric <= 0) {
        throw new Error('Invalid class id for attendance session creation');
      }
      const normalizedPin = String(newSession.checkInCode || '').replace(/[^A-Z0-9]/gi, '').slice(0, 12).toUpperCase();
      if (newSession.attendanceMethod === 'QR') {
        const startDate = new Date(`${newSession.date}T${newSession.startTime}:00`);
        const endDate = new Date(`${newSession.date}T${newSession.endTime}:00`);
        if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
          throw new Error('Thời gian bắt đầu và kết thúc không hợp lệ.');
        }
        await AttendanceAPI.createQrSession(classIdNumeric, {
          title: newSession.sessionTitle,
          start_time: startDate.toISOString(),
          expires_at: endDate.toISOString(),
          room: newSession.room,
        });
        await refreshAttendanceSessions();
        return;
      }
      latestCreatedSessionPinRef.current = {
        courseId: classIdNumeric,
        date: newSession.date,
        startTime: newSession.startTime,
        endTime: newSession.endTime,
        pin: normalizedPin || 'ATTENDANCEPIN',
      };
      const payload: Record<string, any> = {
        start_time: new Date(`${newSession.date}T${newSession.startTime}:00Z`).toISOString(),
        expires_at: new Date(`${newSession.date}T${newSession.endTime}:00Z`).toISOString(),
        radius_meters: Number(newSession.allowLateMinutes) || 50,
        qr_token: normalizedPin || 'ATTENDANCEPIN',
        title: newSession.sessionTitle || 'Attendance Session',
        room: newSession.room || '',
        allow_late_minutes: Number(newSession.allowLateMinutes) || 15,
      };
      await AttendanceAPI.createSession(classIdNumeric, payload);
      setAttendanceSessions((prev) => {
        const nextCode = normalizedPin || 'ATTENDANCEPIN';
        const createdEntry: AttendanceSession = {
          id: `local_${Date.now()}`,
          courseId: String(classIdNumeric),
          courseCode: newSession.courseCode,
          courseTitle: newSession.courseTitle,
          lecturerId: String(currentUser?.id || ''),
          lecturerName: currentUser?.full_name || '',
          sessionTitle: newSession.sessionTitle,
          date: newSession.date,
          startTime: newSession.startTime,
          endTime: newSession.endTime,
          room: newSession.room,
          status: 'active',
          checkInCode: nextCode,
          allowLateMinutes: Number(newSession.allowLateMinutes) || 15,
          createdAt: new Date().toISOString(),
          records: [],
        };
        return [createdEntry, ...filterVisibleAttendanceSessions(
          prev.filter((session) => session.courseId !== String(classIdNumeric) || session.date !== newSession.date || session.startTime !== newSession.startTime)
        )];
      });
      await refreshAttendanceSessions();
    } catch (err: any) {
      setAttendanceError(err?.message || String(err));
      throw err;
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleLecturerCloseAttendanceSession = async (sessionId: string): Promise<void> => {
    setAttendanceLoading(true);
    setAttendanceError(null);
    try {
      const id = Number(sessionId);
      if (!Number.isFinite(id) || id <= 0) throw new Error('Invalid attendance session id');
      const session = attendanceSessions.find((item) => String(item.id) === String(sessionId));
      if (session?.attendanceMethod === 'QR') {
        await AttendanceAPI.lockSession(id);
      } else {
        await AttendanceAPI.closeSession(id);
      }
      await refreshAttendanceSessions();
    } catch (err: any) {
      setAttendanceError(err?.message || String(err));
      throw err;
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleLecturerDeleteAttendanceSession = async (sessionId: string): Promise<void> => {
    const sessionToDelete = attendanceSessions.find((session) => session.id === sessionId);
    if (!sessionToDelete) return;

    const nextDeletedIds = new Set(deletedAttendanceSessionIdsRef.current);
    nextDeletedIds.add(String(sessionId));
    deletedAttendanceSessionIdsRef.current = nextDeletedIds;
    persistDeletedAttendanceSessionIds(nextDeletedIds);

    const localId = Number(sessionId);
    if (Number.isFinite(localId) && localId > 0) {
      try {
        await AttendanceAPI.closeSession(localId);
      } catch {
        // Session deletion is treated as local UI state as no backend delete endpoint exists.
      }
    }

    setAttendanceSessions((prev) => filterVisibleAttendanceSessions(prev.filter((session) => String(session.id) !== String(sessionId))));
    if (sessionToDelete.status === 'active') {
      setAttendanceError(null);
    }
  };

  const handleLecturerStartAttendanceSession = async (sessionId: string): Promise<void> => {
    // The backend starts sessions when they are created; refresh to obtain its current state.
    await refreshAttendanceSessions();
  };

  // Lecturer Update Attendance Record for a Student
  const handleLecturerUpdateAttendanceRecord = async (
    sessionId: string,
    studentId: string,
    newStatus: AttendanceStatus,
    notes?: string
  ): Promise<void> => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setAttendanceSessions((prev) =>
      prev.map((s) => {
        if (String(s.id) !== String(sessionId)) return s;
        const existingRecord = (s.records || []).find((r) => String(r.studentId) === String(studentId));
        const course = courses.find((item) => String(item.id) === String(s.courseId));
        const student = course?.enrolledStudents?.find(
          (item) =>
            String(item.id) === String(studentId) ||
            String(item.student_id || item.studentId) === String(studentId)
        );

        return {
          ...s,
          records: existingRecord
            ? (s.records || []).map((r) =>
                String(r.studentId) === String(studentId)
                  ? {
                      ...r,
                      status: newStatus,
                      checkInTime: newStatus !== 'absent' && !r.checkInTime ? nowTime : r.checkInTime || nowTime,
                      method: newStatus !== 'absent' && !r.method ? 'manual' : r.method || 'manual',
                      notes: notes || r.notes,
                    }
                  : r
              )
            : [
                ...s.records,
                {
                  id: `manual_${Date.now()}`,
                  sessionId: s.id,
                  studentId,
                  studentName: student?.full_name || studentId,
                  studentEmail: student?.email || '',
                  avatarUrl: student?.avatarUrl,
                  status: newStatus,
                  checkInTime: nowTime,
                  method: 'manual',
                  notes: notes || 'Manual attendance override',
                },
              ],
        };
      })
    );

    // Sync student roster and attendance summary
    setRoster((prev) =>
      prev.map((stu) =>
        stu.studentId === studentId || stu.id === studentId
          ? { ...stu, lastAttendanceStatus: newStatus }
          : stu
      )
    );

    // Sync student attendanceData course statistics with updated status
    const targetSession = attendanceSessions.find((item) => String(item.id) === String(sessionId));
    if (targetSession) {
      setAttendanceData((prev) =>
        prev.map((item) => {
          const matchesCourse =
            String(item.courseCode || '').toLowerCase() === String(targetSession.courseCode || '').toLowerCase() ||
            String(item.courseCode || '').toLowerCase() === String(targetSession.courseId || '').toLowerCase();
          if (!matchesCourse) return item;

          const existingRecent = item.recentSessions || [];
          const hasRecentForDate = existingRecent.some((r: any) => r.date === targetSession.date);
          const nextRecent = hasRecentForDate
            ? existingRecent.map((r: any) => (r.date === targetSession.date ? { ...r, status: newStatus } : r))
            : [{ date: targetSession.date, topic: targetSession.sessionTitle, status: newStatus }, ...existingRecent];

          const isPresent = newStatus === 'present' || newStatus === 'excused';
          const isLate = newStatus === 'late';
          const isAbsent = newStatus === 'absent';

          const newAttended = isPresent ? Math.min(item.totalSessions, item.attendedSessions + 1) : Math.max(0, item.attendedSessions - (item.attendedSessions > 0 ? 1 : 0));
          const newLate = isLate ? item.lateSessions + 1 : Math.max(0, item.lateSessions - (item.lateSessions > 0 ? 1 : 0));
          const newAbsent = isAbsent ? item.absentSessions + 1 : Math.max(0, item.absentSessions - 1);
          const newRate = item.totalSessions > 0 ? Number(((newAttended / item.totalSessions) * 100).toFixed(1)) : 100;

          return {
            ...item,
            attendedSessions: newAttended,
            lateSessions: newLate,
            absentSessions: newAbsent,
            percentage: newRate,
            status: newRate >= item.minRequiredPercentage ? 'good' : 'warning',
            recentSessions: nextRecent,
          };
        })
      );
    }

    let session = attendanceSessions.find((item) => String(item.id) === String(sessionId));
    if (!session) {
      const selectedSchedule = schedule.find(
        (item) =>
          `schedule_${item.id}` === String(sessionId) ||
          String(sessionId).startsWith(`schedule_${item.id}_`)
      );
      const courseForSchedule = selectedSchedule
        ? courses.find(
            (course) =>
              String(course.code || course.class_code).toLowerCase() ===
                String(selectedSchedule.courseCode).toLowerCase() ||
              String(course.id) === String(selectedSchedule.courseCode)
          )
        : undefined;
      if (!selectedSchedule || !courseForSchedule) {
        setAttendanceError('Không xác định được ca học cần điểm danh.');
        return;
      }
      session = {
        id: String(sessionId),
        courseId: String(courseForSchedule.id),
        courseCode: courseForSchedule.code || courseForSchedule.class_code,
        courseTitle: courseForSchedule.title || courseForSchedule.class_name,
        lecturerId: String(currentUser?.id || ''),
        lecturerName: currentUser?.full_name || '',
        sessionTitle: selectedSchedule.sessionTopic || 'Buổi học',
        date: selectedSchedule.date || selectedSchedule.classStartDate || courseForSchedule.startDate || '',
        startTime: selectedSchedule.startTime,
        endTime: selectedSchedule.endTime,
        room: selectedSchedule.room || courseForSchedule.room,
        status: 'scheduled',
        checkInCode: '',
        createdAt: '',
        records: [],
      };
    }
    if (!Number.isFinite(Number(sessionId))) {
      const classId = Number(session.courseId);
      if (!Number.isFinite(classId) || !session.date || !session.startTime || !session.endTime) {
        setAttendanceError('Ca học chưa có đủ ngày và thời gian để lưu điểm danh.');
        return;
      }
      try {
        const created = await AttendanceAPI.createSession(classId, {
          start_time: new Date(`${session.date}T${session.startTime}:00Z`).toISOString(),
          expires_at: new Date(`${session.date}T${session.endTime}:00Z`).toISOString(),
          radius_meters: session.allowLateMinutes || 50,
          qr_token: 'ATTENDANCEPIN',
          title: session.sessionTitle || 'Attendance Session',
          room: session.room || '',
          allow_late_minutes: session.allowLateMinutes || 15,
        });
        session = {
          ...session,
          id: String(created.id),
        };
      } catch (err: any) {
        setAttendanceError(err?.message || 'Không thể tạo phiên điểm danh.');
        return;
      }
    }
    const course = courses.find((item) => String(item.id) === String(session?.courseId));
    const student = course?.enrolledStudents?.find(
      (item) =>
        String(item.id) === String(studentId) ||
        String(item.student_id || item.studentId) === String(studentId)
    );
    const studentReference = String(
      student?.student_id || student?.studentId || student?.id || studentId
    );
    if (studentReference && Number(session.id) > 0) {
      try {
        await AttendanceAPI.setManualStatus(Number(session.id), studentReference, newStatus);
        await refreshAttendanceSessions(courses);
        await refreshStudentGrades();
        await refreshGrades();
      } catch (err: any) {
        setAttendanceError(err?.message || String(err));
      }
    }
  };

  // Student Check-In to an Attendance Session
  const handleStudentCheckInAttendanceSession = async (sessionId: string, code: string): Promise<boolean> => {
    const session = attendanceSessions.find((item) => item.id === sessionId);
    if (!session) {
      throw new Error('Phiên điểm danh không tồn tại.');
    }

    const submittedCode = String(code || '').trim();
    if (session.attendanceMethod !== 'QR' && !submittedCode) {
      throw new Error('Mã PIN không đúng hoặc đã hết hạn.');
    }

    if (session.attendanceMethod === 'QR') {
      try {
        const sid = Number(sessionId);
        const checkedInRecord = await AttendanceAPI.qrCheckIn(sid);
        const checkedInStudentId = String(checkedInRecord.student_id || checkedInRecord.student_code || getCurrentStudentAttendanceId());
        setAttendanceSessions((prev) =>
          prev.map((item) => String(item.id) !== String(sessionId) ? item : {
            ...item,
            records: [
              ...(item.records || []).filter((record) =>
                String(record.studentId) !== checkedInStudentId &&
                String(record.studentId) !== getCurrentStudentAttendanceId()
              ),
              {
                id: String(checkedInRecord.id),
                sessionId: item.id,
                studentId: checkedInStudentId,
                studentName: checkedInRecord.student_name || currentUser?.full_name || '',
                studentEmail: currentUser?.email || '',
                status: normalizeAttendanceStatus(checkedInRecord.status),
                checkInTime: checkedInRecord.check_in_time,
                method: 'qr',
                warning: checkedInRecord.warning || undefined,
              },
            ],
          })
        );
        setAttendanceData((prev) =>
          prev.map((item) => {
            const matchesCourse =
              String(item.courseCode || '').toLowerCase() === String(session.courseCode || '').toLowerCase() ||
              String(item.courseCode || '').toLowerCase() === String(session.courseId || '').toLowerCase();
            if (!matchesCourse) return item;
            const recentSessions = item.recentSessions || [];
            const hasDate = recentSessions.some((recent: any) => recent.date === session.date);
            const nextRecentSessions = hasDate
              ? recentSessions.map((recent: any) =>
                  recent.date === session.date ? { ...recent, status: 'present' as AttendanceStatus } : recent
                )
              : [{ date: session.date, topic: session.sessionTitle, status: 'present' as AttendanceStatus }, ...recentSessions];
            const attendedSessions = Math.min(item.totalSessions, item.attendedSessions + 1);
            const absentSessions = Math.max(0, item.absentSessions - 1);
            const percentage = item.totalSessions > 0
              ? Number(((attendedSessions / item.totalSessions) * 100).toFixed(1))
              : 100;
            return {
              ...item,
              attendedSessions,
              absentSessions,
              percentage,
              status: percentage >= item.minRequiredPercentage ? 'good' : 'warning',
              recentSessions: nextRecentSessions,
            };
          })
        );
        await refreshStudentGrades();
        return true;
      } catch (err: any) {
        throw new Error(err?.message || String(err));
      }
    }

    const currentStudentId = getCurrentStudentAttendanceId();
    const { graceDeadline } = getAttendanceWindow(session);
    const now = new Date();
    if (now > graceDeadline) {
      setAttendanceSessions((prev) =>
        prev.map((item) => {
          if (item.id !== sessionId) return item;
          const nextRecords = item.records.filter((record) => record.studentId !== currentStudentId);
          return {
            ...item,
            records: [
              ...nextRecords,
              {
                id: `auto_absent_${Date.now()}`,
                sessionId: item.id,
                studentId: currentStudentId,
                studentName: currentUser?.full_name || currentUser?.name || 'Student',
                studentEmail: currentUser?.email || '',
                status: 'absent',
                checkInTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                method: 'code',
                notes: 'Auto-marked absent after grace period',
              },
            ],
          };
        })
      );
      throw new Error('Đã quá thời gian quy định, bạn được ghi nhận là vắng mặt.');
    }

    try {
      const payload = { qr_token: submittedCode };
      const sid = Number(sessionId);
      const checkedInRecord = await AttendanceAPI.checkIn(sid, payload) as AttendanceRecordResponse;
      const checkedInStudentId = String(
        checkedInRecord?.student_code ||
        checkedInRecord?.student_id ||
        currentStudentId
      );

      setAttendanceSessions((prev) =>
        prev.map((item) => {
          if (String(item.id) !== String(sessionId)) return item;
          const isSameStudent = (record: AttendanceRecord) =>
            [currentStudentId, checkedInStudentId]
              .filter(Boolean)
              .some((id) => String(record.studentId) === String(id));
          const nextRecords = (item.records || []).filter((record) => !isSameStudent(record));
          return {
            ...item,
            records: [
              ...nextRecords,
              {
                id: String(checkedInRecord?.id || `manual_${Date.now()}`),
                sessionId: item.id,
                studentId: checkedInStudentId,
                studentName: checkedInRecord?.student_name || currentUser?.full_name || currentUser?.name || 'Student',
                studentEmail: currentUser?.email || '',
                status: normalizeAttendanceStatus(checkedInRecord?.status || 'present'),
                checkInTime: checkedInRecord?.check_in_time || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                method: 'code',
                notes: 'Checked in before grace period',
              },
            ],
          };
        })
      );

      // Synchronize attendanceData course statistics with this new attendance check-in status
      const targetSession = attendanceSessions.find((s) => String(s.id) === String(sessionId));
      if (targetSession) {
        setAttendanceData((prev) =>
          prev.map((item) => {
            const matchesCourse =
              String(item.courseCode || '').toLowerCase() === String(targetSession.courseCode || '').toLowerCase() ||
              String(item.courseCode || '').toLowerCase() === String(targetSession.courseId || '').toLowerCase();
            if (!matchesCourse) return item;

            const existingRecent = item.recentSessions || [];
            const hasRecentForDate = existingRecent.some((r: any) => r.date === targetSession.date);
            const nextRecent = hasRecentForDate
              ? existingRecent.map((r: any) => r.date === targetSession.date ? { ...r, status: 'present' as AttendanceStatus } : r)
              : [{ date: targetSession.date, topic: targetSession.sessionTitle, status: 'present' as AttendanceStatus }, ...existingRecent];

            const newAttended = Math.min(item.totalSessions, item.attendedSessions + 1);
            const newAbsent = Math.max(0, item.absentSessions - 1);
            const newRate = item.totalSessions > 0 ? Number(((newAttended / item.totalSessions) * 100).toFixed(1)) : 100;
            return {
              ...item,
              attendedSessions: newAttended,
              absentSessions: newAbsent,
              percentage: newRate,
              status: newRate >= item.minRequiredPercentage ? 'good' : 'warning',
              recentSessions: nextRecent,
            };
          })
        );
      }

      try {
        setAttendanceLoading(true);
        await AttendanceAPI.myAttendance();
        await refreshStudentGrades();
      } finally {
        setAttendanceLoading(false);
      }

      return true;
    } catch (err: any) {
      throw err;
    }
  };

  // Lecturer Grade Submission
  const handleLecturerGradeSubmission = async (
    assignmentId: string,
    studentId: string,
    score: number,
    feedback: string
  ) => {
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment) throw new Error('Không tìm thấy bài tập cần chấm điểm.');
    const submission = assignment?.submissions?.find((item) => item.studentId === studentId);
    if (!submission || !Number.isFinite(Number(submission.id))) {
      throw new Error('Không tìm thấy bài nộp cần chấm điểm. Vui lòng đồng bộ lại danh sách bài nộp.');
    }
    await AssignmentsAPI.gradeSubmission(Number(submission.id), score, feedback);
    await refreshAssignments();
    await refreshGrades(Number(assignment.courseId));

    const nowTime = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    setAssignments((prev) =>
      prev.map((asg) => {
        if (asg.id !== assignmentId) return asg;

        const updatedSubmissions = (asg.submissions || []).map((sub) => {
          if (sub.studentId === studentId) {
            return {
              ...sub,
              status: 'graded' as const,
              score,
              feedback,
              gradedAt: nowTime,
              gradedBy: currentUser?.name || '',
            };
          }
          return sub;
        });

        const pendingCount = updatedSubmissions.filter(
          (s) => s.status === 'submitted' || s.status === 'late'
        ).length;

        return {
          ...asg,
          submissions: updatedSubmissions,
          pendingGradingCount: pendingCount,
        };
      })
    );
  };

  // Sync lecturer-side schedules from backend when lecturer role active
  useEffect(() => {
    if (currentRole !== 'lecturer') return;
    let mounted = true;
    (async () => {
      try {
        await refreshSchedules();
        // Attempt to fetch classes taught by lecturer and their schedules
        const clsRes = await ClassesAPI.list({ lecturer_id: currentUser?.id });
        const cls = (clsRes as any) || [];
        if (!mounted) return;

        const mapped = await Promise.all((cls as any[]).map(async (c: any) => {
          const classId = Number(c.id);
          const classEnrollments = Number.isFinite(classId) && classId > 0
            ? await ClassesAPI.getEnrollments(classId)
            : [];
          const enrolledStudentIds = getApprovedEnrollmentIds(classEnrollments);
          const enrolledStudents: EnrolledStudentProfile[] = (classEnrollments || [])
            .filter((enrollment: any) => {
              const status = String(enrollment?.status || '').toLowerCase();
              return ['approved', 'enrolled', 'accepted', 'confirmed', 'active', 'joined'].includes(status);
            })
            .map((enrollment: any) => ({
              id: String(enrollment.student_id),
              student_id: enrollment.student_code ? String(enrollment.student_code) : undefined,
              studentId: enrollment.student_code ? String(enrollment.student_code) : undefined,
              full_name: enrollment.student_name || enrollment.student_code || `Student ${enrollment.student_id}`,
              role: 'student' as const,
            }));

          return normalizeEnrollmentCount({
            id: String(c.id),
            class_code: c.class_code,
            class_name: c.name,
            subject: c.semester || c.department || 'General',
            lecturer: currentUser?.full_name || currentUser?.name || 'Lecturer',
            room: c.room || '',
            capacity: Number(c.capacity || 40),
            schedule: c.schedule || '',
            code: c.class_code,
            title: c.name,
            department: c.academic_year || '',
            credits: Number(c.credits || 3),
            lecturerName: currentUser?.full_name || currentUser?.name || '',
            lecturerId: currentUser?.id || '',
            enrolledCount: enrolledStudentIds.length,
            progressPercent: 0,
            semester: c.semester || '',
            startDate: c.start_date || '',
            durationWeeks: Number(c.duration_weeks || 0),
            bannerColor: 'bg-indigo-600',
            description: c.description || '',
            classStatus: String(c.status || 'upcoming').toLowerCase() as Course['classStatus'],
            attendanceRate: 0,
            averageGrade: 0,
            enrolledStudentIds,
            enrolledStudents,
            joinRequests: [],
          } as Course);
        }));

        if (mapped.length > 0) {
          setCourses((prev) => {
            const merged = [...prev];
            mapped.forEach((next) => {
              const idx = merged.findIndex((item) => String(item.id) === String(next.id));
              if (idx >= 0) {
                const existing = merged[idx];
                const nextEnrolledIds = next.enrolledStudentIds || [];
                merged[idx] = {
                  ...existing,
                  ...next,
                  enrolledCount: next.enrolledCount > 0 ? next.enrolledCount : existing.enrolledCount,
                  enrolledStudentIds: nextEnrolledIds.length > 0 ? nextEnrolledIds : existing.enrolledStudentIds || [],
                };
              } else merged.unshift(next);
            });
            return merged;
          });
          setActiveGradeClassId((current) => current || Number(mapped[0].id));
        }
        await refreshAssignments(mapped);
        await refreshAttendanceSessions(mapped);

      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [currentRole, currentUser]);

  useEffect(() => {
    if (currentRole === 'lecturer' && activeGradeClassId) {
      void refreshGrades(activeGradeClassId);
    }
  }, [currentRole, activeGradeClassId]);

  useEffect(() => {
    if (currentRole === 'lecturer' && !activeGradeClassId && courses.length > 0) {
      setActiveGradeClassId(Number(courses[0].id));
    }
  }, [currentRole, activeGradeClassId, courses]);

  useEffect(() => {
    if (currentRole !== 'student') return;
    void refreshStudentAssignments();
    void refreshStudentGrades();
    if (courses.length > 0) {
      void refreshAttendanceSessions(courses);
    }
  }, [currentRole, currentUser, courses]);

  useEffect(() => {
    if ((currentRole !== 'student' && currentRole !== 'lecturer') || courses.length === 0) return;
    const refreshTimer = window.setInterval(() => {
      void refreshAttendanceSessions(courses);
    }, 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [currentRole, courses]);

  useEffect(() => {
    if (currentRole !== 'student' && currentRole !== 'admin') return;
    void refreshSchedules();
  }, [currentRole, currentUser]);

  useEffect(() => {
    if (currentRole === 'lecturer') {
      void refreshAssignmentRequests();
    } else {
      setAssignmentRequests([]);
    }
  }, [currentRole]);

  useEffect(() => {
    if (currentRole !== 'admin') return;
    let mounted = true;
    setAdminClassLoading(true);
    setAdminClassError(null);
    Promise.all([ClassesAPI.list(), ClassesAPI.listLecturerAccounts()])
      .then(async ([items, lecturerAccounts]) => {
        if (!mounted) return;
        setAdminLecturerAccounts(lecturerAccounts);
        const mapped: Course[] = await Promise.all((items || []).map(async (item: any) => {
          let enrolledStudentIds: string[] = [];
          let enrolledCount = Number(item.approved_enrollment_count || item.enrolled_count || 0);
          try {
            const enrollments = await ClassesAPI.getEnrollments(Number(item.id));
            enrolledStudentIds = getApprovedEnrollmentIds(enrollments);
            enrolledCount = enrolledStudentIds.length;
          } catch {
            // Keep the server count when enrollment details are unavailable.
          }
          return {
            id: String(item.id),
            class_code: item.class_code || '',
            class_name: item.name || item.class_name || '',
            subject: item.subject || item.department || '',
            lecturer: item.lecturer_name || item.lecturer || '',
            room: item.room || '',
            capacity: Number(item.capacity || 0),
            schedule: item.schedule || '',
            code: item.class_code || '',
            title: item.name || item.class_name || '',
            department: item.department || '',
            credits: Number(item.credits || 0),
            lecturerName: item.lecturer_name || item.lecturer || '',
            lecturerId: String(item.lecturer_id || ''),
            virtualLink: item.virtual_link || '',
            enrolledCount,
            progressPercent: 0,
            semester: item.semester || '',
            bannerColor: 'bg-indigo-600',
            description: item.description || '',
            attendanceRate: 0,
            averageGrade: 0,
            classStatus: String(item.status || 'upcoming').toLowerCase() as Course['classStatus'],
            enrolledStudentIds,
            joinRequests: [],
          };
        }));
        setCourses(mapped);
      })
      .catch((err) => {
        if (mounted) setAdminClassError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (mounted) setAdminClassLoading(false);
      });
    return () => { mounted = false; };
  }, [currentRole]);

  // Lecturer Update Score
  const handleLecturerUpdateScore = (studentId: string, newScore: number) => {
    setRoster((prev) =>
      prev.map((s) => {
        if (s.id === studentId) {
          const letter = getLetterGrade(newScore);
          const risk = newScore < 70 ? 'high' : newScore < 80 ? 'moderate' : 'low';
          return {
            ...s,
            currentGradePercent: newScore,
            letterGrade: letter,
            riskStatus: risk,
          };
        }
        return s;
      })
    );

    const activeCourseCode = courses.find((course) => Number(course.id) === activeGradeClassId)?.code || courses.find((course) => Number(course.id) === activeGradeClassId)?.class_code;
    if (!activeCourseCode) return;

    setGrades((prev) =>
      prev.map((g) => {
        if (g.courseCode !== activeCourseCode) return g;
        const nextPercentage = Math.max(0, Math.min(100, newScore));
        const nextLetter = getLetterGrade(nextPercentage);
        const nextPoints = getGradePoints(nextLetter);
        const nextStatus = getGradeStatus(nextPercentage, g.finalScore !== null);

        return {
          ...g,
          currentPercentage: nextPercentage,
          letterGrade: nextLetter,
          gradePoints: nextPoints,
          gradeStatus: nextStatus.status,
          gradeStatusLabel: nextStatus.label,
        };
      })
    );
  };

  // Lecturer Updates Course Grade Weights & Recalculates all grades
  const handleUpdateCourseWeights = (courseCode: string, newWeights: GradeWeightConfig) => {
    const enforcedWeights = { ...newWeights, attendance: 0 };
    setCourseWeights((prev) => ({
      ...prev,
      [courseCode]: enforcedWeights,
    }));

    // Recalculate student grades in transcript
    setGrades((prev) =>
      prev.map((g) => {
        if (g.courseCode !== courseCode) return g;
        const att = Number(g.attendanceScore ?? 0);
        const asg = Number(g.assignmentScore ?? 0);
        const qz = Number(g.quizScore ?? 0);
        const mid = Number(g.midtermScore ?? 0);
        const fin = g.finalScore !== undefined && g.finalScore !== null ? Number(g.finalScore) : null;

        const calc = calculateOverallScore(
          { attendance: att, assignment: asg, quiz: qz, midterm: mid, finalExam: fin },
          enforcedWeights
        );
        const letter = getLetterGrade(calc.overallScore);
        const points = getGradePoints(letter);
        const status = getGradeStatus(calc.overallScore, fin !== null);

        return {
          ...g,
          weights: enforcedWeights,
          currentPercentage: calc.overallScore,
          letterGrade: letter,
          gradePoints: points,
          gradeStatus: status.status,
          gradeStatusLabel: status.label,
        };
      })
    );

    // Recalculate roster in lecturer view
    setRoster((prev) =>
      prev.map((stu) => {
        const att = stu.attendanceScore ?? Math.round(stu.attendanceRate ?? 90);
        const asg = stu.assignmentScore ?? Math.round(stu.currentGradePercent ?? 85);
        const qz = stu.quizScore ?? Math.round((stu.currentGradePercent ?? 85) * 0.95);
        const mid = stu.midtermScore ?? Math.round((stu.currentGradePercent ?? 85) * 0.98);
        const fin = stu.finalScore !== undefined ? stu.finalScore : Math.round(stu.currentGradePercent ?? 85);

        const calc = calculateOverallScore(
          { attendance: att, assignment: asg, quiz: qz, midterm: mid, finalExam: fin },
          enforcedWeights
        );
        const letter = getLetterGrade(calc.overallScore);
        const risk = calc.overallScore < 70 ? 'high' : calc.overallScore < 80 ? 'moderate' : 'low';
        const status = getGradeStatus(calc.overallScore, fin !== null);

        return {
          ...stu,
          currentGradePercent: calc.overallScore,
          overallScore: calc.overallScore,
          letterGrade: letter,
          riskStatus: risk,
          gradeStatus: status.status,
          gradeStatusLabel: status.label,
        };
      })
    );
  };

  // Lecturer Updates Student 5 Component Scores (Attendance, Assignment, Quiz, Midterm, Final)
  const handleLecturerUpdateStudentScores = (
    studentId: string,
    scores: {
      attendanceScore: number;
      assignmentScore: number;
      quizScore: number;
      midtermScore: number;
      finalScore: number | null;
    },
    feedback?: string
  ) => {
    const activeCourse = courses.find((course) => Number(course.id) === activeGradeClassId) || courses[0];
    const activeCode = activeCourse?.code || activeCourse?.class_code || '';
    const activeWeights = { ...(courseWeights[activeCode] || DEFAULT_GRADE_WEIGHTS), attendance: 0 };
    const calc = calculateOverallScore(
      {
        attendance: scores.attendanceScore,
        assignment: scores.assignmentScore,
        quiz: scores.quizScore,
        midterm: scores.midtermScore,
        finalExam: scores.finalScore,
      },
      activeWeights
    );

    const letter = getLetterGrade(calc.overallScore);
    const points = getGradePoints(letter);
    const status = getGradeStatus(calc.overallScore, scores.finalScore !== null);
    const risk = calc.overallScore < 70 ? 'high' : calc.overallScore < 80 ? 'moderate' : 'low';

    setRoster((prev) =>
      prev.map((s) => {
        if (s.id === studentId || s.studentId === studentId) {
          return {
            ...s,
            ...scores,
            currentGradePercent: calc.overallScore,
            overallScore: calc.overallScore,
            letterGrade: letter,
            riskStatus: risk,
            gradeStatus: status.status,
            gradeStatusLabel: status.label,
            gradeFeedback: feedback || s.gradeFeedback,
          };
        }
        return s;
      })
    );

    setCourseWeights((prev) => ({
      ...prev,
      [activeCode]: activeWeights,
    }));

    setGrades((prev) =>
      prev.map((g) => {
        const courseMatch =
          g.courseCode === activeCode ||
          String(g.id) === String(activeGradeClassId) ||
          String((g as any).courseId) === String(activeGradeClassId);

        if (!courseMatch) return g;

        const nextComponents = [
          {
            name: 'Attendance Score',
            key: 'attendance' as const,
            weight: activeWeights.attendance,
            score: scores.attendanceScore,
            maxScore: 100,
            contributedPoints: (scores.attendanceScore * activeWeights.attendance) / 100,
          },
          {
            name: 'Assignment Score',
            key: 'assignment' as const,
            weight: activeWeights.assignment,
            score: scores.assignmentScore,
            maxScore: 100,
            contributedPoints: (scores.assignmentScore * activeWeights.assignment) / 100,
          },
          {
            name: 'Midterm Score',
            key: 'midterm' as const,
            weight: activeWeights.midterm,
            score: scores.midtermScore,
            maxScore: 100,
            contributedPoints: (scores.midtermScore * activeWeights.midterm) / 100,
          },
          {
            name: 'Final Score',
            key: 'finalExam' as const,
            weight: activeWeights.finalExam,
            score: scores.finalScore ?? 0,
            maxScore: 100,
            contributedPoints: ((scores.finalScore ?? 0) * activeWeights.finalExam) / 100,
          },
        ];

        return {
          ...g,
          weights: activeWeights,
          attendanceScore: scores.attendanceScore,
          assignmentScore: scores.assignmentScore,
          quizScore: scores.quizScore,
          midtermScore: scores.midtermScore,
          finalScore: scores.finalScore,
          currentPercentage: calc.overallScore,
          letterGrade: letter,
          gradePoints: points,
          gradeStatus: status.status,
          gradeStatusLabel: status.label,
          components: Array.isArray(g.components) && g.components.length ? nextComponents : g.components,
          feedback: feedback || g.feedback,
        };
      })
    );

    const isCurrentStudent =
      studentId === currentUser?.id ||
      studentId === currentUser?.student_id ||
      studentId === currentUser?.studentId ||
      String(studentId) === String(currentUser?.student_id || currentUser?.studentId || '');

    if (isCurrentStudent) {
      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}`,
          title: 'Grade Assessment Updated',
          message: `Your ${activeCode} grades were updated. Overall: ${calc.overallScore}% (${letter}). Status: ${status.label}.`,
          timestamp: 'Just now',
          type: 'academic',
          unread: true,
          roleTarget: 'student',
        },
        ...prev,
      ]);
    }
  };

  // Admin Add User
  const mapAdminUser = (user: any): UserProfile => ({
    id: String(user.id),
    full_name: user.full_name || '',
    name: user.full_name || '',
    email: user.email || '',
    role: String(user.role || 'student').toLowerCase() as Role,
    status: user.is_active === false ? 'suspended' : 'active',
    joinedDate: user.created_at || 'Fall 2026',
    student_id: user.student_code || '',
    studentId: user.student_code || '',
    lecturer_id: user.lecturer_code || '',
    facultyId: user.lecturer_code || '',
    major: user.major || '',
    department: user.department || '',
    avatarUrl: user.avatarUrl || user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  });

  const refreshAdminUsers = async () => {
    const loadedUsers = await UsersAPI.list();
    setUsers((loadedUsers || []).map(mapAdminUser));
  };

  const handleAdminAddUser = async (newUser: UserProfile, learningPathCsv?: string) => {
    const created = await UsersAPI.create({
      username: newUser.email.split('@')[0],
      email: newUser.email,
      full_name: newUser.full_name || newUser.name,
      role: newUser.role,
      password: newUser.password,
      student_code: newUser.student_id || newUser.studentId,
      major: newUser.major,
      lecturer_code: newUser.lecturer_id || newUser.facultyId,
      department: newUser.department,
      learning_path_csv: learningPathCsv,
    });
    setUsers((prev) => [mapAdminUser(created), ...prev]);
  };

  const handleAdminUploadStudentCurriculum = async (studentId: string, csv: string) => {
    await CurriculumAPI.uploadStudentCsv(studentId, csv);
  };

  // Admin Update User
  const handleAdminUpdateUser = (updatedUser: UserProfile) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
    );
  };

  // Admin Delete User
  const handleAdminDeleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // Admin Toggle User Status
  const handleAdminToggleUserStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' }
          : u
      )
    );
  };

  // Admin Create Course
  const handleAdminCreateCourse = async (newCourse: Course): Promise<void> => {
    const normalizedCode = String(newCourse.class_code || newCourse.code || '').trim().toUpperCase();
    const duplicateCourse = courses.find((course) => {
      const existingCode = String(course.class_code || course.code || '').trim().toUpperCase();
      return existingCode === normalizedCode;
    });

    if (duplicateCourse) {
      const message = `Mã môn "${duplicateCourse.class_code || duplicateCourse.code || normalizedCode}" đã tồn tại. Vui lòng chọn mã môn khác.`;
      setAdminClassError(message);
      throw new Error(message);
    }

    const lecturerName = String(newCourse.lecturer || newCourse.lecturerName || '').trim();
    const conflictingCourse = courses.find((course) => {
      return hasClassScheduleConflict(
        course.schedule,
        course.room,
        course.lecturer || course.lecturerName,
        newCourse.schedule,
        newCourse.room,
        lecturerName,
      );
    });

    if (conflictingCourse) {
      const message = `Lớp mới trùng lịch với ${conflictingCourse.class_code || conflictingCourse.code || 'lớp hiện có'} (${conflictingCourse.schedule}) vì cùng ngày, thời gian chồng lấn và có cùng giảng viên hoặc cùng phòng học. Vui lòng đổi ngày, giờ hoặc phòng.`;
      setAdminClassError(message);
      throw new Error(message);
    }

    setAdminClassLoading(true);
    setAdminClassError(null);
    try {
      const created = await ClassesAPI.create({
        class_code: (newCourse.class_code || newCourse.code).toUpperCase(),
        name: newCourse.class_name || newCourse.title,
        description: newCourse.description,
        capacity: newCourse.capacity,
        semester: newCourse.semester,
        academic_year: '2026-2027',
        lecturer_id: Number(newCourse.lecturerId),
        schedule: newCourse.schedule,
        room: newCourse.room,
        start_date: newCourse.startDate,
        duration_weeks: newCourse.durationWeeks,
      });
      setCourses((prev) => [{
        ...newCourse,
        id: String(created.id),
        class_code: created.class_code || newCourse.class_code || newCourse.code,
        code: created.class_code || newCourse.code,
        class_name: created.name || newCourse.class_name || newCourse.title,
        title: created.name || newCourse.title,
        capacity: Number(created.capacity || newCourse.capacity),
        description: created.description || newCourse.description,
        startDate: created.start_date || newCourse.startDate,
        durationWeeks: Number(created.duration_weeks || newCourse.durationWeeks),
        semester: created.semester || newCourse.semester,
        classStatus: String(created.status || 'upcoming').toLowerCase() as Course['classStatus'],
      }, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAdminClassError(message);
      throw err;
    } finally {
      setAdminClassLoading(false);
    }
  };

  const handleAdminDeleteCourse = async (courseId: string): Promise<void> => {
    setAdminClassLoading(true);
    setAdminClassError(null);
    try {
      const classId = Number(courseId);
      if (!Number.isFinite(classId)) throw new Error('Mã lớp học không hợp lệ');
      await ClassesAPI.delete(classId);
      setCourses((prev) => prev.filter((course) => String(course.id) !== String(courseId)));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAdminClassError(message);
      throw err;
    } finally {
      setAdminClassLoading(false);
    }
  };

  // Lecturer Create Class
  const handleLecturerCreateCourse = async (newCourseData: Partial<Course>) => {
    const payload = {
      class_code: (newCourseData.class_code || newCourseData.code || 'CLS101').toUpperCase(),
      name: newCourseData.class_name || newCourseData.title || 'New Class',
      description: newCourseData.description || 'Modern smart classroom curriculum.',
      capacity: Number(newCourseData.capacity) || 40,
      semester: newCourseData.semester || 'Fall Semester 2026',
      academic_year: '2026-2027',
      lecturer_id: Number(currentUser?.id) || 0,
      lecturer_name: currentUser?.full_name || currentUser?.name || newCourseData.lecturer || '',
      room: newCourseData.room || '',
      schedule: newCourseData.schedule || '',
      start_date: newCourseData.startDate || '',
      duration_weeks: Number(newCourseData.durationWeeks) || 0,
      credits: Number(newCourseData.credits) || 0,
    };
    const created = await ClassesAPI.create(payload);
    const mapped: Course = {
      id: String(created.id),
      class_code: created.class_code,
      class_name: created.name,
      subject: newCourseData.subject || 'Computer Science',
      lecturer: newCourseData.lecturer || currentUser?.full_name || '',
      room: newCourseData.room || '',
      capacity: created.capacity || payload.capacity,
      schedule: newCourseData.schedule || '',
      code: created.class_code,
      title: created.name,
      department: newCourseData.department || '',
      credits: Number(newCourseData.credits) || 0,
      lecturerName: newCourseData.lecturer || currentUser?.full_name || '',
      lecturerId: currentUser?.id || '',
      virtualLink: '',
      enrolledCount: 0,
      progressPercent: 0,
      semester: created.semester || payload.semester,
      bannerColor: newCourseData.bannerColor || 'bg-indigo-600',
      description: created.description || payload.description,
      startDate: created.start_date || '',
      durationWeeks: Number(created.duration_weeks || 0),
      attendanceRate: 0,
      averageGrade: 0,
      enrolledStudentIds: [],
      joinRequests: [],
    };
    setCourses((prev) => [mapped, ...prev]);
  };

  // Lecturer Update Class
  const handleLecturerUpdateCourse = async (updatedCourse: Course) => {
    try {
      const classId = Number(updatedCourse.id);
      if (!Number.isFinite(classId) || classId <= 0) throw new Error('Mã lớp học không hợp lệ');
      await ClassesAPI.update(classId, {
        class_code: updatedCourse.class_code || updatedCourse.code,
        name: updatedCourse.class_name || updatedCourse.title,
        description: updatedCourse.description || '',
        capacity: Number(updatedCourse.capacity) || 0,
        semester: updatedCourse.semester || '',
        academic_year: updatedCourse.department || '',
        lecturer_id: Number(currentUser?.id) || Number(updatedCourse.lecturerId) || 0,
        lecturer_name: currentUser?.full_name || currentUser?.name || updatedCourse.lecturer || updatedCourse.lecturerName || '',
        room: updatedCourse.room || '',
        schedule: updatedCourse.schedule || '',
        start_date: updatedCourse.startDate || '',
        duration_weeks: Number(updatedCourse.durationWeeks) || 0,
        credits: Number(updatedCourse.credits) || 0,
      });
      setCourses((prev) =>
        prev.map((course) => (course.id === updatedCourse.id ? updatedCourse : course))
      );
      await refreshSchedules();
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  // Lecturer Delete Class
  const handleLecturerDeleteCourse = async (courseId: string) => {
    const targetCourse = courses.find((course) => String(course.id) === String(courseId));
    const classId = Number(courseId);

    try {
      if (Number.isFinite(classId) && classId > 0) {
        await ClassesAPI.delete(classId);
      }
    } catch (err) {
      console.warn('Unable to delete class from backend, keeping the local UI state in sync:', err);
    }

    setCourses((prev) => prev.filter((c) => String(c.id) !== String(courseId)));
    setAttendanceSessions((prev) => prev.filter((session) => String(session.courseId) !== String(courseId)));
    setAssignments((prev) => prev.filter((assignment) => String(assignment.courseId) !== String(courseId)));
    if (targetCourse) {
      setGrades((prev) => prev.filter((grade) => {
        const gradeCourseCode = String(grade.courseCode || '').trim();
        const targetCourseCodes = [targetCourse.class_code, targetCourse.code, targetCourse.class_name, targetCourse.title]
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        return !targetCourseCodes.includes(gradeCourseCode);
      }));
    }
    setStats((prev) => ({ ...prev, totalCourses: Math.max(0, prev.totalCourses - 1) }));
  };

  // Student Request Join Class
  const handleStudentRequestJoinClass = async (courseId: string) => {
    const studentCode = currentUser?.student_id || currentUser?.studentId || '';
    const studentName = currentUser?.full_name || currentUser?.name || '';
    const studentEmail = currentUser?.email || '';
    const studentMajor = currentUser?.major || '';
    const studentCohort = currentUser?.class_name || '';

    const targetCourse = courses.find((course) => String(course.id) === String(courseId));
    const existingReq = targetCourse?.joinRequests?.find(
      (r) => r.studentId === studentCode && r.status === 'pending'
    );
    if (existingReq) return;

    try {
      const enrollment = await ClassesAPI.join({ class_code: (targetCourse?.class_code || targetCourse?.code || '').toString() });
      const classEnrollments = await ClassesAPI.getEnrollments(Number(courseId));
      const approvedIds = getApprovedEnrollmentIds(classEnrollments);

      setCourses((prev) =>
        prev.map((course) => {
          if (String(course.id) !== String(courseId)) return course;
          return normalizeEnrollmentCount({
            ...course,
            enrolledStudentIds: approvedIds,
            enrolledCount: approvedIds.length,
            joinRequests: [
              ...(course.joinRequests || []),
              {
                id: `req_${Date.now()}`,
                studentId: studentCode,
                studentName,
                studentEmail,
                major: studentMajor,
                className: studentCohort,
                requestedAt: 'Just now',
                status: 'pending',
              } as ClassJoinRequest,
            ],
            _enrollment: enrollment,
          } as Course);
        })
      );

      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}`,
          title: 'Class Join Request Sent',
          message: `Your enrollment request has been submitted for faculty review.`,
          timestamp: 'Just now',
          type: 'academic',
          unread: true,
          roleTarget: 'student',
        },
        ...prev,
      ]);
    } catch (err: any) {
      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}`,
          title: 'Enrollment update failed',
          message: err?.message || String(err),
          timestamp: 'Just now',
          type: 'system',
          unread: true,
          roleTarget: 'student',
        },
        ...prev,
      ]);
    }
  };

  // Student Unenroll Class
  const handleStudentUnenrollClass = async (courseId: string) => {
    try {
      const studentCode = currentUser?.student_code || currentUser?.student_id || currentUser?.studentId || '';
      const studentId = currentUser?.id || '';

      setCourses((prev) =>
        prev.map((course) => {
          if (String(course.id) !== String(courseId)) return course;
          const remainingIds = (course.enrolledStudentIds || []).filter(
            (id) => String(id) !== String(studentCode) && String(id) !== String(studentId)
          );
          return {
            ...course,
            enrolledStudentIds: remainingIds,
            enrolledCount: Math.max(0, remainingIds.length),
            joinRequests: (course.joinRequests || []).filter(
              (r) => String(r.studentId) !== String(studentCode) && String(r.studentId) !== String(studentId)
            ),
          };
        })
      );

      await refreshStudentCourses();
      await refreshSchedules();
      await refreshStudentAssignments();
      await refreshStudentGrades();

      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}`,
          title: 'Huỷ đăng ký lớp học thành công',
          message: 'Bạn đã huỷ đăng ký lớp học thành công.',
          timestamp: 'Vừa xong',
          type: 'academic',
          unread: true,
          roleTarget: 'student',
        },
        ...prev,
      ]);
    } catch (err: any) {
      console.warn('Error during unenroll refresh:', err);
    }
  };

  // Lecturer Approve Join Request
  const handleLecturerApproveJoinRequest = (courseId: string, requestId: string) => {
    (async () => {
      try {
        // Call backend approve endpoint
        const res = await EnrollmentsAPI.approve(Number(requestId));
        // Refresh enrollments for the class via ClassesAPI.getEnrollments if available
        const classEnrolls = await ClassesAPI.getEnrollments(Number(courseId));
        // Map enrollments to enrolledStudentIds and joinRequests
        setCourses((prev) =>
          prev.map((course) => {
            if (String(course.id) !== String(courseId)) return course;
            const enrollIds = (classEnrolls || []).filter((e: any) => e.status === 'APPROVED' || e.status === 'ENROLLED').map((e: any) => String(e.student_code || e.student_id || e.studentId));
            const joinReqs = (classEnrolls || []).map((e: any) => ({
              id: String(e.enrollment_id || e.id),
              studentId: String(e.student_code || e.student_id || e.studentId),
              studentName: e.student_name,
              studentEmail: '',
              requestedAt: String(e.enrolled_at || ''),
              status: mapEnrollStatus(e.status),
            }));
            return {
              ...course,
              enrolledStudentIds: enrollIds,
              enrolledCount: enrollIds.length,
              joinRequests: joinReqs,
            };
          })
        );

        setNotifications((prev) => [
          {
            id: `notif_${Date.now()}`,
            title: 'Student Enrollment Approved',
            message: `Student was added to the class cohort.`,
            timestamp: 'Just now',
            type: 'academic',
            unread: true,
            roleTarget: 'lecturer',
          },
          ...prev,
        ]);
        return;
      } catch (err: any) {
        setNotifications((prev) => [{
          id: `notif_${Date.now()}`,
          title: 'Enrollment update failed',
          message: err?.message || String(err),
          timestamp: 'Just now',
          type: 'system',
          unread: true,
          roleTarget: 'lecturer',
        }, ...prev]);
        return;
      }
    })();
  };

  // Lecturer Reject Join Request
  const handleLecturerRejectJoinRequest = (courseId: string, requestId: string) => {
    (async () => {
      try {
        await EnrollmentsAPI.reject(Number(requestId));
        const classEnrolls = await ClassesAPI.getEnrollments(Number(courseId));
        setCourses((prev) =>
          prev.map((course) => {
            if (String(course.id) !== String(courseId)) return course;
            const enrollIds = (classEnrolls || []).filter((e: any) => e.status === 'APPROVED' || e.status === 'ENROLLED').map((e: any) => String(e.student_code || e.student_id || e.studentId));
            const joinReqs = (classEnrolls || []).map((e: any) => ({
              id: String(e.enrollment_id || e.id),
              studentId: String(e.student_code || e.student_id || e.studentId),
              studentName: e.student_name,
              studentEmail: '',
              requestedAt: String(e.enrolled_at || ''),
              status: mapEnrollStatus(e.status),
            }));
            return {
              ...course,
              enrolledStudentIds: enrollIds,
              enrolledCount: enrollIds.length,
              joinRequests: joinReqs,
            };
          })
        );
        return;
      } catch (err: any) {
        setNotifications((prev) => [{
          id: `notif_${Date.now()}`,
          title: 'Enrollment update failed',
          message: err?.message || String(err),
          timestamp: 'Just now',
          type: 'system',
          unread: true,
          roleTarget: 'lecturer',
        }, ...prev]);
        return;
      }
    })();
  };

  // Lecturer Remove Student From Class
  const handleLecturerRemoveStudentFromClass = (courseId: string, studentId: string) => {
    (async () => {
      try {
        // Find enrollment id from class enrollments
        const enrolls = await ClassesAPI.getEnrollments(Number(courseId));
        const found = (enrolls || []).find((e: any) => String(e.student_code || e.student_id || e.studentId) === String(studentId));
        if (found && found.enrollment_id) {
          await EnrollmentsAPI.cancel(Number(found.enrollment_id));
        }
        // Refresh class enrollments
        const classEnrolls = await ClassesAPI.getEnrollments(Number(courseId));
        const enrollIds = (classEnrolls || []).filter((e: any) => e.status === 'APPROVED' || e.status === 'ENROLLED').map((e: any) => String(e.student_code || e.student_id || e.studentId));
        setCourses((prev) =>
          prev.map((course) => {
            if (String(course.id) !== String(courseId)) return course;
            return {
              ...course,
              enrolledStudentIds: enrollIds,
              enrolledCount: enrollIds.length,
            };
          })
        );
        return;
      } catch (err: any) {
        setNotifications((prev) => [{
          id: `notif_${Date.now()}`,
          title: 'Enrollment update failed',
          message: err?.message || String(err),
          timestamp: 'Just now',
          type: 'system',
          unread: true,
          roleTarget: 'lecturer',
        }, ...prev]);
        return;
      }
    })();
  };

  // Notifications
  const handleMarkNotificationRead = (notifId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, unread: false } : n))
    );
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans antialiased">
      {/* Top Application Header */}
      <Header
        currentRole={currentRole}
        currentUser={currentUser}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        onLogout={handleLogout}
      />

      {/* Main Layout Area: Persistent Sidebar + Role Dashboard */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Navigation Sidebar */}
        <Sidebar
          currentRole={currentRole}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Dynamic Role Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {currentRole === 'student' && (
            <StudentDashboard
              activeTab={activeTab}
              onTabChange={setActiveTab}
              courses={courses}
              schedule={schedule}
              assignments={assignments}
              grades={grades}
              attendanceData={attendanceData}
              riskFactors={riskFactors}
              learningPaths={learningPaths}
              currentUser={currentUser}
              onSubmitAssignment={handleStudentSubmitAssignment}
              onRequestJoinClass={handleStudentRequestJoinClass}
              onUnenrollClass={handleStudentUnenrollClass}
              onRefreshCourses={refreshStudentCourses}
              onRefreshSchedule={refreshSchedules}
              onRefreshGrades={refreshStudentGrades}
              onUpdateSchedule={setSchedule}
              attendanceSessions={attendanceSessions}
              onCheckInAttendanceSession={handleStudentCheckInAttendanceSession}
            />
          )}

          {currentRole === 'lecturer' && (
            <LecturerDashboard
              activeTab={activeTab}
              onTabChange={setActiveTab}
              courses={courses}
              schedule={schedule}
              assignments={assignments}
              roster={roster}
              users={users}
              currentUser={currentUser}
              onUpdateCourse={handleLecturerUpdateCourse}
              onDeleteCourse={handleLecturerDeleteCourse}
              onRemoveStudentFromClass={handleLecturerRemoveStudentFromClass}
              onUpdateAttendance={handleLecturerUpdateAttendance}
              onMarkAllPresent={handleLecturerMarkAllPresent}
              onCreateAssignment={handleLecturerCreateAssignment}
              onGradeSubmission={handleLecturerGradeSubmission}
              onUpdateScore={handleLecturerUpdateScore}
              weights={courseWeights[courses[0]?.code || courses[0]?.class_code || ''] || DEFAULT_GRADE_WEIGHTS}
              onUpdateWeights={handleUpdateCourseWeights}
              onUpdateStudentScores={handleLecturerUpdateStudentScores}
              gradeRecords={gradeRecords}
              classResults={classResults}
              gradesLoading={gradesLoading}
              gradesError={gradesError}
              activeGradeClassId={activeGradeClassId}
              onGradeClassChange={setActiveGradeClassId}
              onCreateGrade={handleCreateGrade}
              onSaveGrades={handleSaveGrades}
              onUpdateGrade={handleUpdateGrade}
              onDeleteGrade={handleDeleteGrade}
              onUpdateSchedule={setSchedule}
              onCreateSchedule={handleLecturerCreateSchedule}
              onUpdateScheduleItem={handleLecturerUpdateSchedule}
              onDeleteSchedule={handleLecturerDeleteSchedule}
              scheduleLoading={scheduleLoading}
              scheduleError={scheduleError}
              onUpdateAssignment={handleLecturerUpdateAssignment}
              onDeleteAssignment={handleLecturerDeleteAssignment}
              assignmentsLoading={assignmentsLoading}
              assignmentsError={assignmentsError}
              attendanceSessions={attendanceSessions}
              onCreateAttendanceSession={handleLecturerCreateAttendanceSession}
              onStartAttendanceSession={handleLecturerStartAttendanceSession}
              onCloseAttendanceSession={handleLecturerCloseAttendanceSession}
              onDeleteAttendanceSession={handleLecturerDeleteAttendanceSession}
              onUpdateAttendanceRecord={handleLecturerUpdateAttendanceRecord}
              attendanceLoading={attendanceLoading}
              attendanceError={attendanceError}
              assignmentRequests={assignmentRequests}
              assignmentRequestLoading={assignmentRequestLoading}
              assignmentRequestError={assignmentRequestError}
              onApproveClassAssignment={handleApproveClassAssignment}
              onRejectClassAssignment={handleRejectClassAssignment}
            />
          )}

          {currentRole === 'admin' && (
            <AdminDashboard
              activeTab={activeTab}
              onTabChange={setActiveTab}
              users={users}
              courses={courses}
              schedule={schedule}
              stats={stats}
              onAddUser={handleAdminAddUser}
              onUploadStudentCurriculum={handleAdminUploadStudentCurriculum}
              onUpdateUser={handleAdminUpdateUser}
              onDeleteUser={handleAdminDeleteUser}
              onToggleUserStatus={handleAdminToggleUserStatus}
              onCreateCourse={handleAdminCreateCourse}
              onDeleteCourse={handleAdminDeleteCourse}
              lecturerAccounts={adminLecturerAccounts}
              classLoading={adminClassLoading}
              classError={adminClassError}
              onUpdateSchedule={setSchedule}
            />
          )}
        </main>
      </div>
    </div>
  );
}