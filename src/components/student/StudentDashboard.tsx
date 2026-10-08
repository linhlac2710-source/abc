import React from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
  BookOpen,
  Upload,
  FileText,
  Compass,
  BarChart3,
} from 'lucide-react';
import {
  Course,
  ScheduleItem,
  Assignment,
  GradeItem,
  StudentAttendance as AttendanceType,
  LearningRiskFactor,
  RecommendedLearningItem,
  UserProfile,
  AttendanceSession,
  StudentAnalyticsData,
} from '../../types';
import { StatCard } from '../common/StatCard';
import { Badge } from '../common/Badge';
import { StudentClasses } from './StudentClasses';
import { StudentSchedule } from './StudentSchedule';
import { StudentAttendance } from './StudentAttendance';
import { StudentAssignments } from './StudentAssignments';
import { StudentGrades } from './StudentGrades';
import { StudentQuizzes } from './StudentQuizzes';
import { StudentRisk } from './StudentRisk';
import { getGradePoints, getLetterGrade, normalizeGradeScore } from '../../utils/gradeCalculations';
import { StudentLearningPath } from './StudentLearningPath';
import { StudentAnalytics } from './StudentAnalytics';
import {
  calculateAssignmentProgress,
  calculateStudentGradeSummary,
  calculateWeeklyAttendanceTrend,
} from '../../utils/studentAnalytics';

const emptyStudentAnalyticsData: StudentAnalyticsData = {
  attendance: { overallRate: 0, totalSessions: 0, attendedSessions: 0, lateSessions: 0, absentSessions: 0, weeklyTrend: [], courseBreakdown: [] },
  assignments: { completionRate: 0, totalAssigned: 0, completedCount: 0, gradedCount: 0, submittedCount: 0, pendingCount: 0, lateOrMissingCount: 0, onTimeRate: 0, submissionTrend: [] },
  grades: { cumulativeGpa: 0, overallPercentage: 0, letterGrade: '-', componentAverages: [], courseGrades: [], historicalProgression: [] },
  quizzes: { overallAverage: 0, quizzesTaken: 0, totalQuizzes: 0, records: [], topicMastery: [] },
  learningProgress: { overallProgressPct: 0, activeStreakDays: 0, studyHoursThisWeek: 0, competenciesAchieved: 0, totalCompetencies: 0, courseProgressList: [], weeklyActivityHours: [] },
};

interface StudentDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  courses: Course[];
  schedule: ScheduleItem[];
  assignments: Assignment[];
  grades: GradeItem[];
  attendanceData: AttendanceType[];
  riskFactors: LearningRiskFactor[];
  learningPaths: RecommendedLearningItem[];
  currentUser?: UserProfile | null;
  onCheckIn?: (scheduleId: string, code: string) => boolean | Promise<boolean>;
  onSubmitAssignment: (assignmentId: string, fileName: string) => void;
  onRequestJoinClass?: (courseId: string) => void;
  onUnenrollClass?: (courseId: string) => Promise<void> | void;
  onRefreshCourses?: () => Promise<void>;
  onRefreshSchedule?: () => Promise<void>;
  onRefreshGrades?: () => Promise<void> | void;
  onUpdateSchedule?: (updatedSchedule: ScheduleItem[]) => void;
  attendanceSessions?: AttendanceSession[];
  onCheckInAttendanceSession?: (sessionId: string, code: string) => Promise<boolean> | boolean;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  activeTab,
  onTabChange,
  courses,
  schedule,
  assignments,
  grades,
  attendanceData,
  riskFactors,
  learningPaths,
  currentUser,
  onCheckIn,
  onSubmitAssignment,
  onRequestJoinClass,
  onUnenrollClass,
  onRefreshCourses,
  onRefreshSchedule,
  onRefreshGrades,
  onUpdateSchedule,
  attendanceSessions,
  onCheckInAttendanceSession,
}) => {
  const gradeItems = grades.filter(Boolean);
  const gradedCourseItems = gradeItems.filter((item) =>
    (item.components || []).some((component) =>
      !String(component.key || component.name || '').toLowerCase().includes('attendance') &&
      Number(component.weight) > 0
    )
  );
  const gradeSummary = calculateStudentGradeSummary(gradeItems, getGradePoints, getLetterGrade);
  const assignmentProgress = calculateAssignmentProgress(assignments);
  const attendanceByCourse = courses.map((course) => {
    const courseCode = String(course.code || course.class_code || '');
    const courseTitle = String(course.title || course.class_name || '');
    const normalize = (value?: string) => String(value || '').trim().toLowerCase();
    const summary = attendanceData.find((item) => normalize(item.courseCode) === normalize(courseCode));

    return summary || {
      courseCode,
      courseTitle,
      totalSessions: 0,
      attendedSessions: 0,
      lateSessions: 0,
      absentSessions: 0,
      percentage: 0,
      minRequiredPercentage: 80,
      status: 'good' as const,
      recentSessions: [],
    };
  });
  const gradeAverageDisplay = gradeSummary.overallPercentage;
  const academicGpaDisplay = gradeSummary.cumulativeGpa;

  const studentIdentifiers = new Set(
    [currentUser?.student_code, currentUser?.studentId, currentUser?.student_id, currentUser?.id, currentUser?.full_name, currentUser?.name]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
  );
  const hasRecordedSessions = (attendanceSessions || []).some((session) =>
    session.status === 'closed' || session.records?.some((record) => {
      const studentId = String(record.studentId || '').trim().toLowerCase();
      const studentName = String(record.studentName || '').trim().toLowerCase();
      return studentIdentifiers.has(studentId) || (studentName && studentIdentifiers.has(studentName));
    })
  );
  const gradeSyncedAttendanceData = attendanceByCourse.map((item) => {
    const course = courses.find(
      (entry) => entry.code.trim().toLowerCase() === item.courseCode.trim().toLowerCase()
        || entry.class_code.trim().toLowerCase() === item.courseCode.trim().toLowerCase()
    );
    const grade = gradeItems.find(
      (entry) => String(entry.id) === String(course?.id)
        || entry.courseCode.trim().toLowerCase() === item.courseCode.trim().toLowerCase()
    );
    const courseSessions = (attendanceSessions || []).filter((session) =>
      String(session.courseId) === String(course?.id || grade?.id)
        || String(session.courseCode || '').trim().toLowerCase() === item.courseCode.trim().toLowerCase()
    );
    const uniqueSessions = Array.from(
      courseSessions.reduce((map, session) => {
        const key = `${session.date}|${session.startTime}|${session.endTime}`;
        if (!map.has(key)) map.set(key, session);
        return map;
      }, new Map<string, AttendanceSession>()).values()
    ).filter((session) => session.status === 'closed' || (session.records?.some((record) => {
      const studentId = String(record.studentId || '').trim().toLowerCase();
      const studentName = String(record.studentName || '').trim().toLowerCase();
      return studentIdentifiers.has(studentId) || (studentName && studentIdentifiers.has(studentName));
    }) ?? false));

    let stats = grade?.attendanceStats;
    if (uniqueSessions.length > 0) {
      let present = 0;
      let late = 0;
      uniqueSessions.forEach((session) => {
        const record = session.records?.find((entry) => {
          const studentId = String(entry.studentId || '').trim().toLowerCase();
          const studentName = String(entry.studentName || '').trim().toLowerCase();
          return studentIdentifiers.has(studentId) || (studentName && studentIdentifiers.has(studentName));
        });
        if (record?.status === 'present' || record?.status === 'excused') present++;
        else if (record?.status === 'late') late++;
      });

      const total = uniqueSessions.length;
      const absent = Math.max(0, total - present - late);
      const attendanceRate = Math.round(((present + late) / total) * 100);
      stats = {
        total,
        present,
        late,
        absent,
        attendanceRate,
        absenceRate: Math.round((absent / total) * 100),
        attendanceExceeded: absent / total > 0.2,
        attendanceScore: absent / total > 0.2 ? 0 : attendanceRate,
      };
    } else if (hasRecordedSessions) {
      stats = undefined;
    }

    if (!stats || stats.total <= 0) {
      if (hasRecordedSessions) {
        return {
          ...item,
          totalSessions: 0,
          attendedSessions: 0,
          lateSessions: 0,
          absentSessions: 0,
          percentage: 0,
          attendanceExceeded: false,
        };
      }

      const attendanceExceeded = item.totalSessions > 0 && item.absentSessions / item.totalSessions > 0.2;
      return {
        ...item,
        percentage: item.totalSessions > 0
          ? Number((((item.attendedSessions + item.lateSessions) / item.totalSessions) * 100).toFixed(1))
          : item.percentage,
        attendanceExceeded,
      };
    }

    return {
      ...item,
      totalSessions: stats.total,
      attendedSessions: stats.present,
      lateSessions: stats.late,
      absentSessions: stats.absent,
      percentage: stats.total > 0
        ? Number((((stats.present + stats.late) / stats.total) * 100).toFixed(1))
        : 0,
      attendanceExceeded: stats.total > 0 && stats.absent / stats.total > 0.2,
      status: stats.total > 0 && stats.absent / stats.total > 0.2 ? 'warning' as const : 'good' as const,
    };
  });

  // If specific sub-tab is chosen:
  if (activeTab === 'classes') {
    return (
      <StudentClasses
        courses={courses}
        currentUser={currentUser}
        onRequestJoinClass={onRequestJoinClass}
        onUnenrollClass={onUnenrollClass}
        onRefreshCourses={onRefreshCourses}
        onRefreshSchedule={onRefreshSchedule}
      />
    );
  }
  if (activeTab === 'schedule') {
    return (
      <StudentSchedule
        schedule={schedule}
        onCheckIn={onCheckIn}
        onUpdateSchedule={onUpdateSchedule}
      />
    );
  }
  if (activeTab === 'attendance') {
    return (
      <StudentAttendance
        attendanceData={gradeSyncedAttendanceData}
        sessions={attendanceSessions}
        currentUser={currentUser}
        onCheckIn={onCheckInAttendanceSession}
      />
    );
  }
  if (activeTab === 'assignments') return <StudentAssignments assignments={assignments} onSubmitAssignment={onSubmitAssignment} />;
  if (activeTab === 'grades') {
    return (
      <StudentGrades
        grades={grades}
        attendanceSessions={attendanceSessions}
        currentUser={currentUser}
        courses={courses}
        onRefreshGrades={onRefreshGrades || onRefreshCourses}
      />
    );
  }
  if (activeTab === 'quizzes') return (
    <div className="bg-white rounded-2xl p-6">
      <StudentQuizzes classIds={courses.map((c) => c.id)} />
    </div>
  );
  if (activeTab === 'analytics') {
    const effectiveAttendanceData = gradeSyncedAttendanceData;

    const updatedBreakdown = effectiveAttendanceData.map((item) => ({
      courseCode: item.courseCode,
      courseTitle: item.courseTitle,
      rate: item.totalSessions > 0
        ? Number((((item.attendedSessions + (item.lateSessions || 0)) / item.totalSessions) * 100).toFixed(1))
        : 0,
      attended: item.attendedSessions,
      total: item.totalSessions,
      minRequired: item.minRequiredPercentage || 80,
    }));

    const totalSessions = updatedBreakdown.reduce((sum, c) => sum + c.total, 0);
    const attendedSessions = updatedBreakdown.reduce((sum, c) => sum + c.attended, 0);
    const lateSessions = effectiveAttendanceData.reduce((sum, c) => sum + (c.lateSessions || 0), 0);
    const absentSessions = effectiveAttendanceData.reduce((sum, c) => sum + (c.absentSessions || 0), 0);
    const overallRate = totalSessions > 0
      ? Number((((attendedSessions + lateSessions) / totalSessions) * 100).toFixed(1))
      : 0;

    const enrolledCourseKeys = new Set(
      courses.flatMap((course) => [course.id, course.code, course.class_code])
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
    );
    const weeklyTrend = calculateWeeklyAttendanceTrend(
      attendanceSessions || [],
      studentIdentifiers,
      enrolledCourseKeys
    );
    const currentGpa = academicGpaDisplay ?? 0;
    const currentScore = gradeAverageDisplay ?? 0;
    const getComponentAverage = (componentName: string) => {
      const components = gradedCourseItems.flatMap((item) => item.components || [])
        .filter((component) =>
          String(component.key || component.name || '').toLowerCase().includes(componentName) &&
          Number(component.weight) > 0
        );
      return {
        score: components.length > 0
          ? components.reduce((sum, component) => sum + normalizeGradeScore(component.score), 0) / components.length
          : 0,
        weight: components.length > 0
          ? components.reduce((sum, component) => sum + Number(component.weight), 0) / components.length
          : 0,
      };
    };
    const assignmentAverage = getComponentAverage('assignment');
    const midtermAverage = getComponentAverage('midterm');
    const finalAverage = getComponentAverage('final');

    const analyticsData: StudentAnalyticsData = {
      attendance: {
        overallRate,
        totalSessions,
        attendedSessions,
        lateSessions,
        absentSessions,
        weeklyTrend,
        courseBreakdown: updatedBreakdown,
      },
      assignments: {
        ...assignmentProgress,
        submissionTrend: assignments.length > 0 ? assignments.slice(0, 6).map((a) => ({
          name: a.title,
          score: a.studentScore === undefined ? 0 : Number(((a.studentScore / (a.maxScore || 10)) * 100).toFixed(1)),
          weight: a.weightPercent ?? 10,
          status: String(a.status).toLowerCase() === 'graded' ? 'Graded' : String(a.status).toLowerCase() === 'pending' ? 'Pending' : 'Submitted',
          dueDate: a.dueDate || 'N/A',
        })) : [],
      },
      grades: {
        cumulativeGpa: gradeSummary.cumulativeGpa ?? 0,
        overallPercentage: gradeSummary.overallPercentage ?? 0,
        letterGrade: gradeSummary.letterGrade,
        componentAverages: [
          {
            component: 'Attendance',
            studentScore: overallRate,
            classAvg: 0,
            weight: 0,
          },
          {
            component: 'Assignments',
            studentScore: assignmentAverage.score,
            classAvg: 0,
            weight: assignmentAverage.weight,
          },
          {
            component: 'Midterm',
            studentScore: midtermAverage.score,
            classAvg: 0,
            weight: midtermAverage.weight,
          },
          {
            component: 'Final',
            studentScore: finalAverage.score,
            classAvg: 0,
            weight: finalAverage.weight,
          },
        ],
        courseGrades: gradedCourseItems.length > 0
          ? gradedCourseItems.map((item) => ({
              courseCode: item.courseCode,
              courseTitle: item.courseTitle,
              percentage: Number((item.currentPercentage || 0).toFixed(1)),
              letter: item.letterGrade || getLetterGrade(item.currentPercentage || 0),
              gpa: typeof item.gradePoints === 'number' ? item.gradePoints : getGradePoints(item.letterGrade || getLetterGrade(item.currentPercentage || 0)),
            }))
          : [],
        historicalProgression: [],
      },
      quizzes: emptyStudentAnalyticsData.quizzes,
      learningProgress: {
        overallProgressPct: currentScore,
        activeStreakDays: 0,
        studyHoursThisWeek: 0,
        competenciesAchieved: 0,
        totalCompetencies: 0,
        courseProgressList: gradedCourseItems.length > 0
          ? gradedCourseItems.map((item) => ({
              courseCode: item.courseCode,
              courseTitle: item.courseTitle,
              progressPercent: item.currentPercentage || 0,
              completedModules: Math.round((item.currentPercentage || 0) / 10),
              totalModules: 10,
              nextMilestone: 'Continue current pace',
            }))
          : [],
        weeklyActivityHours: [],
      },
    };

    return (
      <StudentAnalytics
        analyticsData={analyticsData}
        onNavigateTab={onTabChange}
      />
    );
  }
  if (activeTab === 'risk') return <StudentRisk riskFactors={riskFactors} />;
  if (activeTab === 'learning_path') return <StudentLearningPath learningPaths={learningPaths} courses={courses} />;

  // Default: Overview Dashboard
  const pendingAssignments = assignments.filter((a) => a.status === 'pending');
  const highRisk = riskFactors.find((r) => r.level === 'high');
  const gradedAssignments = assignments.filter(
    (assignment) => assignment.status === 'graded' && assignment.studentScore !== undefined
  );
  const assignmentAverage = gradedAssignments.length > 0
    ? gradedAssignments.reduce((total, assignment) => total + ((assignment.studentScore || 0) / (assignment.maxScore || 10)) * 10, 0) / gradedAssignments.length
    : null;
  const academicGpa = academicGpaDisplay ?? (
    assignmentAverage === null
      ? null
      : getGradePoints(getLetterGrade(assignmentAverage))
  );
  const academicStanding = academicGpaDisplay !== null
    ? (academicGpaDisplay >= 3.6 ? 'Xuất sắc' : academicGpaDisplay >= 3.2 ? 'Giỏi' : academicGpaDisplay >= 2.5 ? 'Khá' : academicGpaDisplay >= 2.0 ? 'Trung bình' : 'Yếu')
    : assignmentAverage === null
    ? 'Chưa có dữ liệu'
    : assignmentAverage >= 8.5 ? 'Xuất sắc'
    : assignmentAverage >= 8.0 ? 'Giỏi'
    : assignmentAverage >= 7.0 ? 'Khá'
    : assignmentAverage >= 5.5 ? 'Trung bình'
    : 'Yếu';

  const effectiveOverviewAttendance = gradeSyncedAttendanceData;
  const totalSessionsAll = effectiveOverviewAttendance.reduce((acc, c) => acc + (c.totalSessions || 0), 0);
  const attendedSessionsAll = effectiveOverviewAttendance.reduce((acc, c) => acc + (c.attendedSessions || 0), 0);
  const lateSessionsAll = effectiveOverviewAttendance.reduce((acc, c) => acc + (c.lateSessions || 0), 0);
  const overallAttendance = totalSessionsAll > 0
    ? Number((((attendedSessionsAll + lateSessionsAll) / totalSessionsAll) * 100).toFixed(1))
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Sinh viên
              </span>
              <span className="text-xs text-slate-300">MSSV: {currentUser?.student_id || currentUser?.studentId || 'Chưa có dữ liệu'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Chào mừng quay lại, {currentUser?.full_name || currentUser?.name || 'Sinh viên'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              {currentUser?.department || 'Chưa có thông tin khoa'}. Bạn có {courses.length} lớp học và {pendingAssignments.length} bài tập đang chờ xử lý.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => onTabChange('analytics')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 border border-white/20"
            >
              <BarChart3 className="w-4 h-4 text-indigo-300" />
              Analytics học tập
            </button>
            <button
              onClick={() => onTabChange('schedule')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Xem thời khóa biểu
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          id="stat-gpa"
          title="GPA học kỳ hiện tại"
          value={academicGpa === null ? '-' : academicGpa.toFixed(2)}
          subtitle={academicStanding}
          icon={Award}
          colorScheme="indigo"
          onClick={() => onTabChange('grades')}
        />
        <StatCard
          id="stat-assignments"
          title="Công việc chờ xử lý"
          value={pendingAssignments.length}
          subtitle={gradeAverageDisplay === null ? (assignmentAverage === null ? 'Chưa có điểm bài tập' : `Điểm TB bài tập: ${assignmentAverage.toFixed(1)}/10`) : `Điểm giảng viên cho: ${gradeAverageDisplay.toFixed(1)}%`}
          icon={FileText}
          colorScheme="amber"
          onClick={() => onTabChange('assignments')}
        />
        <StatCard
          id="stat-attendance"
          title="Tỷ lệ chuyên cần"
          value={`${overallAttendance}%`}
          subtitle={
            totalSessionsAll > 0
              ? `${attendedSessionsAll} có mặt, ${lateSessionsAll} đi muộn / ${totalSessionsAll} buổi (Y/c: ≥80%)`
              : 'Chưa có dữ liệu'
          }
          icon={CheckCircle2}
          colorScheme={overallAttendance >= 80 ? 'emerald' : 'rose'}
          onClick={() => onTabChange('attendance')}
        />
        <StatCard
          id="stat-risk"
          title="Mức độ rủi ro học tập"
          value={`${highRisk ? 1 : 0} lớp học`}
          subtitle="Dữ liệu từ hệ thống"
          icon={AlertTriangle}
          colorScheme="rose"
          onClick={() => onTabChange('risk')}
        />
      </div>

      {/* Primary Section: Learning Risk Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Schedule Snapshot */}
        <div className="lg:col-span-2 space-y-5">
          {/* Pending Assignments Snapshot */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Nhiệm vụ ưu tiên & hạn chót</h3>
                <p className="text-xs text-slate-500">Các công việc sắp tới cần nộp</p>
              </div>
              <button
                onClick={() => onTabChange('assignments')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Xem tất cả ({assignments.length})
              </button>
            </div>

            <div className="space-y-2.5">
              {pendingAssignments.slice(0, 2).map((asg) => (
                <div
                  key={asg.id}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-indigo-700">{asg.courseCode}</span>
                      <span className="font-semibold text-slate-900">{asg.title}</span>
                    </div>
                    <p className="text-[11.5px] text-slate-500">
                      Hạn nộp {asg.dueDate} • Weight {asg.weightPercent}%
                    </p>
                  </div>

                  <button
                    onClick={() => onTabChange('assignments')}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold rounded-lg shrink-0 transition-colors"
                  >
                    Nộp bài
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Learning Risk Alert & Lộ trình đề xuất Widget */}
        <div className="space-y-5">
          {/* Learning Risk Card */}
          {highRisk && (
            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Cảnh báo rủi ro học tập
                </span>
              </div>

              <div>
                <h4 className="font-bold text-rose-950 text-sm">{highRisk.title}</h4>
                <p className="text-xs text-rose-800/90 mt-1 leading-relaxed">
                  {highRisk.reason}
                </p>
              </div>

              <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-rose-900">
                  Metric: {highRisk.metric}
                </span>
                <button
                  onClick={() => onTabChange('risk')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  Khắc phục
                </button>
              </div>
            </div>
          )}

          {/* Lộ trình đề xuất Teaser */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Lộ trình đề xuất</h3>
              </div>
              <button
                onClick={() => onTabChange('learning_path')}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Khám phá
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Các mô-đun được cá nhân hóa để củng cố các kỹ năng trọng tâm cho kỳ thi:
            </p>

            <div className="space-y-2">
              {learningPaths.slice(0, 2).map((item) => (
                <div
                  key={item.id}
                  onClick={() => onTabChange('learning_path')}
                  className="p-3 bg-slate-50 hover:bg-indigo-50/40 rounded-xl border border-slate-200/70 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-800 line-clamp-1">{item.title}</span>
                    <Badge variant={item.category === 'Remedial' ? 'amber' : 'blue'} size="sm">
                      {item.category}
                    </Badge>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
