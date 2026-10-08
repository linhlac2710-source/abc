import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Users,
  Send,
  CheckCircle2,
  PieChart as PieIcon,
  ArrowUpRight,
  Filter,
  Award,
  BookOpen,
  Calendar,
  Clock,
  Mail,
  ShieldAlert,
  Search,
  Check,
  Sparkles,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts';
import { StudentRosterItem, Course, Assignment, AttendanceSession } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { TeachingAnalyticsAPI, TeachingQualityAnalytics } from '../../api/teachingAnalytics';

interface LecturerAnalyticsProps {
  roster: StudentRosterItem[];
  courses?: Course[];
  assignments?: Assignment[];
  attendanceSessions?: AttendanceSession[];
}

export const LecturerAnalytics: React.FC<LecturerAnalyticsProps> = ({
  roster,
  courses = [],
  assignments = [],
  attendanceSessions = [],
}) => {
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
  const [attentionFilter, setAttentionFilter] = useState<'all' | 'attendance' | 'grades' | 'assignments'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Intervention action states
  const [selectedStudentForIntervention, setSelectedStudentForIntervention] = useState<StudentRosterItem | null>(null);
  const [interventionType, setInterventionType] = useState<'warning' | 'office_hours' | 'makeup'>('warning');
  const [interventionNote, setInterventionNote] = useState('');
  const [sentInterventions, setSentInterventions] = useState<Record<string, string>>({});
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [realAnalytics, setRealAnalytics] = useState<TeachingQualityAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Active course context
  const getCourseKey = (course: Course) => String(course.code || course.class_code || course.id);
  const activeCourse = courses.find((course) => getCourseKey(course) === selectedCourseCode) || courses[0];
  useEffect(() => {
    const classId = Number(activeCourse?.id);
    if (!Number.isFinite(classId) || classId <= 0) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    TeachingAnalyticsAPI.teachingQuality(classId)
      .then(setRealAnalytics)
      .catch((err: unknown) => setAnalyticsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setAnalyticsLoading(false));
  }, [activeCourse?.id]);
  const courseStudents = useMemo(() => {
    return roster;
  }, [roster]);

  const totalStudents = courseStudents.length;

  // 1. CLASS AVERAGE CALCULATIONS
  const classStats = useMemo(() => {
    const average = (values: number[]) => values.length > 0
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
      : 0;
    const validGrades = courseStudents
      .map((student) => student.currentGradePercent ?? student.overallScore)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const overallAvg = average(validGrades);

    // Component averages
    const attScores = courseStudents.map((student) => student.attendanceScore ?? student.attendanceRate)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const asgScores = courseStudents.map((student) => student.assignmentScore)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const qzScores = courseStudents.map((student) => student.quizScore)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const midScores = courseStudents.map((student) => student.midtermScore)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const finScores = courseStudents
      .map((s) => s.finalScore)
      .filter((f): f is number => f !== undefined && f !== null);

    const attAvg = average(attScores);
    const asgAvg = average(asgScores);
    const qzAvg = average(qzScores);
    const midAvg = average(midScores);
    const finAvg = average(finScores);

    const gpaEstimate = overallAvg >= 90 ? 3.8 : overallAvg >= 80 ? 3.3 : overallAvg >= 70 ? 2.8 : overallAvg >= 60 ? 2.0 : 0;

    return {
      overallAvg,
      gpaEstimate,
      componentAverages: [
        { name: 'Điểm danh', avg: attAvg, weight: '10%', color: '#10b981' },
        { name: 'Assignments', avg: asgAvg, weight: '25%', color: '#6366f1' },
        { name: 'Quizzes', avg: qzAvg, weight: '15%', color: '#f59e0b' },
        { name: 'Giữa kỳ', avg: midAvg, weight: '20%', color: '#8b5cf6' },
        { name: 'Cuối kỳ', avg: finAvg, weight: '30%', color: '#06b6d4' },
      ],
    };
  }, [courseStudents]);

  // 2. ATTENDANCE DISTRIBUTION
  const attendanceDistribution = useMemo(() => {
    const excellent = courseStudents.filter((s) => (s.attendanceRate ?? 0) >= 90).length;
    const good = courseStudents.filter((s) => (s.attendanceRate ?? 0) >= 80 && (s.attendanceRate ?? 0) < 90).length;
    const warning = courseStudents.filter((s) => (s.attendanceRate ?? 0) >= 70 && (s.attendanceRate ?? 0) < 80).length;
    const critical = courseStudents.filter((s) => (s.attendanceRate ?? 0) < 70).length;

    const chartData = [
      { range: '≥90% (Excellent)', count: excellent, pct: totalStudents > 0 ? Math.round((excellent / totalStudents) * 100) : 0, fill: '#10b981' },
      { range: '80–89% (Good)', count: good, pct: totalStudents > 0 ? Math.round((good / totalStudents) * 100) : 0, fill: '#3b82f6' },
      { range: '70–79% (Warning)', count: warning, pct: totalStudents > 0 ? Math.round((warning / totalStudents) * 100) : 0, fill: '#f59e0b' },
      { range: '<70% (Critical)', count: critical, pct: totalStudents > 0 ? Math.round((critical / totalStudents) * 100) : 0, fill: '#ef4444' },
    ];

    const sessionTrend: { session: string; present: number; late: number; absent: number; rate: number }[] = [];

    return { buckets: chartData, sessionTrend, atRiskAttendanceCount: warning + critical };
  }, [courseStudents, totalStudents]);

  // 3. ASSIGNMENT COMPLETION
  const assignmentCompletionStats = useMemo(() => {
    const totalAssignmentsExpected = courseStudents.reduce((acc, s) => acc + (s.totalAssignments || 0), 0);
    const totalSubmitted = courseStudents.reduce((acc, s) => acc + (s.assignmentsSubmitted || 0), 0);
    const overallRate = totalAssignmentsExpected > 0 ? Math.round((totalSubmitted / totalAssignmentsExpected) * 1000) / 10 : 0;
    const assignmentScores = courseStudents.map((student) => student.assignmentScore)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const averageLabScore = assignmentScores.length > 0
      ? Math.round((assignmentScores.reduce((sum, score) => sum + score, 0) / assignmentScores.length) * 10) / 10
      : null;

    // Per-assignment breakdown
    const assignmentBreakdown: { name: string; submitted: number; total: number; rate: number; avgScore: number }[] = [];

    const pieData = [
      { name: 'Submitted On-Time', value: totalSubmitted, color: '#10b981' },
      { name: 'Missing / Late', value: Math.max(0, totalAssignmentsExpected - totalSubmitted), color: '#ef4444' },
    ];

    return {
      overallRate,
      averageLabScore,
      totalSubmitted,
      totalExpected: totalAssignmentsExpected,
      assignmentBreakdown,
      pieData,
    };
  }, [courseStudents]);

  // 4. GRADE DISTRIBUTION
  const gradeDistribution = useMemo(() => {
    const aCount = courseStudents.filter((r) => r.currentGradePercent >= 90).length;
    const bCount = courseStudents.filter((r) => r.currentGradePercent >= 80 && r.currentGradePercent < 90).length;
    const cCount = courseStudents.filter((r) => r.currentGradePercent >= 70 && r.currentGradePercent < 80).length;
    const dCount = courseStudents.filter((r) => r.currentGradePercent >= 60 && r.currentGradePercent < 70).length;
    const fCount = courseStudents.filter((r) => r.currentGradePercent < 60).length;

    const letterChartData = [
      { letter: 'Grade A (90-100%)', count: aCount, pct: totalStudents > 0 ? Math.round((aCount / totalStudents) * 100) : 0, fill: '#10b981' },
      { letter: 'Grade B (80-89%)', count: bCount, pct: totalStudents > 0 ? Math.round((bCount / totalStudents) * 100) : 0, fill: '#3b82f6' },
      { letter: 'Grade C (70-79%)', count: cCount, pct: totalStudents > 0 ? Math.round((cCount / totalStudents) * 100) : 0, fill: '#6366f1' },
      { letter: 'Grade D (60-69%)', count: dCount, pct: totalStudents > 0 ? Math.round((dCount / totalStudents) * 100) : 0, fill: '#f59e0b' },
      { letter: 'Grade F (<60%)', count: fCount, pct: totalStudents > 0 ? Math.round((fCount / totalStudents) * 100) : 0, fill: '#ef4444' },
    ];

    const scoreRanges = [
      { range: '90-100%', label: 'Distinction', count: aCount, fill: '#10b981' },
      { range: '80-89%', label: 'Merit', count: bCount, fill: '#3b82f6' },
      { range: '70-79%', label: 'Credit', count: cCount, fill: '#6366f1' },
      { range: '60-69%', label: 'Pass', count: dCount, fill: '#f59e0b' },
      { range: '<60%', label: 'At Risk', count: fCount, fill: '#ef4444' },
    ];

    const passRate = totalStudents > 0 ? Math.round(((aCount + bCount + cCount + dCount) / totalStudents) * 100) : 0;

    return { letterChartData, scoreRanges, passRate, honorsCount: aCount };
  }, [courseStudents, totalStudents]);

  // 5. STUDENTS REQUIRING ATTENTION
  const attentionStudents = useMemo(() => {
    return courseStudents
      .map((student) => {
        const attRate = student.attendanceRate ?? 0;
        const grade = student.currentGradePercent ?? student.overallScore ?? 0;
        const missingAsg = (student.totalAssignments || 0) - (student.assignmentsSubmitted || 0);

        const triggers: string[] = [];
        let severity: 'critical' | 'high' | 'moderate' = 'moderate';

        if (attRate < 75) {
          triggers.push(`Critical Attendance: ${attRate}% (below 80% cutoff)`);
          severity = 'critical';
        } else if (attRate < 80) {
          triggers.push(`Borderline Attendance: ${attRate}%`);
          severity = 'high';
        }

        if (grade < 60) {
          triggers.push(`Failing Grade: ${grade}% (Grade F)`);
          severity = 'critical';
        } else if (grade < 70) {
          triggers.push(`Low Academic Standing: ${grade}% (Grade D)`);
          severity = severity === 'critical' ? 'critical' : 'high';
        }

        if (missingAsg >= 2) {
          triggers.push(`Missing ${missingAsg} required laboratory assignments`);
          severity = severity === 'critical' ? 'critical' : 'high';
        } else if (missingAsg === 1) {
          triggers.push('1 Pending assignment submission');
        }

        if (student.riskStatus === 'high') {
          severity = 'critical';
        }

        const isAttentionRequired = triggers.length > 0 || student.riskStatus !== 'low';

        return {
          ...student,
          attendanceRate: attRate,
          currentGrade: grade,
          missingAssignments: missingAsg,
          triggers,
          severity,
          isAttentionRequired,
        };
      })
      .filter((s) => s.isAttentionRequired);
  }, [courseStudents]);

  // Filtered attention students
  const filteredAttentionStudents = useMemo(() => {
    return attentionStudents.filter((student) => {
      // Search filter
      const matchesSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentId.includes(searchQuery) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Category filter
      if (attentionFilter === 'attendance') return student.attendanceRate < 80;
      if (attentionFilter === 'grades') return student.currentGrade < 70;
      if (attentionFilter === 'assignments') return student.missingAssignments > 0;
      return true;
    });
  }, [attentionStudents, searchQuery, attentionFilter]);

  // Handle send intervention
  const handleOpenIntervention = (student: StudentRosterItem, type: 'warning' | 'office_hours' | 'makeup') => {
    setSelectedStudentForIntervention(student);
    setInterventionType(type);
    if (type === 'warning') {
      setInterventionNote(`Academic advisory: attendance or deliverables for ${activeCourse?.code || 'this class'} need follow-up.`);
    } else if (type === 'office_hours') {
      setInterventionNote('Please coordinate an office-hours appointment to review course progress.');
    } else {
      setInterventionNote('Please coordinate make-up submission requirements with the instructor.');
    }
  };

  const handleConfirmIntervention = () => {
    if (!selectedStudentForIntervention) return;
    const studentId = selectedStudentForIntervention.id;
    const actionLabel =
      interventionType === 'warning'
        ? 'Official Warning Issued'
        : interventionType === 'office_hours'
        ? 'Office Hours Invited'
        : 'Makeup Granted';

    setSentInterventions((prev) => ({
      ...prev,
      [studentId]: actionLabel,
    }));

    setSuccessToast(`Intervention dispatched to ${selectedStudentForIntervention.name} (${selectedStudentForIntervention.email}).`);
    setSelectedStudentForIntervention(null);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  if (analyticsLoading) return <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Loading teaching analytics...</div>;
  if (analyticsError) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{analyticsError}</div>;
  if (realAnalytics) {
    const { overview, assignments: assignmentStats, grades, attendance, quizzes, risks, recommendations } = realAnalytics;
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-black">Class Analytics</h2>
          <p className="text-xs text-slate-500">Chọn lớp để xem mức độ rủi ro và các chỉ số của từng sinh viên.</p>
        </div>
        <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Lớp giảng viên đang phụ trách</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const courseKey = getCourseKey(course);
              const isSelected = getCourseKey(activeCourse) === courseKey;
              return (
                <button
                  key={course.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCourseCode(courseKey)}
                  className={`min-h-24 rounded-2xl border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  <span className="block truncate text-lg font-bold">{course.code || course.class_code || `Lớp ${course.id}`}</span>
                  <span className={`mt-1 block truncate text-xs ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {course.title || course.class_name || 'Lớp học'}
                  </span>
                  <span className={`mt-2 block text-xs ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Bấm để xem phân tích rủi ro
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h3 className="font-bold">Kết quả phân tích rủi ro</h3>
          <p className="mt-2 text-sm">
            Đã đánh giá {risks.total_evaluated}/{overview.total_students} sinh viên · Thấp {risks.low_risk_count} ({risks.low_risk_percentage.toFixed(1)}%) · Trung bình {risks.medium_risk_count} ({risks.medium_risk_percentage.toFixed(1)}%) · Cao {risks.high_risk_count} ({risks.high_risk_percentage.toFixed(1)}%)
          </p>
          {risks.students.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Sinh viên</th>
                    <th className="py-2 pr-3">Mức / điểm rủi ro</th>
                    <th className="py-2 pr-3">Chuyên cần</th>
                    <th className="py-2 pr-3">Nộp bài</th>
                    <th className="py-2 pr-3">Điểm TB</th>
                    <th className="py-2">Bài quá hạn thiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.students.map((student) => (
                    <tr key={student.student_id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-slate-800">{student.student_name || '—'}</div>
                        <div className="text-slate-500">{student.student_code || `ID ${student.student_id}`}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant={student.risk_level === 'HIGH' ? 'rose' : student.risk_level === 'MEDIUM' ? 'amber' : 'blue'}
                          size="sm"
                        >
                          {student.risk_level === 'HIGH' ? 'Cao' : student.risk_level === 'MEDIUM' ? 'Trung bình' : 'Thấp'} · {(student.risk_score * 100).toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">{student.attendance_rate === null ? '—' : `${(student.attendance_rate * 100).toFixed(1)}%`}</td>
                      <td className="py-2 pr-3">{student.assignment_submission_rate === null ? '—' : `${(student.assignment_submission_rate * 100).toFixed(1)}%`}</td>
                      <td className="py-2 pr-3">{student.average_grade === null ? '—' : `${student.average_grade.toFixed(1)}/10`}</td>
                      <td className="py-2">{student.missing_assignment_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Chưa có đủ dữ liệu điểm danh, bài tập hoặc điểm số để đánh giá sinh viên trong lớp này.</p>
          )}
        </section>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[['Sinh viên', overview.total_students], ['Assignments', overview.total_assignments], ['Quizzes', overview.total_quizzes], ['Điểm danh', `${overview.attendance_rate ?? 0}%`], ['Completion', `${overview.assignment_completion_rate ?? 0}%`], ['Quiz avg', `${overview.quiz_average ?? 0}%`]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Assignment completion</h3><p className="mt-2 text-sm">{assignmentStats.total_submissions} submissions · {assignmentStats.assignment_completion_rate}% completion · {assignmentStats.overdue_missing_count} overdue missing</p></section>
          <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Grade statistics</h3><p className="mt-2 text-sm">Average {grades.average_grade ?? '—'} · Range {grades.minimum_grade ?? '—'}–{grades.maximum_grade ?? '—'} · {grades.graded_student_count} graded</p><p className="mt-2 text-xs">{grades.grade_distribution.map((item) => `${item.category}: ${item.student_count} (${item.percentage}%)`).join(' · ')}</p></section>
          <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Điểm danh</h3><p className="mt-2 text-sm">{attendance.attendance_rate}% present · {attendance.absence_rate}% absent · {attendance.total_sessions} sessions</p></section>
        </div>
        {realAnalytics.insights.length > 0 && <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Insights</h3>{realAnalytics.insights.map((insight) => <p key={insight} className="mt-2 text-sm text-slate-600">{insight}</p>)}</section>}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 animate-slideUp">
          <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <p className="text-xs font-medium">{successToast}</p>
          <button onClick={() => setSuccessToast(null)} className="text-slate-400 hover:text-white ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
              Faculty Analytics Console
            </span>
            <span className="text-xs text-slate-400">• Term: {activeCourse?.semester || '—'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Class Learning Analytics & Cohort Diagnostics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Statistical distributions, deliverables velocity, predictive diagnostics, and intervention management.
          </p>
        </div>

        {/* Course Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Cohort Course:</label>
          <div className="relative">
            <select
              value={selectedCourseCode || (courses[0] ? getCourseKey(courses[0]) : '')}
              onChange={(e) => setSelectedCourseCode(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl py-2 pl-3 pr-8 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {courses.length === 0 ? <option value="">Chưa có lớp</option> : courses.map((course) => (
                <option key={course.id} value={getCourseKey(course)}>
                  {course.code || course.class_code}: {course.title || course.class_name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 4 HIGH-LEVEL KPI METRICS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Class Average */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Class Average Score</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">
              {classStats.overallAvg}%
            </span>
            <span className="text-xs font-bold text-indigo-600">
              GPA ~{classStats.gpaEstimate}
            </span>
          </div>
          <div className="mt-2 text-[11.5px] text-slate-500">
            Cohort pass rate: <strong className="text-slate-800">{gradeDistribution.passRate}%</strong> ({gradeDistribution.honorsCount} Honors)
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-indigo-600 h-full rounded-full"
              style={{ width: `${classStats.overallAvg}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Average Attendance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Avg Attendance Rate</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">
              86.8%
            </span>
            <span className="text-xs font-bold text-emerald-600">
              +6.8% vs min
            </span>
          </div>
          <div className="mt-2 text-[11.5px] text-slate-500">
            {attendanceDistribution.atRiskAttendanceCount} student(s) below 80% threshold
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-emerald-500 h-full rounded-full"
              style={{ width: `86.8%` }}
            />
          </div>
        </div>

        {/* Metric 3: Assignment Completion */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Assignment Completion</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">
              {assignmentCompletionStats.overallRate}%
            </span>
            <span className="text-xs font-bold text-purple-600">
              {assignmentCompletionStats.totalSubmitted}/{assignmentCompletionStats.totalExpected} tasks
            </span>
          </div>
          <div className="mt-2 text-[11.5px] text-slate-500">
            Average lab score: <strong className="text-slate-800">{assignmentCompletionStats.averageLabScore === null ? '—' : `${assignmentCompletionStats.averageLabScore}%`}</strong>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-purple-600 h-full rounded-full"
              style={{ width: `${assignmentCompletionStats.overallRate}%` }}
            />
          </div>
        </div>

        {/* Metric 4: Attention Required */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Requiring Attention</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600 font-mono">
              {attentionStudents.length}
            </span>
            <span className="text-xs font-bold text-rose-600">
              Students Flagged
            </span>
          </div>
          <div className="mt-2 text-[11.5px] text-slate-500">
            Attendance &lt;80% or grade &lt;70%
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-rose-500 h-full rounded-full"
              style={{ width: `${(attentionStudents.length / totalStudents) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 1. CLASS AVERAGE BREAKDOWN & CORRELATION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          <h2 className="text-base font-bold text-slate-900">Class Average & Assessment Breakdown</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Component Averages Bar Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Cohort Average by Assessment Component (%)</h3>
                <p className="text-xs text-slate-500">Weights configured: Att 10% • Asg 25% • Quiz 15% • Mid 20% • Final 30%</p>
              </div>
              <Badge variant="indigo" size="sm">
                Overall: {classStats.overallAvg}%
              </Badge>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classStats.componentAverages} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2.5 rounded-xl shadow-lg space-y-1">
                            <p className="font-bold">{d.name}</p>
                            <p className="text-indigo-300 font-mono">Cohort Average: {d.avg}%</p>
                            <p className="text-slate-400">Component Weight: {d.weight}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                    {classStats.componentAverages.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historic & Benchmarking Insights Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Cohort Benchmark</h3>
                <Badge variant="slate" size="sm">Không có dữ liệu so sánh</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Chưa có số liệu các kỳ trước để đối chiếu.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600">Current Cohort</span>
                <span className="font-bold font-mono text-indigo-700 text-sm">{classStats.overallAvg}%</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11.5px] text-slate-600 leading-normal">
              Historical comparison will appear when prior-term data is available.
            </div>
          </div>
        </div>
      </div>

      {/* 2. ATTENDANCE DISTRIBUTION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <h2 className="text-base font-bold text-slate-900">Attendance Distribution & Session Tracking</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Attendance Bracket Histogram */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Attendance Range Distribution</h3>
              <p className="text-xs text-slate-500">Students segmented by cumulative attendance percentage</p>
            </div>

            <div className="h-56 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceDistribution.buckets} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2 rounded-xl shadow space-y-1">
                            <p className="font-bold">{d.range}</p>
                            <p className="text-emerald-300">{d.count} Students ({d.pct}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                    {attendanceDistribution.buckets.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              {attendanceDistribution.buckets.map((b) => (
                <div key={b.range} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.fill }} />
                    <span className="text-slate-600">{b.range}</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">{b.count} ({b.pct}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Session Attendance Rate Timeline (8 Lectures) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Lecture Session Attendance Timeline</h3>
                <p className="text-xs text-slate-500">Student attendance count across verified lecture dates</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent
                </span>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceDistribution.sessionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="session"
                    angle={-20}
                    textAnchor="end"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="present" name="Có mặt" stackId="s" fill="#10b981" />
                  <Bar dataKey="late" name="Đi muộn" stackId="s" fill="#f59e0b" />
                  <Bar dataKey="absent" name="Vắng mặt" stackId="s" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ASSIGNMENT COMPLETION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          <h2 className="text-base font-bold text-slate-900">Assignment Completion & Submission Velocity</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Per-Assignment Submission Rate Bar Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Tỷ lệ hoàn thành bài thực hành</h3>
                <p className="text-xs text-slate-500">Tỷ lệ nộp và điểm trung bình theo nhóm cho từng bài tập</p>
              </div>
              <Badge variant="purple" size="sm">
                Cohort Completion: {assignmentCompletionStats.overallRate}%
              </Badge>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assignmentCompletionStats.assignmentBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2.5 rounded-xl shadow-lg space-y-1">
                            <p className="font-bold">{d.name}</p>
                            <p className="text-purple-300 font-mono">Completion Rate: {d.rate}% ({d.submitted}/{d.total} students)</p>
                            <p className="text-slate-300">Average Grade: {d.avgScore}/100</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  <Bar dataKey="rate" name="Completion Rate (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgScore" name="Average Score (/100)" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Submission Timeliness Ratio */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Tỷ lệ nộp đúng hạn</h3>
              <p className="text-xs text-slate-500">Bài thực hành đã nộp và còn thiếu</p>
            </div>

            <div className="h-44 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assignmentCompletionStats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {assignmentCompletionStats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {assignmentCompletionStats.overallRate}%
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Đã nộp</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Submitted on-time
                </span>
                <span className="font-bold font-mono text-slate-900">
                  {assignmentCompletionStats.totalSubmitted} tasks
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Missing / Pending
                </span>
                <span className="font-bold font-mono text-rose-600">
                  {Math.max(0, assignmentCompletionStats.totalExpected - assignmentCompletionStats.totalSubmitted)} tasks
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. GRADE DISTRIBUTION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <h2 className="text-base font-bold text-slate-900">Phân bố điểm chữ & khoảng điểm</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Grade Letter Distribution Bar Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Biểu đồ điểm chữ</h3>
                <p className="text-xs text-slate-500">Số sinh viên theo phân loại điểm chữ cuối kỳ</p>
              </div>
              <Badge variant="blue" size="sm">
                Pass Rate: {gradeDistribution.passRate}%
              </Badge>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeDistribution.letterChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="letter" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2 rounded-xl shadow space-y-1">
                            <p className="font-bold">{d.letter}</p>
                            <p className="text-blue-300 font-mono">{d.count} Students ({d.pct}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                    {gradeDistribution.letterChartData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Numerical Score Range Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Phân tích khoảng điểm & xếp loại</h3>
              <p className="text-xs text-slate-500 mt-0.5">Calculated from 100% weighted component score formula</p>
            </div>

            <div className="space-y-3">
              {gradeDistribution.scoreRanges.map((range) => {
                const pct = Math.round((range.count / totalStudents) * 100);
                return (
                  <div key={range.range} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        {range.range} ({range.label})
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {range.count} students ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: range.fill }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[11px] font-semibold text-emerald-800 block">Dean’s Honor List (≥90%)</span>
                <span className="text-xl font-black text-emerald-950 font-mono mt-0.5 block">
                  {gradeDistribution.honorsCount} Students
                </span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[11px] font-semibold text-rose-800 block">Critical Concern (&lt;70%)</span>
                <span className="text-xl font-black text-rose-950 font-mono mt-0.5 block">
                  {courseStudents.filter((s) => s.currentGradePercent < 70).length} Students
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. STUDENTS REQUIRING ATTENTION */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <h2 className="text-base font-bold text-slate-900">Sinh viên cần quan tâm & dấu hiệu cảnh báo</h2>
            <Badge variant="rose" size="sm">
              {attentionStudents.length} Interventions Flagged
            </Badge>
          </div>

          {/* Filter pills & search */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search flagged students..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-44"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              {[
                { id: 'all', label: 'All Flagged' },
                { id: 'attendance', label: 'Attendance <80%' },
                { id: 'grades', label: 'Grade <70%' },
                { id: 'assignments', label: 'Missing Work' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setAttentionFilter(pill.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    attentionFilter === pill.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Attention Table / Card List */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {filteredAttentionStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-sm text-slate-800">Không có sinh viên phù hợp với bộ lọc đã chọn.</p>
              <p className="text-xs text-slate-400 mt-0.5">All other enrolled students are maintaining satisfactory benchmarks.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Hồ sơ sinh viên</th>
                    <th className="py-3 px-4">Điểm danh</th>
                    <th className="py-3 px-4">Điểm tổng</th>
                    <th className="py-3 px-4">Bài nộp</th>
                    <th className="py-3 px-4">Dấu hiệu cảnh báo sớm</th>
                    <th className="py-3 px-4 text-right">Hành động hỗ trợ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttentionStudents.map((student) => {
                    const isDispatched = sentInterventions[student.id];
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={student.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'Student')}&background=random`}
                              alt={student.name}
                              className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block">{student.name}</span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                ID: {student.studentId} • {student.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold ${
                              student.attendanceRate < 75
                                ? 'text-rose-600'
                                : student.attendanceRate < 80
                                ? 'text-amber-600'
                                : 'text-slate-800'
                            }`}>
                              {student.attendanceRate}%
                            </span>
                            {student.attendanceRate < 80 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                                &lt;80%
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block">Yêu cầu tối thiểu: 80%</span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {student.currentGrade}%
                            </span>
                            <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                              student.letterGrade.startsWith('A')
                                ? 'bg-emerald-100 text-emerald-800'
                                : student.letterGrade.startsWith('B')
                                ? 'bg-blue-100 text-blue-800'
                                : student.letterGrade.startsWith('C')
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {student.letterGrade}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">Tổng điểm có trọng số</span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-mono font-bold text-slate-800">
                            {student.assignmentsSubmitted} / {student.totalAssignments || 4}
                          </span>
                          {student.missingAssignments > 0 && (
                            <span className="text-[10.5px] text-rose-600 block font-medium">
                              {student.missingAssignments} missing
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 max-w-xs">
                          <div className="space-y-1">
                            {student.triggers.map((trigger, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100 mr-1 mb-1 font-medium"
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                                {trigger}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right">
                          {isDispatched ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                              <Check className="w-3.5 h-3.5" />
                              {isDispatched}
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenIntervention(student, 'warning')}
                                title="Send Early Warning Notice"
                                className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                              >
                                Warning
                              </button>
                              <button
                                onClick={() => handleOpenIntervention(student, 'office_hours')}
                                title="Invite to Office Hours"
                                className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                              >
                                Office Hours
                              </button>
                              <button
                                onClick={() => handleOpenIntervention(student, 'makeup')}
                                title="Grant Makeup Deliverable"
                                className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                              >
                                Makeup
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* INTERVENTION MODAL */}
      <Modal
        isOpen={!!selectedStudentForIntervention}
        onClose={() => setSelectedStudentForIntervention(null)}
        title={`Trigger Faculty Intervention: ${selectedStudentForIntervention?.name || ''}`}
        maxWidth="md"
      >
        {selectedStudentForIntervention && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <img
                src={selectedStudentForIntervention.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStudentForIntervention.name || 'Student')}&background=random`}
                alt={selectedStudentForIntervention.name}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-300"
              />
              <div>
                <span className="font-bold text-sm text-slate-900 block">{selectedStudentForIntervention.name}</span>
                <span className="text-xs text-slate-500 font-mono">
                  ID: {selectedStudentForIntervention.studentId} • {selectedStudentForIntervention.email}
                </span>
              </div>
            </div>

            {/* Type selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Quy trình hỗ trợ</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'warning', label: 'Early Warning', desc: 'Formal advisory notice' },
                  { id: 'office_hours', label: 'Office Hours', desc: '1-on-1 coaching invite' },
                  { id: 'makeup', label: 'Makeup Work', desc: 'Extended deadline' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setInterventionType(t.id as any);
                      if (t.id === 'warning') {
                        setInterventionNote(`Academic advisory: attendance or deliverables for ${activeCourse?.code || 'this class'} need follow-up.`);
                      } else if (t.id === 'office_hours') {
                        setInterventionNote('Please coordinate an office-hours appointment to review course progress.');
                      } else {
                        setInterventionNote(`Makeup Submission Authorized: Extended deadline granted for Lab 3 deliverables until end of week.`);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      interventionType === t.id
                        ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-900 block">{t.label}</span>
                    <span className="text-[11px] text-slate-500">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Note text area */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Thông báo & hướng dẫn tư vấn</label>
              <textarea
                value={interventionNote}
                onChange={(e) => setInterventionNote(e.target.value)}
                rows={4}
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter personalized feedback or meeting link..."
              />
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedStudentForIntervention(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmIntervention}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Dispatch Intervention Notice
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
