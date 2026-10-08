import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  Award,
  BarChart3,
  Users,
  Clock,
} from 'lucide-react';
import {
  Course,
  ScheduleItem,
  Assignment,
  StudentRosterItem,
  UserProfile,
  AttendanceSession,
  AttendanceStatus,
  GradeWeightConfig,
} from '../../types';
import { StatCard } from '../common/StatCard';
import { Badge } from '../common/Badge';
import { LecturerClasses } from './LecturerClasses';
import { LecturerSchedule } from './LecturerSchedule';
import { LecturerAttendance } from './LecturerAttendance';
import { LecturerAssignments } from './LecturerAssignments';
import { LecturerGrades } from './LecturerGrades';
import { GradeRecord, ClassStudentResult } from '../../api/grades';
import { LecturerAnalytics } from './LecturerAnalytics';
import { LecturerQuizzes } from './LecturerQuizzes';
import { ClassAssignmentRequest } from '../../api/notifications';

interface LecturerDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  courses: Course[];
  schedule: ScheduleItem[];
  assignments: Assignment[];
  roster: StudentRosterItem[];
  users?: UserProfile[];
  currentUser?: UserProfile | null;
  onUpdateCourse?: (updatedCourse: Course) => void;
  onDeleteCourse?: (courseId: string) => void;
  onRemoveStudentFromClass?: (courseId: string, studentId: string) => void;
  onUpdateAttendance: (studentId: string, status: AttendanceStatus) => void;
  onMarkAllPresent: () => void;
  onCreateAssignment: (newAsg: Omit<Assignment, 'id'>) => void;
  onUpdateAssignment?: (assignment: Assignment) => Promise<void>;
  onDeleteAssignment?: (assignmentId: string) => Promise<void>;
  assignmentsLoading?: boolean;
  assignmentsError?: string | null;
  onGradeSubmission?: (asgId: string, studentId: string, score: number, feedback: string) => void | Promise<void>;
  onUpdateScore: (studentId: string, newScore: number) => void;
  weights?: GradeWeightConfig;
  onUpdateWeights?: (courseCode: string, weights: GradeWeightConfig) => void;
  onUpdateStudentScores?: (
    studentId: string,
    scores: {
      attendanceScore: number;
      assignmentScore: number;
      quizScore: number;
      midtermScore: number;
      finalScore: number | null;
    },
    feedback?: string
  ) => void;
  gradeRecords?: GradeRecord[];
  classResults?: ClassStudentResult[];
  gradesLoading?: boolean;
  gradesError?: string | null;
  activeGradeClassId?: number | null;
  onGradeClassChange?: (classId: number) => void;
  onCreateGrade?: (payload: { student_id: number; component: string; score: number; weight: number }) => Promise<void>;
  onSaveGrades?: (studentId: number, items: Array<{ component: string; score: number; weight: number }>) => Promise<void>;
  onUpdateGrade?: (gradeId: number, payload: { score?: number; weight?: number }) => Promise<void>;
  onDeleteGrade?: (gradeId: number) => Promise<void>;
  onUpdateSchedule?: (updatedSchedule: ScheduleItem[]) => void;
  onCreateSchedule?: (item: ScheduleItem) => Promise<void>;
  onUpdateScheduleItem?: (item: ScheduleItem) => Promise<void>;
  onDeleteSchedule?: (scheduleId: string) => Promise<void>;
  scheduleLoading?: boolean;
  scheduleError?: string | null;
  attendanceSessions?: AttendanceSession[];
  onCreateAttendanceSession?: (newSession: {
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
  onStartAttendanceSession?: (sessionId: string) => void | Promise<void>;
  onCloseAttendanceSession?: (sessionId: string) => void | Promise<void>;
  onDeleteAttendanceSession?: (sessionId: string) => void | Promise<void>;
  onUpdateAttendanceRecord?: (
    sessionId: string,
    studentId: string,
    newStatus: AttendanceStatus,
    notes?: string
  ) => void;
  attendanceLoading?: boolean;
  attendanceError?: string | null;
  assignmentRequests?: ClassAssignmentRequest[];
  assignmentRequestLoading?: boolean;
  assignmentRequestError?: string | null;
  onApproveClassAssignment?: (requestId: number) => Promise<void>;
  onRejectClassAssignment?: (requestId: number) => Promise<void>;
}

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({
  activeTab,
  onTabChange,
  courses,
  schedule,
  assignments,
  roster,
  users,
  currentUser,
  onUpdateCourse,
  onDeleteCourse,
  onRemoveStudentFromClass,
  onUpdateAttendance,
  onMarkAllPresent,
  onCreateAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  assignmentsLoading,
  assignmentsError,
  onGradeSubmission,
  onUpdateScore,
  weights,
  onUpdateWeights,
  onUpdateStudentScores,
  gradeRecords,
  classResults,
  gradesLoading,
  gradesError,
  activeGradeClassId,
  onGradeClassChange,
  onCreateGrade,
  onSaveGrades,
  onUpdateGrade,
  onDeleteGrade,
  onUpdateSchedule,
  onCreateSchedule,
  onUpdateScheduleItem,
  onDeleteSchedule,
  scheduleLoading,
  scheduleError,
  attendanceSessions,
  onCreateAttendanceSession,
  onStartAttendanceSession,
  onCloseAttendanceSession,
  onDeleteAttendanceSession,
  onUpdateAttendanceRecord,
  attendanceLoading,
  attendanceError,
  assignmentRequests = [],
  assignmentRequestLoading = false,
  assignmentRequestError = null,
  onApproveClassAssignment,
  onRejectClassAssignment,
}) => {
  const [selectedAttendanceSchedule, setSelectedAttendanceSchedule] = useState<ScheduleItem | null>(null);

  if (activeTab === 'classes') {
    return (
      <div className="space-y-6">
        <LecturerClasses
          courses={courses}
          users={users}
          currentUser={currentUser}
          onUpdateCourse={onUpdateCourse}
          onDeleteCourse={onDeleteCourse}
          onRemoveStudentFromClass={onRemoveStudentFromClass}
          assignmentRequests={assignmentRequests}
          onApproveClassAssignment={onApproveClassAssignment}
          onRejectClassAssignment={onRejectClassAssignment}
          onTabChange={onTabChange}
          onGradeClassChange={onGradeClassChange}
        />
      </div>
    );
  }
  if (activeTab === 'schedule') {
    if (selectedAttendanceSchedule) {
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setSelectedAttendanceSchedule(null)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Quay lại lịch học
          </button>
          <LecturerAttendance
            roster={roster}
            courses={courses}
            schedule={schedule}
            selectedSchedule={selectedAttendanceSchedule}
            sessions={attendanceSessions}
            onUpdateAttendance={onUpdateAttendance}
            onMarkAllPresent={onMarkAllPresent}
            onCreateSession={onCreateAttendanceSession}
            onStartSession={onStartAttendanceSession}
            onCloseSession={onCloseAttendanceSession}
            onDeleteSession={onDeleteAttendanceSession}
            onUpdateSessionRecord={onUpdateAttendanceRecord}
            loading={attendanceLoading}
            error={attendanceError}
          />
        </div>
      );
    }
    return (
      <LecturerSchedule
        schedule={schedule}
        onUpdateSchedule={onUpdateSchedule}
        onCreateSchedule={onCreateSchedule}
        onUpdateScheduleItem={onUpdateScheduleItem}
        onDeleteSchedule={onDeleteSchedule}
        onAttendance={(item) => {
          setSelectedAttendanceSchedule(item);
        }}
        loading={scheduleLoading}
        error={scheduleError}
      />
    );
  }
  if (activeTab === 'attendance') {
    return (
      <LecturerAttendance
        roster={roster}
        courses={courses}
        schedule={schedule}
        selectedSchedule={selectedAttendanceSchedule}
        sessions={attendanceSessions}
        onUpdateAttendance={onUpdateAttendance}
        onMarkAllPresent={onMarkAllPresent}
        onCreateSession={onCreateAttendanceSession}
        onStartSession={onStartAttendanceSession}
        onCloseSession={onCloseAttendanceSession}
        onDeleteSession={onDeleteAttendanceSession}
        onUpdateSessionRecord={onUpdateAttendanceRecord}
        loading={attendanceLoading}
        error={attendanceError}
      />
    );
  }
  if (activeTab === 'assignments') {
    return (
      <LecturerAssignments
        assignments={assignments}
        courses={courses}
        onCreateAssignment={onCreateAssignment}
        onUpdateAssignment={onUpdateAssignment}
        onDeleteAssignment={onDeleteAssignment}
        loading={assignmentsLoading}
        error={assignmentsError}
        onGradeSubmission={onGradeSubmission}
      />
    );
  }
  if (activeTab === 'grades') {
    return (
      <LecturerGrades
        roster={roster}
        courses={courses}
        activeCourseCode={courses[0]?.code || courses[0]?.class_code || ''}
        weights={weights}
        onUpdateWeights={onUpdateWeights}
        onUpdateStudentScores={onUpdateStudentScores}
        gradeRecords={gradeRecords}
        classResults={classResults}
        gradesLoading={gradesLoading}
        gradesError={gradesError}
        activeGradeClassId={activeGradeClassId}
        onGradeClassChange={onGradeClassChange}
        onCreateGrade={onCreateGrade}
        onSaveGrades={onSaveGrades}
        onUpdateGrade={onUpdateGrade}
        onDeleteGrade={onDeleteGrade}
        onUpdateScore={onUpdateScore}
        assignments={assignments}
        attendanceSessions={attendanceSessions}
      />
    );
  }
  if (activeTab === 'analytics') {
    return (
      <LecturerAnalytics
        roster={roster}
        courses={courses}
        assignments={assignments}
        attendanceSessions={attendanceSessions}
      />
    );
  }
  if (activeTab === 'quizzes') return <LecturerQuizzes courses={courses} />;

  // Default: Overview Dashboard
  const liveSession = schedule[0];
  const pendingGradingCount = assignments.reduce((acc, a) => acc + (a.pendingGradingCount || 0), 0);
  const atRiskCount = roster.filter((r) => r.riskStatus === 'high').length;
  const enrolledStudentCount = courses.reduce((total, course) => {
    const profileCount = course.enrolledStudents?.length || 0;
    const idCount = course.enrolledStudentIds?.length || 0;
    return total + Math.max(profileCount, idCount, Number(course.enrolledCount) || 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Giảng viên cao cấp & thành viên khoa
              </span>
                <span className="text-xs text-slate-300">Mã: {currentUser?.lecturer_id || 'Chưa có dữ liệu'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Chào mừng quay lại, {currentUser?.full_name || 'Giảng viên'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              {currentUser?.department || 'Chưa có thông tin khoa'}. Bạn có {courses.length} lớp học và {pendingGradingCount} bài đang chờ xem xét.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => onTabChange('analytics')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 border border-white/20"
            >
              <BarChart3 className="w-4 h-4 text-indigo-300" />
              Analytics lớp học
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Lớp học được giao"
          value={`${courses.length} khóa học`}
          subtitle="Dữ liệu từ hệ thống"
          icon={BookOpen}
          colorScheme="indigo"
          onClick={() => onTabChange('classes')}
        />
        <StatCard
          title="Số sinh viên đã ghi danh"
          value={`${enrolledStudentCount} sinh viên`}
          subtitle="Dữ liệu từ hệ thống"
          icon={Users}
          colorScheme="blue"
          onClick={() => onTabChange('attendance')}
        />
        <StatCard
          title="Bài nộp chờ chấm"
          value={`${pendingGradingCount} bài chấm`}
          subtitle="Dữ liệu từ hệ thống"
          icon={FileText}
          colorScheme="amber"
          onClick={() => onTabChange('assignments')}
        />
        <StatCard
          title="Cảnh báo rủi ro"
          value={`${atRiskCount} sinh viên`}
          subtitle="Dữ liệu từ hệ thống"
          icon={BarChart3}
          colorScheme="rose"
          onClick={() => onTabChange('analytics')}
        />
      </div>

      {/* Main Grid: Active Lecture Card + Quick Roster Preview */}
      <div className="grid grid-cols-1 gap-5">
        <div className="space-y-5">
          {/* Active Lecture Card */}
          {liveSession && (
            <div className="bg-white rounded-2xl border-2 border-indigo-200 p-5 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                      Buổi giảng trực tiếp
                    </span>
                    <Badge variant="purple" size="sm">
                      {liveSession.type}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1.5">
                    {liveSession.courseCode}: {liveSession.courseTitle}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Topic: <strong>{liveSession.sessionTopic}</strong>
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs text-slate-400 block font-medium">Phòng học thông minh</span>
                  <span className="text-sm font-bold text-slate-800">{liveSession.room}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Thời gian: {liveSession.startTime} - {liveSession.endTime}</span>
                  <span>• Điểm danh: <strong className="text-emerald-600">Thủ công</strong></span>
                </div>

                <button
                  onClick={() => onTabChange('attendance')}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mở điểm danh
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Col */}
      </div>
    </div>
  );
};
