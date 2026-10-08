import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Clock,
  Award,
  AlertTriangle,
  BookOpen,
  Calendar,
  Flame,
  HelpCircle,
  ArrowUpRight,
  Filter,
  Sparkles,
  ChevronRight,
  GraduationCap,
  PieChart as PieIcon,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { StudentAnalyticsData } from '../../types';
import { Badge } from '../common/Badge';

interface StudentAnalyticsProps {
  analyticsData: StudentAnalyticsData;
  onNavigateTab?: (tabId: string) => void;
}

export const StudentAnalytics: React.FC<StudentAnalyticsProps> = ({
  analyticsData,
  onNavigateTab,
}) => {
  const [activeSection, setActiveSection] = useState<'all' | 'attendance' | 'assignments' | 'grades'>('all');

  const { attendance, assignments, grades } = analyticsData;

  // Assignment donut chart data
  const assignmentStatusData = [
    { name: 'Completed & Graded', value: assignments.gradedCount, color: '#10b981' },
    { name: 'Pending Review', value: assignments.submittedCount, color: '#6366f1' },
    { name: 'Pending', value: assignments.pendingCount, color: '#94a3b8' },
    { name: 'Late or Missing', value: assignments.lateOrMissingCount, color: '#f43f5e' },
  ];
  const gradedAssignmentScores = assignments.submissionTrend
    .filter((assignment) => assignment.status === 'Graded')
    .map((assignment) => assignment.score);
  const assignmentScoreAverage = gradedAssignmentScores.length > 0
    ? gradedAssignmentScores.reduce((sum, score) => sum + score, 0) / gradedAssignmentScores.length
    : null;

  // Grade component comparison data for charts
  const gradeComponentData = grades.componentAverages.map((c) => ({
    name: c.component,
    'My Score': c.studentScore,
    'Class Average': c.classAvg,
  }));

  return (
    <div className="space-y-7">
      {/* Top Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          Diagnostic breakdown of your attendance reliability, assignment deliverables, exam performance, and learning mastery.
        </p>
      </div>

      {/* Core metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveSection('attendance')}
          className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-xs transition-all ${
            activeSection === 'attendance' ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600 mb-3">
            <span className="text-[15px] font-medium">Attendance Rate</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-black text-slate-900 font-mono leading-none">{attendance.overallRate}%</span>
            <span className={`text-[11px] font-semibold ${attendance.overallRate >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {attendance.overallRate >= 80 ? `+${(attendance.overallRate - 80).toFixed(1)}%` : `${(attendance.overallRate - 80).toFixed(1)}%`} vs min
            </span>
          </div>
          <div className="mt-3 text-[13px] text-slate-500">
            {attendance.attendedSessions + attendance.lateSessions} of {attendance.totalSessions} class sessions attended
            ({attendance.attendedSessions} present, {attendance.lateSessions} late)
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, attendance.overallRate))}%` }} />
          </div>
        </div>

        <div
          onClick={() => setActiveSection('assignments')}
          className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-xs transition-all ${
            activeSection === 'assignments' ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600 mb-3">
            <span className="text-[15px] font-medium">Assignment Rate</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-black text-slate-900 font-mono leading-none">{assignments.completionRate}%</span>
            <span className="text-[11px] font-semibold text-indigo-600">{assignments.onTimeRate}% on-time</span>
          </div>
          <div className="mt-3 text-[13px] text-slate-500">
            {assignments.completedCount} of {assignments.totalAssigned} deliverables <br /> completed
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${assignments.completionRate}%` }} />
          </div>
        </div>

        <div
          onClick={() => setActiveSection('grades')}
          className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-xs transition-all ${
            activeSection === 'grades' ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600 mb-3">
            <span className="text-[15px] font-medium">Average Grade</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-black text-slate-900 font-mono leading-none">
              {grades.courseGrades.length > 0 ? `${(grades.overallPercentage / 10).toFixed(1)}/10` : '—'}
            </span>
            <span className="text-[11px] font-semibold text-violet-600">Grade {grades.letterGrade}</span>
          </div>
          <div className="mt-2 text-[13px] text-slate-500">
            {grades.courseGrades.length > 0 ? `${grades.overallPercentage}%` : 'Chưa có điểm đã chấm'}
          </div>
          <div className="mt-3 text-[13px] text-slate-500">
            GPA tích lũy: {grades.cumulativeGpa.toFixed(2)} / 4.0
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, Math.max(0, grades.overallPercentage))}%` }} />
          </div>
        </div>
      </div>

      {/* SECTION 1: ATTENDANCE RATE ANALYTICS */}
      {(activeSection === 'all' || activeSection === 'attendance') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-base font-bold text-slate-900">Attendance Rate Analysis</h2>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('attendance')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Open Attendance Manager
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Weekly Attendance Trend Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Weekly Attendance Reliability (%)</h3>
                  <p className="text-xs text-slate-500">Attendance from your recorded class sessions, grouped by week</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Attendance %
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-500 font-medium">
                    <span className="w-2.5 h-0.5 bg-rose-500" /> 80% Threshold
                  </span>
                </div>
              </div>

              <div className="h-64 w-full pt-2">
                {attendance.weeklyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={attendance.weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="attendanceColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white text-xs p-2.5 rounded-xl shadow-lg space-y-1">
                                <p className="font-bold">Tuần bắt đầu {label}</p>
                                <p className="text-emerald-400 font-mono">Tỷ lệ: {data.rate}%</p>
                                <p className="text-slate-300">{data.attended}/{data.total} buổi tham gia</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Min 80%', fill: '#f43f5e', fontSize: 10, position: 'insideTopLeft' }} />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#attendanceColor)"
                        dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                    Chưa có dữ liệu điểm danh theo tuần.
                  </div>
                )}
              </div>
            </div>

            {/* Course-by-Course Attendance Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Course Attendance Compliance</h3>
                <p className="text-xs text-slate-500 mt-0.5">Faculty requirement: ≥80% for exam eligibility</p>
              </div>

              <div className="space-y-3">
                {attendance.courseBreakdown.map((c) => {
                  const isWarning = c.rate < 80;
                  return (
                    <div key={c.courseCode} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{c.courseCode}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[11px]">{c.attended}/{c.total} sess</span>
                          <span className={`font-mono font-bold ${isWarning ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {c.rate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isWarning ? 'bg-rose-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, c.rate)}%` }}
                        />
                      </div>
                      {isWarning && (
                        <p className="text-[10.5px] text-rose-600 font-medium flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Risk: Below 80% threshold. Consult faculty.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase">Có mặt</span>
                  <span className="font-bold text-slate-800 text-sm">{attendance.attendedSessions}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase">Đi muộn</span>
                  <span className="font-bold text-amber-600 text-sm">{attendance.lateSessions}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase">Vắng mặt</span>
                  <span className="font-bold text-rose-600 text-sm">{attendance.absentSessions}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: ASSIGNMENT COMPLETION RATE */}
      {(activeSection === 'all' || activeSection === 'assignments') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <h2 className="text-base font-bold text-slate-900">Assignment Completion & Submission Velocity</h2>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('assignments')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                View Assignments
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Status Donut Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Deliverables Status Ratio</h3>
                <p className="text-xs text-slate-500 mt-0.5">Summary across your registered courses</p>
              </div>

              <div className="h-48 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assignmentStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {assignmentStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900 font-mono">{assignments.completionRate}%</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Đã hoàn thành</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                {assignmentStatusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 font-mono">{item.value} tasks</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Assignment Score Trajectory */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Lab Deliverable Scores & Performance</h3>
                  <p className="text-xs text-slate-500">Graded submissions score trajectory (/100)</p>
                </div>
                <Badge variant="indigo" size="sm">
                  Avg: {assignmentScoreAverage === null ? '—' : `${assignmentScoreAverage.toFixed(1)}%`} on Labs
                </Badge>
              </div>

              <div className="h-60 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assignments.submissionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-20}
                      textAnchor="end"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white text-xs p-2.5 rounded-xl shadow-lg space-y-1">
                              <p className="font-bold">{data.name}</p>
                              <p className="text-indigo-300 font-mono">Score: {data.score > 0 ? `${data.score}/100` : 'Pending'}</p>
                              <p className="text-slate-400">Due: {data.dueDate} • Status: {data.status}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="score" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: AVERAGE GRADE & ACADEMIC STANDING */}
      {(activeSection === 'all' || activeSection === 'grades') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <h2 className="text-base font-bold text-slate-900">Average Grade & Performance Benchmarks</h2>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('grades')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Full Transcript & What-If Simulator
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Component Grade Comparison (Student vs Class Average) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Component Score vs Class Average</h3>
                  <p className="text-xs text-slate-500">Benchmark your 5 component grades against peer cohort</p>
                </div>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeComponentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="My Score" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Class Average" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Enrolled Courses Grade Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Current Semester Enrolled Course Grades</h3>
                <p className="text-xs text-slate-500">Official evaluation based on configured component weights</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Học phần</th>
                    <th className="py-3 px-4">Subject Title</th>
                    <th className="py-3 px-4">Weighted Score</th>
                    <th className="py-3 px-4">Letter Grade</th>
                    <th className="py-3 px-4">GPA (4.0)</th>
                    <th className="py-3 px-4 text-right">Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grades.courseGrades.map((course) => (
                    <tr key={course.courseCode} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">{course.courseCode}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">{course.courseTitle}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{course.percentage}%</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                          course.letter.startsWith('A')
                            ? 'bg-emerald-100 text-emerald-800'
                            : course.letter.startsWith('B')
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {course.letter}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">{course.gpa.toFixed(1)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Good Standing
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
