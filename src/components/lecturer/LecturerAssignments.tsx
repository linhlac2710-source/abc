import React, { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  Users,
  Award,
  Upload,
  ChevronRight,
  Filter,
  Search,
  ArrowLeft,
  Download,
  MessageSquare,
  AlertTriangle,
  Check,
  Calendar,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Assignment, AssignmentSubmission, Course } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

interface LecturerAssignmentsProps {
  assignments: Assignment[];
  courses?: Course[];
  onCreateAssignment: (newAsg: Omit<Assignment, 'id'>) => void;
  onUpdateAssignment?: (assignment: Assignment) => Promise<void>;
  onDeleteAssignment?: (assignmentId: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
  onGradeSubmission?: (asgId: string, studentId: string, score: number, feedback: string) => void | Promise<void>;
}

export const LecturerAssignments: React.FC<LecturerAssignmentsProps> = ({
  assignments,
  courses = [],
  onCreateAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  loading,
  error,
  onGradeSubmission,
}) => {
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeViewingSubmissionsAsg, setActiveViewingSubmissionsAsg] = useState<Assignment | null>(null);
  const [activeGradingSub, setActiveGradingSub] = useState<{
    asg: Assignment;
    submission: AssignmentSubmission;
  } | null>(null);

  // Submissions search & filter state
  const [submissionsSearch, setSubmissionsSearch] = useState('');
  const [submissionsFilter, setSubmissionsFilter] = useState<'all' | 'needs_grading' | 'graded' | 'missing'>('all');

  // Form State for creating assignment
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [dueDateDate, setDueDateDate] = useState('2026-10-05');
  const [dueDateTime, setDueDateTime] = useState('23:59');
  const [weight, setWeight] = useState(20);
  const [maxScore, setMaxScore] = useState(10);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (courses.length > 0 && !courses.some((course) => (course.code || course.class_code) === courseCode)) {
      setCourseCode(courses[0].code || courses[0].class_code);
    }
  }, [courses, courseCode]);

  // Grading Modal State
  const [gradeScore, setGradeScore] = useState<number>(9);
  const [gradeFeedback, setGradeFeedback] = useState<string>('');
  const [gradeSaved, setGradeSaved] = useState(false);

  // Handle Preset Deadlines
  const applyDeadlinePreset = (daysAhead: number, timeStr = '23:59') => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const dateStr = d.toISOString().slice(0, 10);
    setDueDateDate(dateStr);
    setDueDateTime(timeStr);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const fullDueDate = `${dueDateDate} ${dueDateTime}`;
    const selectedCourse = courses.find(
      (course) => course.code === courseCode || course.class_code === courseCode
    );
    if (!selectedCourse) return;

    onCreateAssignment({
      courseId: selectedCourse.id,
      courseCode,
      courseTitle: selectedCourse.title || selectedCourse.class_name,
      title: title.trim(),
      description: description.trim(),
      dueDate: fullDueDate,
      weightPercent: Number(weight),
      maxScore: Number(maxScore),
      status: 'pending',
      totalSubmissions: 0,
      pendingGradingCount: 0,
      submissions: [],
    });

    setShowCreateModal(false);
    setTitle('');
    setDescription('');
  };

  // Open grading modal for a student submission
  const openGradingModal = (asg: Assignment, sub: AssignmentSubmission) => {
    setActiveGradingSub({ asg, submission: sub });
    setGradeScore(sub.score !== undefined ? sub.score : 0);
    setGradeFeedback(sub.feedback || '');
    setGradeSaved(false);
  };

  // Save grade
  const handleSaveGrade = async () => {
    if (!activeGradingSub) return;
    const { asg, submission } = activeGradingSub;

    if (onGradeSubmission) {
      await onGradeSubmission(asg.id, submission.studentId, Number(gradeScore), gradeFeedback.trim());
    }

    setGradeSaved(true);
    setTimeout(() => {
      // Update currently viewed assignment if active
      if (activeViewingSubmissionsAsg && activeViewingSubmissionsAsg.id === asg.id) {
        const updatedSubs = (activeViewingSubmissionsAsg.submissions || []).map((s) =>
          s.studentId === submission.studentId
            ? {
                ...s,
                status: 'graded' as const,
                score: Number(gradeScore),
                feedback: gradeFeedback.trim(),
                gradedAt: 'Just now',
                gradedBy: '',
              }
            : s
        );
        setActiveViewingSubmissionsAsg({
          ...activeViewingSubmissionsAsg,
          submissions: updatedSubs,
          pendingGradingCount: updatedSubs.filter((s) => s.status === 'submitted' || s.status === 'late').length,
        });
      }
      setActiveGradingSub(null);
      setGradeSaved(false);
    }, 900);
  };

  // Helper stats across all assignments
  const totalAssignments = assignments.length;
  const totalPendingGrading = assignments.reduce((acc, a) => acc + (a.pendingGradingCount || 0), 0);
  const totalSubmissions = assignments.reduce((acc, a) => acc + (a.totalSubmissions || 0), 0);

  // If currently viewing submissions for a specific assignment:
  if (activeViewingSubmissionsAsg) {
    // Current assignment being viewed
    const curAsg =
      assignments.find((a) => a.id === activeViewingSubmissionsAsg.id) || activeViewingSubmissionsAsg;
    const subs = curAsg.submissions || [];

    const filteredSubs = subs.filter((sub) => {
      const matchSearch =
        sub.studentName.toLowerCase().includes(submissionsSearch.toLowerCase()) ||
        sub.studentId.includes(submissionsSearch) ||
        sub.studentEmail.toLowerCase().includes(submissionsSearch.toLowerCase());

      if (!matchSearch) return false;

      if (submissionsFilter === 'needs_grading') {
        return sub.status === 'submitted' || sub.status === 'late';
      }
      if (submissionsFilter === 'graded') {
        return sub.status === 'graded';
      }
      if (submissionsFilter === 'missing') {
        return sub.status === 'missing';
      }
      return true;
    });

    const enrolledTotal = subs.length;
    const submittedCount = subs.filter((s) => s.status !== 'missing').length;
    const needsGradingCount = subs.filter((s) => s.status === 'submitted' || s.status === 'late').length;
    const gradedCount = subs.filter((s) => s.status === 'graded').length;
    const gradedWithScore = subs.filter((s) => s.status === 'graded' && s.score !== undefined);
    const avgScore =
      gradedWithScore.length > 0
        ? Math.round(
            (gradedWithScore.reduce((acc, s) => acc + (s.score || 0), 0) / gradedWithScore.length) * 10
          ) / 10
        : 0;

    return (
      <div className="space-y-6">
        {loading && <div className="text-xs text-slate-500">Đang tải lại bài tập...</div>}
        {error && <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}
        {/* Back and Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              id="btn-back-to-assignments"
              onClick={() => {
                setActiveViewingSubmissionsAsg(null);
                setSubmissionsSearch('');
                setSubmissionsFilter('all');
              }}
              className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-colors shadow-2xs"
              title="Back to assignments list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-indigo-700 text-xs px-2 py-0.5 bg-indigo-50 rounded-md">
                  {curAsg.courseCode}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-medium">{curAsg.courseTitle}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
                Submissions: {curAsg.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 px-3.5 py-2 rounded-xl">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>
              Deadline: <strong className="text-slate-900">{curAsg.dueDate}</strong>
            </span>
          </div>
        </div>

        {/* Assignment Info Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 text-xs text-slate-700 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Assignment Description & Deliverables
            </span>
            <div className="flex items-center gap-3 font-medium text-slate-600">
              <span>Weight: {curAsg.weightPercent}%</span>
              <span>•</span>
              <span>Max Points: {curAsg.maxScore} pts</span>
            </div>
          </div>
          <p className="leading-relaxed text-slate-600">{curAsg.description}</p>
        </div>

        {/* Submissions Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 block">Danh sách đã đăng ký</span>
            <span className="text-xl font-black text-slate-900 mt-0.5 block">{enrolledTotal}</span>
            <span className="text-[10px] text-slate-400">Tổng sinh viên</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-blue-600 block">Đã nộp</span>
            <span className="text-xl font-black text-blue-900 mt-0.5 block">{submittedCount}</span>
            <span className="text-[10px] text-blue-500 font-medium">
              {enrolledTotal > 0 ? Math.round((submittedCount / enrolledTotal) * 100) : 0}% turn-in rate
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-amber-700 block">Cần chấm điểm</span>
            <span className="text-xl font-black text-amber-800 mt-0.5 block">{needsGradingCount}</span>
            <span className="text-[10px] text-amber-600 font-medium">Chờ duyệt</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-emerald-700 block">Đã chấm</span>
            <span className="text-xl font-black text-emerald-800 mt-0.5 block">{gradedCount}</span>
            <span className="text-[10px] text-emerald-600 font-medium">Đã công bố nhận xét</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[11px] font-medium text-indigo-700 block">Điểm trung bình</span>
            <span className="text-xl font-black text-indigo-900 mt-0.5 block">
              {avgScore > 0 ? `${avgScore} / ${curAsg.maxScore}` : 'N/A'}
            </span>
            <span className="text-[10px] text-indigo-500 font-medium">Kết quả lớp học</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-search-submissions"
              value={submissionsSearch}
              onChange={(e) => setSubmissionsSearch(e.target.value)}
              placeholder="Search student by name, student ID, or email..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: 'all', label: `All (${subs.length})` },
                { id: 'needs_grading', label: `Needs Grading (${needsGradingCount})` },
                { id: 'graded', label: `Graded (${gradedCount})` },
                { id: 'missing', label: `Missing (${subs.filter((s) => s.status === 'missing').length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                id={`filter-submissions-${tab.id}`}
                onClick={() => setSubmissionsFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                  submissionsFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submissions Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Trạng thái nộp bài</th>
                  <th className="px-4 py-3.5">Tệp / bài nộp</th>
                  <th className="px-4 py-3.5">Thời gian nộp</th>
                  <th className="px-4 py-3.5">Score</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No submissions found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSubs.map((sub) => {
                    const isGraded = sub.status === 'graded';
                    const isSubmitted = sub.status === 'submitted';
                    const isLate = sub.status === 'late';
                    const isMissing = sub.status === 'missing';

                    return (
                      <tr key={sub.id} id={`sub-row-${sub.studentId}`} className="hover:bg-slate-50/70 transition-colors">
                        {/* Student Name & ID */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={
                                sub.avatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.studentName || 'Student')}&background=6366f1&color=fff`
                              }
                              alt={sub.studentName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block">{sub.studentName}</span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                ID: {sub.studentId} • {sub.studentEmail}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          {isGraded && (
                            <Badge variant="emerald" size="sm">
                              Graded
                            </Badge>
                          )}
                          {isSubmitted && (
                            <Badge variant="blue" size="sm">
                              Submitted
                            </Badge>
                          )}
                          {isLate && (
                            <Badge variant="amber" size="sm">
                              Submitted Late
                            </Badge>
                          )}
                          {isMissing && (
                            <Badge variant="slate" size="sm">
                              Not Submitted
                            </Badge>
                          )}
                        </td>

                        {/* Artifact */}
                        <td className="px-4 py-3.5">
                          {sub.fileName ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 font-mono text-indigo-700 font-semibold">
                                <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span className="truncate max-w-[170px]">{sub.fileName}</span>
                                {sub.fileSize && (
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    ({sub.fileSize})
                                  </span>
                                )}
                              </div>
                              {sub.notes && (
                                <p className="text-[11px] text-slate-500 italic truncate max-w-[220px]">
                                  "{sub.notes}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Chưa tải tệp lên</span>
                          )}
                        </td>

                        {/* Submission Time */}
                        <td className="px-4 py-3.5">
                          {sub.submittedAt ? (
                            <div className="flex items-center gap-1 text-slate-600 font-medium">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{sub.submittedAt}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Score */}
                        <td className="px-4 py-3.5">
                          {isGraded && sub.score !== undefined ? (
                            <div>
                              <span className="text-sm font-black text-slate-900">
                                {sub.score}
                                <span className="text-xs font-normal text-slate-400">/{curAsg.maxScore}</span>
                              </span>
                              {sub.feedback && (
                                <div className="text-[10px] text-emerald-700 truncate max-w-[150px] flex items-center gap-1 mt-0.5">
                                  <MessageSquare className="w-2.5 h-2.5 shrink-0" />
                                  <span>Đã thêm nhận xét</span>
                                </div>
                              )}
                            </div>
                          ) : isSubmitted || isLate ? (
                            <span className="text-amber-700 font-semibold text-[11px]">Chờ chấm điểm</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          {!isMissing ? (
                            <button
                              id={`btn-grade-student-${sub.studentId}`}
                              onClick={() => openGradingModal(curAsg, sub)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                                isGraded
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
                              }`}
                            >
                              {isGraded ? 'Edit Grade & Feedback' : 'Grade Submission'}
                            </button>
                          ) : (
                            <button
                              onClick={() => alert(`Automated reminder sent to ${sub.studentName} (${sub.studentEmail})`)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              Send Reminder
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Evaluation / Grade Modal */}
        {activeGradingSub && (
          <Modal
            isOpen={!!activeGradingSub}
            onClose={() => setActiveGradingSub(null)}
            title={`Evaluate Submission: ${activeGradingSub.asg.title}`}
            subtitle={`${activeGradingSub.asg.courseCode} • Student: ${activeGradingSub.submission.studentName} (${activeGradingSub.submission.studentId})`}
            maxWidth="lg"
          >
            {gradeSaved ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Đã công bố đánh giá & nhận xét!</h4>
                <p className="text-xs text-slate-500">
                  Student will see their score ({gradeScore}/{activeGradingSub.asg.maxScore}) and remarks in their portal.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Artifact Preview Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Bài nộp:</span>
                      <span className="font-mono text-indigo-600 font-bold">
                        {activeGradingSub.submission.fileName || '—'}
                      </span>
                      {activeGradingSub.submission.fileSize && (
                        <span className="text-slate-400 text-[11px] ml-2">
                          ({activeGradingSub.submission.fileSize})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => alert(`Downloading artifact: ${activeGradingSub.submission.fileName}`)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      Download File
                    </button>
                  </div>

                  {activeGradingSub.submission.notes && (
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-700 block text-[11px]">
                        Student Notes / Repository Link:
                      </span>
                      <p className="text-slate-600 text-[11px] mt-0.5 font-mono break-all">
                        {activeGradingSub.submission.notes}
                      </p>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Submitted: {activeGradingSub.submission.submittedAt || '—'}</span>
                  </div>
                </div>

                {/* Score Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      Score (out of {activeGradingSub.asg.maxScore} points)
                    </label>
                    <span className="text-slate-500 font-medium text-[11px]">
                      {Math.round((gradeScore / activeGradingSub.asg.maxScore) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      id="input-grade-score"
                      min="0"
                      max={activeGradingSub.asg.maxScore}
                      value={gradeScore}
                      onChange={(e) => setGradeScore(Math.max(0, Math.min(activeGradingSub.asg.maxScore, Number(e.target.value))))}
                      className="w-32 p-2.5 text-base font-bold font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    />
                    <span className="text-slate-400 text-xs font-semibold">/ {activeGradingSub.asg.maxScore} Maximum</span>
                  </div>
                </div>

                {/* Feedback Input */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lecturer Feedback & Qualitative Remarks
                  </label>
                  <textarea
                    rows={3}
                    id="textarea-grade-feedback"
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    placeholder="Provide constructive guidance on code structure, test coverage, and benchmark performance..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />

                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveGradingSub(null)}
                    className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="btn-confirm-save-grade"
                    onClick={handleSaveGrade}
                    className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Publish Grade & Feedback
                  </button>
                </div>
              </div>
            )}
          </Modal>
        )}
      </div>
    );
  }

  // Primary View: All Assignments List
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Quản lý bài tập & bài nộp</h2>
          <p className="text-xs text-slate-500 mt-1">
            Author assignments, define deadlines, and inspect student submission artifacts.
          </p>
        </div>

        <button
          id="btn-create-assignment-open"
          onClick={() => setShowCreateModal(true)}
          disabled={courses.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Create New Assignment
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Tổng bài tập</span>
            <span className="text-xl font-black text-slate-900">{totalAssignments} Active</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Tổng bài nộp</span>
            <span className="text-xl font-black text-slate-900">{totalSubmissions} Received</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Cần chấm điểm</span>
            <span className="text-xl font-black text-amber-700">{totalPendingGrading} Pending</span>
          </div>
        </div>
      </div>

      {/* Assignments List */}
      <div className="space-y-3.5">
        {assignments.map((asg) => {
          const subs = asg.submissions || [];
          const submittedCount = subs.length > 0 ? subs.filter((s) => s.status !== 'missing').length : (asg.totalSubmissions || 0);
          const pendingCount = subs.length > 0 ? subs.filter((s) => s.status === 'submitted' || s.status === 'late').length : (asg.pendingGradingCount || 0);
          const gradedCount = subs.length > 0 ? subs.filter((s) => s.status === 'graded').length : 0;

          return (
            <div
              key={asg.id}
              id={`lec-assignment-${asg.id}`}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-indigo-700 text-xs px-2 py-0.5 bg-indigo-50 rounded-md">
                    {asg.courseCode}
                  </span>
                  <span className="text-slate-300">•</span>
                  <h3 className="font-bold text-slate-900 text-sm">{asg.title}</h3>
                  <Badge variant="blue" size="sm">
                    {asg.weightPercent}% Weight
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">{asg.description}</p>

                <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                  <span className="flex items-center gap-1.5 font-medium text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <strong>Hạn nộp:</strong> {asg.dueDate}
                  </span>
                  <span>Max Points: {asg.maxScore}</span>
                  <span className="text-indigo-600 font-semibold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {submittedCount} Submissions ({pendingCount} awaiting review)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                <button
                  id={`btn-view-submissions-${asg.id}`}
                  onClick={() => setActiveViewingSubmissionsAsg(asg)}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  View Submissions ({submittedCount})
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                {onUpdateAssignment && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextTitle = window.prompt('Assignment title', asg.title);
                      if (nextTitle && nextTitle.trim() && onUpdateAssignment) {
                        void onUpdateAssignment({ ...asg, title: nextTitle.trim() });
                      }
                    }}
                    className="px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-xl"
                  >
                    Edit
                  </button>
                )}
                {onDeleteAssignment && (
                  <button
                    type="button"
                    onClick={() => { void onDeleteAssignment(asg.id); }}
                    className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 rounded-xl"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New Course Assignment"
          subtitle="Set assignment title, description, and submission deadline"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            {/* Target Course & Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Học phần</label>
                <select
                  id="select-assignment-course"
                  required
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                >
                  {courses.length === 0 ? (
                    <option value="">Chưa có lớp được phân công</option>
                  ) : (
                    courses.map((course) => (
                      <option key={course.id} value={course.code || course.class_code}>
                        {course.code || course.class_code} - {course.title || course.class_name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ngày & giờ hết hạn</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    id="input-assignment-duedate"
                    required
                    value={dueDateDate}
                    onChange={(e) => setDueDateDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                  <input
                    type="time"
                    id="input-assignment-duetime"
                    required
                    value={dueDateTime}
                    onChange={(e) => setDueDateTime(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Quick Deadline Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400 font-medium">Mốc hạn nhanh:</span>
              <button
                type="button"
                onClick={() => applyDeadlinePreset(3, '23:59')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg text-[11px] font-medium transition-colors"
              >
                In 3 Days (23:59)
              </button>
              <button
                type="button"
                onClick={() => applyDeadlinePreset(7, '23:59')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg text-[11px] font-medium transition-colors"
              >
                In 1 Week (23:59)
              </button>
              <button
                type="button"
                onClick={() => applyDeadlinePreset(14, '23:59')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg text-[11px] font-medium transition-colors"
              >
                In 2 Weeks (23:59)
              </button>
            </div>

            {/* Assignment Title */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tên bài tập</label>
              <input
                type="text"
                id="input-assignment-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lab 4: Consensus State Machine Implementation"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            {/* Grade Weight & Max Score */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Trọng số điểm (%)</label>
                <input
                  type="number"
                  id="input-assignment-weight"
                  min="1"
                  max="50"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Điểm tối đa</label>
                <input
                  type="number"
                  id="input-assignment-maxscore"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
            </div>

            {/* Assignment Description & Instructions */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Assignment Description & Submission Instructions
              </label>
              <textarea
                rows={4}
                id="textarea-assignment-description"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detail technical requirements, expected repository structure, deliverables, and benchmark criteria..."
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-confirm-create-assignment"
                className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Publish Assignment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
