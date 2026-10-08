import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  User,
  Clock,
  MapPin,
  ExternalLink,
  Search,
  CheckCircle2,
  ChevronRight,
  FileText,
  KeyRound,
  Send,
  AlertCircle,
  Clock3,
  Layers,
  Sparkles,
  Users,
  Eye,
  Check,
  XCircle,
  UserMinus,
  AlertTriangle,
} from 'lucide-react';
import { Course, UserProfile } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { ClassesAPI } from '../../api/classes';
import { EnrollmentsAPI } from '../../api/enrollments';
import { SchedulesAPI } from '../../api/schedules';
import api from '../../api/client';
import ClassSchedulesForClass from './ClassSchedulesForClass';

interface StudentClassesProps {
  courses: Course[];
  currentUser?: UserProfile | null;
  onRequestJoinClass?: (courseId: string) => void;
  onUnenrollClass?: (courseId: string) => Promise<void> | void;
  onRefreshCourses?: () => Promise<void>;
  onRefreshSchedule?: () => Promise<void>;
}

export const StudentClasses: React.FC<StudentClassesProps> = ({
  courses,
  currentUser,
  onRequestJoinClass,
  onUnenrollClass,
  onRefreshCourses,
  onRefreshSchedule,
}) => {
  // Backend-driven state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  // Navigation tabs: 'joined' (View joined classes), 'explore' (Search for a class), 'requests' (My join requests)
  const [activeTab, setActiveTab] = useState<'joined' | 'explore' | 'requests'>('joined');

  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');

  // Quick class code input state
  const [classCodeInput, setClassCodeInput] = useState('');
  const [codeLookupResult, setCodeLookupResult] = useState<{
    course?: Course;
    status?: 'found' | 'already_joined' | 'pending' | 'not_found';
    message?: string;
  } | null>(null);

  // Modals
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [confirmJoinCourse, setConfirmJoinCourse] = useState<Course | null>(null);
  const [courseToUnenroll, setCourseToUnenroll] = useState<Course | null>(null);
  const [unenrollLoading, setUnenrollLoading] = useState(false);
  const [joinSuccessBanner, setJoinSuccessBanner] = useState<string | null>(null);

  const currentStudentId = currentUser?.id || '';
  const currentStudentCode = currentUser?.student_id || currentUser?.studentId || '';
  const currentStudentName = currentUser?.full_name || currentUser?.name || '';
  const isApprovedEnrollment = (entry: any) => {
    const status = String(entry?.status ?? entry?.state ?? '').trim().toLowerCase();
    const validStatuses = new Set(['approved', 'enrolled', 'accepted', 'confirmed', 'registered', 'active', 'joined']);
    return validStatuses.has(status) || status.includes('approve') || status.includes('enroll') || status.includes('accept');
  };
  const enrolledClassIds = new Set(
    enrollments
      .filter((enrollment) => isApprovedEnrollment(enrollment))
      .map((enrollment) => String(enrollment.class_id ?? enrollment.classId ?? ''))
  );

  // Helper to check if current student is enrolled in a course
  const isStudentEnrolled = (course: Course): boolean => {
    const enrollmentStatus = String((course as any)._enrollment?.status || '').toLowerCase();
    if (enrollmentStatus === 'approved' || enrollmentStatus === 'enrolled') return true;
    if (enrolledClassIds.has(String(course.id))) return true;
    if (!course.enrolledStudentIds) return false;
    return (
      course.enrolledStudentIds.includes(currentStudentId) ||
      course.enrolledStudentIds.includes(currentStudentCode)
    );
  };

  // Joined classes list
  const getEnrolledTotal = (course: Course): number => {
    const ids = Array.isArray(course.enrolledStudentIds) ? course.enrolledStudentIds : [];
    if (ids.length > 0) return ids.length;

    const approvedEnrollments = enrollments.filter((entry: any) => {
      const classId = String(entry.class_id ?? entry.classId ?? entry.class?.id ?? '');
      if (classId !== String(course.id)) return false;
      return isApprovedEnrollment(entry);
    });

    if (approvedEnrollments.length > 0) return approvedEnrollments.length;

    const count = Number(course.enrolledCount || 0);
    return Number.isFinite(count) ? count : 0;
  };

  const joinedClasses = enrolledCourses.length ? enrolledCourses : courses.filter((c) => isStudentEnrolled(c));

  // Explore classes exclude courses already joined by this student.
  const exploreClasses = courses.filter((course) => {
    const classStatus = String(course.classStatus || '').toLowerCase();
    return (!classStatus || classStatus === 'active') && !isStudentEnrolled(course);
  });

  // Requests made by student
  const studentRequests = courses.flatMap((course) => {
    const userReqs = course.joinRequests?.filter(
      (r) => r.studentId === currentStudentCode || r.studentId === currentStudentId
    ) || [];
    return userReqs.map((req) => ({
      ...req,
      course,
    }));
  });

  // Unique subjects for filter
  const subjects = Array.from(
    new Set(courses.map((c) => c.subject || c.department))
  ).filter(Boolean);

  // Handle Class Code Look-up
  const handleLookupClassCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = classCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    const matched = exploreClasses.find(
      (c) =>
        (c.class_code && c.class_code.toUpperCase() === cleanCode) ||
        (c.code && c.code.toUpperCase() === cleanCode)
    );

    if (!matched) {
      setCodeLookupResult({
        status: 'not_found',
        message: `No class with code "${cleanCode}" was found. Please check spelling with your lecturer.`,
      });
      return;
    }

    setCodeLookupResult({
      course: matched,
      status: 'found',
      message: `Class found! You can join this class immediately if a slot is available and the schedule does not conflict.`,
    });
  };

  // Fetch enrollments and class details from backend
  const loadEnrollments = async () => {
    setLoading(true);
    setError(null);
    try {
      const myEnrolls = await EnrollmentsAPI.my();
      setEnrollments(myEnrolls || []);
      const activeEnrollments = (myEnrolls || []).filter((enrollment: any) => isApprovedEnrollment(enrollment));

      // Resolve class details for each enrollment
      const classDetails = await Promise.all(
        activeEnrollments.map(async (enr: any) => {
          const classId = enr.class_id ?? enr.classId ?? enr.class?.id ?? enr.class_id;
          if (classId) {
            try {
              const knownCourse = courses.find((course) => String(course.id) === String(classId));
              const [detail, classSchedules] = await Promise.all([
                ClassesAPI.detail(classId),
                SchedulesAPI.getClassSchedules(Number(classId)).catch(() => []),
              ]);
              const lecturer = (detail as any).lecturer ?? (knownCourse as any)?.lecturer;
              const lecturerName =
                typeof lecturer === 'string'
                  ? lecturer
                  : lecturer?.full_name || lecturer?.name || knownCourse?.lecturerName || '';
              const scheduleText = classSchedules
                .map((entry: any) =>
                  `${entry.day_of_week || entry.dayOfWeek || ''} ${entry.start_time || entry.startTime || ''}-${entry.end_time || entry.endTime || ''}`.trim()
                )
                .filter(Boolean)
                .join(', ');
              return {
                ...(knownCourse || {}),
                ...(detail as any),
                class_name: (detail as any).name || (detail as any).class_name || knownCourse?.class_name || knownCourse?.title || '',
                title: (detail as any).name || (detail as any).class_name || knownCourse?.class_name || knownCourse?.title || '',
                code: (detail as any).class_code || knownCourse?.class_code || knownCourse?.code || '',
                lecturer: lecturerName,
                lecturerName,
                subject: (detail as any).subject || knownCourse?.subject || knownCourse?.department || '',
                room: (detail as any).room || classSchedules[0]?.room || knownCourse?.room || '',
                schedule: (detail as any).schedule || scheduleText || knownCourse?.schedule || '',
                capacity: Number((detail as any).capacity ?? knownCourse?.capacity ?? 0),
                enrolledCount: Number(
                  (detail as any).approved_enrollment_count ??
                  (detail as any).enrolled_count ??
                  knownCourse?.enrolledCount ??
                  0
                ),
                enrolledStudentIds: knownCourse?.enrolledStudentIds || [],
                progressPercent: 0,
                bannerColor: 'bg-indigo-600',
                _enrollment: enr,
              } as Course;
            } catch (err) {
              return ({ id: classId, class_name: enr.class_name || enr.title || 'Class', class_code: enr.class_code || enr.code, title: enr.title || enr.class_name || 'Class', subject: enr.subject || '', lecturer: enr.lecturer || '', room: enr.room || '', capacity: enr.capacity || 0, enrolledCount: enr.enrolledCount || 0, enrolledStudentIds: enr.enrolledStudentIds || [], schedule: enr.schedule || '', description: enr.description || '', progressPercent: 0, code: enr.code || enr.class_code || '', bannerColor: 'bg-indigo-600' , _enrollment: enr } as unknown) as Course;
            }
          }
          // If enrollment includes embedded class
          if (enr.class) return { ...(enr.class as Course), _enrollment: enr } as Course;
          return null;
        })
      );

      const filtered = (classDetails.filter(Boolean) as Course[]).map((c) => ({
        ...c,
      }));
      setEnrolledCourses(filtered);
    } catch (err: any) {
      if (err instanceof api.ApiError) setError(err.message || 'Failed to load enrollments');
      else setError(err?.message || String(err) || 'Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Load initial enrollments on mount
    loadEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!onRefreshCourses) return;
    const syncCatalog = () => {
      void Promise.all([onRefreshCourses(), onRefreshSchedule?.(), loadEnrollments()]);
    };
    window.addEventListener('focus', syncCatalog);
    const intervalId = window.setInterval(syncCatalog, 5000);
    return () => {
      window.removeEventListener('focus', syncCatalog);
      window.clearInterval(intervalId);
    };
  }, [onRefreshCourses, onRefreshSchedule]);

  // Handle submitting join request
  const handleConfirmJoin = (course: Course) => {
    // Call backend join endpoint
    (async () => {
      setError(null);
      try {
        setLoading(true);
        const enrollment = await ClassesAPI.join({ class_code: (course.class_code || course.code) });
        const nextEnrolledCount = Math.max((course.enrolledCount ?? 0) + 1, (course.enrolledStudentIds?.length ?? 0) + 1);
        const updatedCourse = {
          ...course,
          enrolledCount: nextEnrolledCount,
          enrolledStudentIds: [...(course.enrolledStudentIds || []), currentStudentCode],
          _enrollment: enrollment,
        };

        setEnrollments((previous) => [
          ...previous.filter((item) => String(item.class_id) !== String(course.id)),
          enrollment,
        ]);
        setEnrolledCourses((previous) => [
          ...previous.filter((item) => String(item.id) !== String(course.id)),
          updatedCourse,
        ]);
        setConfirmJoinCourse(null);
        setJoinSuccessBanner(
          `You joined ${course.class_code || course.code} (${course.class_name || course.title}) successfully.`
        );
        // update lookup widget
        if (codeLookupResult?.course?.id === course.id) {
          setCodeLookupResult({
            course: updatedCourse,
            status: 'already_joined',
            message: `You joined ${course.class_code || course.code} successfully.`,
          });
        }

        // Fire optional callback
        if (onRequestJoinClass) onRequestJoinClass(course.id);

        // Refresh data so catalog capacity and class-level counts stay synchronized with backend state.
        await loadEnrollments();
        await onRefreshCourses?.();
        await onRefreshSchedule?.();
      } catch (err: any) {
        if (err instanceof api.ApiError) setError(err.message || 'Failed to request join');
        else setError(err?.message || String(err) || 'Failed to request join');
      } finally {
        setLoading(false);
        setTimeout(() => setJoinSuccessBanner(null), 6000);
      }
    })();
  };

  const handleExecuteUnenroll = async (course: Course) => {
    setUnenrollLoading(true);
    setError(null);
    try {
      const classIdNum = Number(course.id);
      const enr = enrollments.find(
        (e: any) =>
          String(e.class_id ?? e.classId ?? e.class?.id ?? '') === String(course.id) ||
          String(e.class_code ?? e.code ?? '').toUpperCase() === String(course.class_code || course.code).toUpperCase()
      );
      const enrollmentId = Number(
        (course as any)._enrollment?.id ??
        (course as any)._enrollment?.enrollment_id ??
        enr?.id ??
        enr?.enrollment_id
      );

      // Attempt cancel by enrollment ID
      if (Number.isFinite(enrollmentId) && enrollmentId > 0) {
        await EnrollmentsAPI.cancel(enrollmentId).catch(() => {});
      }

      // Also unenroll by class ID
      if (Number.isFinite(classIdNum) && classIdNum > 0) {
        await ClassesAPI.unenroll(classIdNum).catch(() => {});
      }

      // Immediately remove from local state
      setEnrollments((previous) =>
        previous.filter((item: any) => {
          const itemClassId = String(item.class_id ?? item.classId ?? item.class?.id ?? '');
          const itemEnrollId = Number(item.id ?? item.enrollment_id);
          if (itemClassId === String(course.id)) return false;
          if (Number.isFinite(enrollmentId) && itemEnrollId === enrollmentId) return false;
          return true;
        })
      );
      setEnrolledCourses((previous) => previous.filter((item) => String(item.id) !== String(course.id)));

      // Close modals and display success banner
      setCourseToUnenroll(null);
      setSelectedCourse(null);
      setJoinSuccessBanner(
        `Đã huỷ đăng ký thành công môn ${course.class_code || course.code}: ${course.class_name || course.title}.`
      );

      // Trigger parent synchronization
      if (onUnenrollClass) {
        await onUnenrollClass(course.id);
      }
      await loadEnrollments();
      await onRefreshCourses?.();
      await onRefreshSchedule?.();
    } catch (err: any) {
      if (err instanceof api.ApiError) setError(err.message || 'Không thể huỷ đăng ký lớp');
      else setError(err?.message || String(err) || 'Không thể huỷ đăng ký lớp');
    } finally {
      setUnenrollLoading(false);
      setTimeout(() => setJoinSuccessBanner(null), 6000);
    }
  };

  // Filtered displayed classes based on active tab
  const getFilteredClasses = () => {
    const sourceList = activeTab === 'joined' ? joinedClasses : exploreClasses;

    return sourceList.filter((course) => {
      const code = String(course.class_code || course.code || '');
      const name = String(course.class_name || course.title || '');
      const subj = String(course.subject || course.department || '');
      const lec = String(course.lecturer || course.lecturerName || '');

      const matchesSearch =
        code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        subj.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lec.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(course.room || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(course.schedule || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSubject = selectedSubject === 'all' || subj === selectedSubject;
      return matchesSearch && matchesSubject;
    });
  };

  const filteredCourses = getFilteredClasses();

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Code Enter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Quản lý lớp học</h2>
              <Badge variant="indigo" size="sm">
                Student Enrollment
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Search university catalog, enter a class invitation code to request enrollment, and access your joined classes.
            </p>
          </div>

          {/* Quick Class Code Input Box */}
          <form
            onSubmit={handleLookupClassCode}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 lg:max-w-md w-full"
          >
            <div className="relative flex-1">
              <KeyRound className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-enter-class-code"
                type="text"
                placeholder="Enter class code (e.g. AI401)"
                value={classCodeInput}
                onChange={(e) => {
                  setClassCodeInput(e.target.value);
                  if (codeLookupResult) setCodeLookupResult(null);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold"
              />
            </div>
            <button
              id="btn-verify-class-code"
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5"
            >
              <span>Nhập mã</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Class Code Lookup Result Banner */}
        {codeLookupResult && (
          <div
            id="class-code-lookup-result"
            className={`mt-4 p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
              codeLookupResult.status === 'found'
                ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                : codeLookupResult.status === 'already_joined'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : codeLookupResult.status === 'pending'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {codeLookupResult.status === 'found' && (
                <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
              )}
              {codeLookupResult.status === 'already_joined' && (
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              )}
              {codeLookupResult.status === 'pending' && (
                <Clock3 className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              {codeLookupResult.status === 'not_found' && (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}

              <div>
                <p className="font-semibold">{codeLookupResult.message}</p>
                {codeLookupResult.course && (
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {codeLookupResult.course.subject} • Lecturer: {codeLookupResult.course.lecturer || codeLookupResult.course.lecturerName} • Room: {codeLookupResult.course.room}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {codeLookupResult.status === 'found' && codeLookupResult.course && (
                <button
                  id="btn-quick-request-join"
                  onClick={() => setConfirmJoinCourse(codeLookupResult.course!)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Tham gia lớp</span>
                </button>
              )}
              <button
                onClick={() => setCodeLookupResult(null)}
                className="px-2.5 py-1 text-slate-500 hover:text-slate-800 text-[11px] font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Global Success Banner */}
        {joinSuccessBanner && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{joinSuccessBanner}</span>
            </div>
            <button
              onClick={() => setJoinSuccessBanner(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Main Navigation Tabs: Joined Classes vs Explore vs Requests */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            id="tab-joined-classes"
            onClick={() => setActiveTab('joined')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'joined'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Lớp đã tham gia</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                activeTab === 'joined' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {joinedClasses.length}
            </span>
          </button>

          <button
            id="tab-explore-classes"
            onClick={() => setActiveTab('explore')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'explore'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Tìm kiếm & xem danh mục</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                activeTab === 'explore' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {exploreClasses.length}
            </span>
          </button>

          <button
            id="tab-my-requests"
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'requests'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Clock3 className="w-3.5 h-3.5" />
                        <span>Tham gia lớp</span>
            {studentRequests.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                  activeTab === 'requests' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {studentRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Input */}
        {activeTab !== 'requests' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-student-classes"
              type="text"
              placeholder="Search class, code, subject, lecturer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      {/* Subject Filter Chips for Explore / Joined */}
      {activeTab !== 'requests' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedSubject('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              selectedSubject === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Disciplines
          </button>
          {subjects.map((subj) => (
            <button
              key={subj}
              onClick={() => setSelectedSubject(subj)}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                selectedSubject === subj
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1 & 2: CLASSES GRID (JOINED OR EXPLORE) */}
      {/* ========================================================================= */}
      {activeTab !== 'requests' && (
        <div>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
              <div className="text-xs text-slate-600">Đang tải các lớp học...</div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="text-rose-700 font-bold">{error}</div>
              <button
                onClick={() => loadEnrollments()}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
              >
                Retry
              </button>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">
                {activeTab === 'joined'
                  ? 'No joined classes match your search'
                  : 'No classes found in the university catalog'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {activeTab === 'joined'
                  ? 'Switch to the "Search & Browse Catalog" tab to find and join classes.'
                  : 'Try different search keywords or enter a class code in the box above.'}
              </p>
              {activeTab === 'joined' && (
                <button
                  onClick={() => setActiveTab('explore')}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
                >
                  Browse All Classes
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourses.map((course) => {
                const classCode = course.class_code || course.code;
                const className = course.class_name || course.title;
                const subject = course.subject || course.department;
                const lecturer = course.lecturer || course.lecturerName;
                const isEnrolled = isStudentEnrolled(course);
                const isPending = false;
                const enrolledTotal = getEnrolledTotal(course);
                const isFull = enrolledTotal >= course.capacity;

                return (
                  <div
                    key={course.id}
                    id={`student-class-card-${classCode}`}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Course Card Header */}
                      <div className={`p-4 ${course.bannerColor || 'bg-indigo-600'} text-white`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-extrabold tracking-wider uppercase px-2 py-0.5 bg-black/25 rounded-md">
                            {classCode}
                          </span>
                          {isEnrolled ? (
                            <span className="text-[11px] font-bold bg-emerald-500/90 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                              <Check className="w-3 h-3" />
                              Joined
                            </span>
                          ) : isPending ? (
                            <span className="text-[11px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs animate-pulse">
                              <Clock3 className="w-3 h-3" />
                              Pending Approval
                            </span>
                          ) : isFull ? (
                            <span className="text-[11px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full">
                              Full
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium bg-white/20 px-2 py-0.5 rounded-md">
                              {course.credits || 3} Credits
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-base mt-2.5 leading-snug line-clamp-2">
                          {className}
                        </h3>
                        <p className="text-[11px] text-white/80 mt-1 flex items-center gap-1">
                          <Layers className="w-3 h-3 opacity-80" />
                          <span className="truncate">{subject}</span>
                        </p>
                      </div>

                      {/* Course Meta Info Displaying 7 Required Fields */}
                      <div className="p-4 space-y-2.5 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="truncate">
                            <span className="text-slate-400 font-normal mr-1">Giảng viên:</span>
                            <span className="font-semibold text-slate-800">{lecturer}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="truncate">
                            <span className="text-slate-400 font-normal mr-1">Lịch học:</span>
                            <span className="font-semibold text-slate-800">{course.schedule}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                          <div className="truncate">
                            <span className="text-slate-400 font-normal mr-1">Room:</span>
                            <span className="font-semibold text-slate-800">{course.room}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <span className="text-slate-400 font-normal mr-1">Sức chứa:</span>
                            <span className="font-semibold text-slate-800">
                              {enrolledTotal} / {course.capacity} Students
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar for Joined Classes */}
                        {isEnrolled && (
                          <div className="pt-2 border-t border-slate-100 mt-2">
                            <div className="flex justify-between text-[11px] text-slate-500 mb-1 font-medium">
                              <span>Mức hoàn thành đề cương</span>
                              <span className="text-slate-900 font-semibold">{course.progressPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                                style={{ width: `${course.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Area */}
                    <div className="p-4 pt-0 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                      <button
                        id={`btn-view-course-${classCode}`}
                        onClick={() => setSelectedCourse(course)}
                        className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-center flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Chi tiết</span>
                      </button>

                      {/* Enrolled Actions: Virtual Classroom link & Unenroll Button */}
                      {isEnrolled && (
                        <>
                          {course.virtualLink && (
                            <a
                              href={course.virtualLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors"
                              title="Mở lớp học ảo"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}

                          <button
                            id={`btn-cancel-enrollment-${classCode}`}
                            onClick={() => setCourseToUnenroll(course)}
                            disabled={loading || unenrollLoading}
                            className="flex-1 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 rounded-xl transition-colors text-center flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs"
                            title="Huỷ đăng ký lớp học này"
                          >
                            <UserMinus className="w-3.5 h-3.5 text-rose-600" />
                            <span>Huỷ đăng ký</span>
                          </button>
                        </>
                      )}

                      {/* Request to Join Button or Status */}
                      {!isEnrolled && !isPending && (
                        <button
                          id={`btn-request-join-${classCode}`}
                          onClick={() => setConfirmJoinCourse(course)}
                          disabled={isFull}
                          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors text-center flex items-center justify-center gap-1.5 shadow-xs ${
                            isFull
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Đăng ký</span>
                        </button>
                      )}

                      {isPending && (
                        <div className="flex-1 py-2 text-xs font-semibold text-amber-700 bg-amber-50 rounded-xl text-center flex items-center justify-center gap-1">
                          <Clock3 className="w-3.5 h-3.5" />
                          <span>Đã yêu cầu</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STUDENT'S JOIN REQUESTS */}
      {/* ========================================================================= */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Đăng ký lớp của bạn</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Track status of class enrollment requests sent to faculty instructors
              </p>
            </div>
            <button
              onClick={() => setActiveTab('explore')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              + Request Another Class
            </button>
          </div>

          {studentRequests.length === 0 ? (
            <div className="p-12 text-center">
              <Clock3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">Không có yêu cầu đang chờ</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                You haven't requested to join any new classes recently. Browse the catalog to find classes to take!
              </p>
              <button
                onClick={() => setActiveTab('explore')}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                Browse University Catalog
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {studentRequests.map((req) => {
                const c = req.course;
                return (
                  <div key={req.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                          {c.class_code || c.code}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {c.class_name || c.title}
                        </h4>
                      </div>
                      <p className="text-slate-500 text-xs">
                        Subject: {c.subject} • Lecturer: {c.lecturer || c.lecturerName} • Room: {c.room}
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        Submitted on: {req.requestedAt}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {req.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-xs">
                          <Clock3 className="w-3.5 h-3.5" />
                          Pending Review
                        </span>
                      )}
                      {req.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approved & Enrolled
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold text-xs">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Declined
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRM JOIN REQUEST MODAL */}
      {/* ========================================================================= */}
      {confirmJoinCourse && (
        <Modal
          isOpen={!!confirmJoinCourse}
          onClose={() => setConfirmJoinCourse(null)}
          title={`Request to Join: ${confirmJoinCourse.class_code || confirmJoinCourse.code}`}
          subtitle={`${confirmJoinCourse.class_name || confirmJoinCourse.title}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
              Bạn đang đăng ký chính thức lớp học này. Nếu còn chỗ trống và không trùng lịch, bạn sẽ được tham gia ngay.
            </p>

            <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Tên sinh viên:</span>
                <span className="font-bold text-slate-800">{currentStudentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Student ID:</span>
                <span className="font-mono font-bold text-slate-800">{currentStudentCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lớp học & phòng:</span>
                <span className="font-semibold text-slate-800">{confirmJoinCourse.room}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lịch học hàng tuần:</span>
                <span className="font-semibold text-slate-800">{confirmJoinCourse.schedule}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmJoinCourse(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-send-request"
                type="button"
                onClick={() => handleConfirmJoin(confirmJoinCourse)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Đăng ký</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* VIEW CLASS DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedCourse && (
        <Modal
          isOpen={!!selectedCourse}
          onClose={() => setSelectedCourse(null)}
          title={`${selectedCourse.class_code || selectedCourse.code}: ${selectedCourse.class_name || selectedCourse.title}`}
          subtitle={`${selectedCourse.subject || selectedCourse.department} • Room: ${selectedCourse.room}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              {selectedCourse.description}
            </p>

            {/* 7 Required Fields Displayed Structured */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-600 block text-[11px] font-semibold">Class Code</span>
                <span className="font-mono font-bold text-indigo-600 mt-0.5 block">
                  {selectedCourse.class_code || selectedCourse.code}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-600 block text-[11px] font-semibold">Subject</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {selectedCourse.subject || selectedCourse.department}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-600 block text-[11px] font-semibold">Giảng viên chính</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {selectedCourse.lecturer || selectedCourse.lecturerName}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-600 block text-[11px] font-semibold">Phòng học</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {selectedCourse.room}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-600 block text-[11px] font-semibold">Weekly Schedule</span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {selectedCourse.schedule}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-600 block text-[11px] font-semibold">Sức chứa & sĩ số</span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {getEnrolledTotal(selectedCourse)} / {selectedCourse.capacity} Students
                </span>
              </div>
            </div>

            {/* Enrolled status banner or Request to Join banner */}
            {isStudentEnrolled(selectedCourse) ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold block">Bạn đã đăng ký lớp học này</span>
                    <span className="text-[11px] text-emerald-700">Trạng thái học tập: Đang tham gia</span>
                  </div>
                </div>
                <button
                  id="btn-detail-modal-unenroll"
                  onClick={() => {
                    const c = selectedCourse;
                    setCourseToUnenroll(c);
                  }}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  <UserMinus className="w-3.5 h-3.5 text-rose-600" />
                  <span>Huỷ đăng ký lớp</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-indigo-950 block">Bạn quan tâm lớp học này?</span>
                  <span className="text-indigo-700 text-[11px]">Hiện còn chỗ cho học kỳ Thu 2026.</span>
                </div>
                <button
                  onClick={() => {
                    const c = selectedCourse;
                    setSelectedCourse(null);
                    setConfirmJoinCourse(c);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors shrink-0"
                >
                  Đăng ký lớp
                </button>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Tài liệu môn học & Đề cương
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 text-xs hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 text-slate-700">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium">Đề cương học phần & trọng số điểm chính thức (PDF)</span>
                  </div>
                  <span className="text-[11px] text-indigo-600 font-semibold cursor-pointer hover:underline">
                    Tải về
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* CONFIRM UNENROLL / CANCEL REGISTRATION MODAL */}
      {/* ========================================================================= */}
      {courseToUnenroll && (
        <Modal
          isOpen={!!courseToUnenroll}
          onClose={() => !unenrollLoading && setCourseToUnenroll(null)}
          title="Xác nhận huỷ đăng ký lớp học"
          subtitle={`${courseToUnenroll.class_code || courseToUnenroll.code}: ${courseToUnenroll.class_name || courseToUnenroll.title}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-rose-800">Bạn có chắc chắn muốn huỷ đăng ký?</p>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Sau khi huỷ, bạn sẽ được rút khỏi danh sách lớp học. Lớp học và lịch học tương ứng sẽ không còn xuất hiện trong Thời khoá biểu của bạn. Bạn vẫn có thể đăng ký lại nếu lớp còn chỗ.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Mã lớp học:</span>
                <span className="font-mono font-bold text-slate-800">{courseToUnenroll.class_code || courseToUnenroll.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tên môn học:</span>
                <span className="font-semibold text-slate-800 text-right">{courseToUnenroll.class_name || courseToUnenroll.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Giảng viên:</span>
                <span className="font-semibold text-slate-800">{courseToUnenroll.lecturer || courseToUnenroll.lecturerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lịch học hàng tuần:</span>
                <span className="font-semibold text-slate-800">{courseToUnenroll.schedule}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phòng học:</span>
                <span className="font-semibold text-slate-800">{courseToUnenroll.room}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCourseToUnenroll(null)}
                disabled={unenrollLoading}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                Giữ lại lớp
              </button>
              <button
                id="btn-confirm-cancel-enrollment"
                type="button"
                disabled={unenrollLoading}
                onClick={() => handleExecuteUnenroll(courseToUnenroll)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {unenrollLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang huỷ...</span>
                  </>
                ) : (
                  <>
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Xác nhận huỷ đăng ký</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
