import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  Clock,
  Upload,
  CheckCircle2,
  AlertCircle,
  Filter,
  FileCheck,
  ChevronRight,
  Search,
  Download,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Assignment } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { getLetterGrade } from '../../utils/gradeCalculations';

interface StudentAssignmentsProps {
  assignments: Assignment[];
  onSubmitAssignment: (assignmentId: string, fileName: string, notes?: string) => void;
}

export const StudentAssignments: React.FC<StudentAssignmentsProps> = ({
  assignments,
  onSubmitAssignment,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [activeSubmitItem, setActiveSubmitItem] = useState<Assignment | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [selectedFileSize, setSelectedFileSize] = useState<string>('9.4 MB');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [academicIntegrityChecked, setAcademicIntegrityChecked] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [activeFeedbackItem, setActiveFeedbackItem] = useState<Assignment | null>(null);
  const [expandedInstructions, setExpandedInstructions] = useState<Record<string, boolean>>({});

  // Calculate deadline urgency helper
  const getDeadlineStatus = (dueDateStr: string, isSubmitted: boolean) => {
    try {
      const now = new Date('2026-09-20T22:50:00'); // current simulated time
      const target = new Date(dueDateStr.replace(' ', 'T'));
      const diffMs = target.getTime() - now.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (isSubmitted) {
        return { label: 'Submitted on time', type: 'completed' as const, text: 'Turned In' };
      }

      if (diffMs < 0) {
        return { label: 'Deadline passed (Late)', type: 'overdue' as const, text: 'Overdue' };
      }

      if (diffHours <= 24) {
        return {
          label: `âš¡ Due in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`,
          type: 'urgent' as const,
          text: `Due in ${diffHours}h`,
        };
      }

      if (diffDays <= 4) {
        return {
          label: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`,
          type: 'soon' as const,
          text: `In ${diffDays} days`,
        };
      }

      return {
        label: `Due in ${diffDays} days`,
        type: 'normal' as const,
        text: `In ${diffDays} days`,
      };
    } catch {
      return { label: `Due: ${dueDateStr}`, type: 'normal' as const, text: 'Upcoming' };
    }
  };

  // Filter assignments
  const filteredAssignments = assignments.filter((a) => {
    // Status filter
    if (filter === 'pending' && a.status !== 'pending') return false;
    if (filter === 'submitted' && a.status !== 'submitted') return false;
    if (filter === 'graded' && a.status !== 'graded' && a.status !== 'late') return false;

    // Course filter
    if (courseFilter !== 'all' && a.courseCode !== courseFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        a.title.toLowerCase().includes(q) ||
        a.courseCode.toLowerCase().includes(q) ||
        a.courseTitle.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Unique course list for dropdown
  const courseOptions = Array.from(new Set(assignments.map((a) => a.courseCode)));

  // KPI calculations
  const totalCount = assignments.length;
  const pendingCount = assignments.filter((a) => a.status === 'pending').length;
  const submittedCount = assignments.filter((a) => a.status === 'submitted').length;
  const gradedCount = assignments.filter((a) => a.status === 'graded' || a.status === 'late').length;

  const gradedAssignments = assignments.filter(
    (a) => (a.status === 'graded' || a.status === 'late') && a.studentScore !== undefined
  );
  const avgScore =
    gradedAssignments.length > 0
      ? Math.round(
          (gradedAssignments.reduce((acc, a) => acc + (a.studentScore || 0), 0) / gradedAssignments.length) * 10
        ) / 10
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmitItem) return;
    if (!selectedFile.trim()) {
      setSubmitError('Please select a file before submitting.');
      return;
    }
    // Use backend submission API when available
    (async () => {
      setSubmitting(true);
      setSubmitError(undefined);
      const fileName = selectedFile.trim();
      try {
        // Delegate submission to parent App which will call backend APIs.
        const result = await (onSubmitAssignment as any)(activeSubmitItem.id, fileName, submissionNotes);
        // If parent returned falsy, surface generic error
        if (result === false) {
          setSubmitError('Submission failed.');
        } else {
          setSubmitSuccess(true);
          setTimeout(() => {
            setSubmitSuccess(false);
            setActiveSubmitItem(null);
            setSelectedFile('');
            setSubmissionNotes('');
          }, 1000);
        }
      } catch (err: any) {
        const msg = err?.message || (err?.data && err.data.detail) || String(err);
        setSubmitError(msg || 'Submission failed.');
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const toggleInstructions = (id: string) => {
    setExpandedInstructions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Course Assignments & Tasks</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track lab deliverables, manage deadlines, submit coursework, and inspect grading feedback.
          </p>
        </div>

        {/* Global Stats Banner */}
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 shadow-2xs text-xs text-slate-600 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>
              Cumulative Grade: <strong className="text-slate-900">{avgScore > 0 ? `${avgScore}%` : 'N/A'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Total Tasks</span>
          <span className="text-xl font-black text-slate-900 mt-0.5 block">{totalCount}</span>
          <span className="text-[10px] text-slate-400">All registered courses</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-amber-700 block">Pending Submission</span>
          <span className="text-xl font-black text-amber-800 mt-0.5 block">{pendingCount}</span>
          <span className="text-[10px] text-amber-600 font-medium">Due soon</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-blue-600 block">Submitted Work</span>
          <span className="text-xl font-black text-blue-900 mt-0.5 block">{submittedCount}</span>
          <span className="text-[10px] text-blue-500 font-medium">Awaiting evaluation</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-emerald-700 block">Graded & Evaluated</span>
          <span className="text-xl font-black text-emerald-800 mt-0.5 block">{gradedCount}</span>
          <span className="text-[10px] text-emerald-600 font-medium">Feedback ready</span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-student-asg-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assignment title, topic, or course..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
            />
          </div>

          {/* Course Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Course:</span>
            <select
              id="select-student-course-filter"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 font-semibold"
            >
              <option value="all">All Courses</option>
              {courseOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2.5 overflow-x-auto">
          {(
            [
              { id: 'all', label: `All Tasks (${assignments.length})` },
              { id: 'pending', label: `To Submit (${pendingCount})` },
              { id: 'submitted', label: `Submitted (${submittedCount})` },
              { id: 'graded', label: `Graded & Evaluated (${gradedCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              id={`filter-asg-${tab.id}`}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                filter === tab.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assignment Cards List */}
      <div className="space-y-4">
        {filteredAssignments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
            <FileCheck className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Không có bài tập phù hợp với bộ lọc.</p>
            <p className="text-xs text-slate-400">Hãy điều chỉnh bộ lọc trạng thái hoặc từ khóa tìm kiếm.</p>
          </div>
        ) : (
          filteredAssignments.map((asg) => {
            const isPending = asg.status === 'pending';
            const isGraded = asg.status === 'graded' || asg.status === 'late';
            const isSubmitted = asg.status === 'submitted';
            const isLate = asg.status === 'late';
            const isMissing = asg.status === 'missing';

            const deadlineInfo = getDeadlineStatus(asg.dueDate, !isPending);
            const isExpanded = !!expandedInstructions[asg.id];

            return (
              <div
                key={asg.id}
                id={`assignment-card-${asg.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-sm transition-all duration-200 space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-indigo-700 text-xs px-2 py-0.5 bg-indigo-50 rounded-md">
                        {asg.courseCode}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-500 font-medium">{asg.courseTitle}</span>
                      <span className="text-slate-300">•</span>
                      <Badge variant="blue" size="sm">
                        {asg.weightPercent}% Course Weight
                      </Badge>
                      <Badge variant="purple" size="sm">
                        Max: {asg.maxScore} pts
                      </Badge>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base">{asg.title}</h3>
                  </div>

                  {/* Submission Status Badge */}
                  <div className="shrink-0 flex items-center gap-2">
                    {isGraded && (
                      <Badge variant="emerald" size="md">
                        <Check className="w-3.5 h-3.5 mr-1" />
                        GRADED: {asg.studentScore} / {asg.maxScore}
                      </Badge>
                    )}
                    {isSubmitted && (
                      <Badge variant="blue" size="md">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        SUBMITTED
                      </Badge>
                    )}
                    {isMissing && (
                      <Badge variant="rose" size="md">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                        MISSING: 0 / {asg.maxScore}
                      </Badge>
                    )}
                    {isPending && (
                      <Badge
                        variant={deadlineInfo.type === 'urgent' ? 'amber' : 'purple'}
                        size="md"
                      >
                        {deadlineInfo.type === 'urgent' && <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                        TO SUBMIT
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Prominent Deadline & Urgency Section */}
                <div
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
                    deadlineInfo.type === 'urgent' && isPending
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : deadlineInfo.type === 'overdue' && isPending
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                      : 'bg-slate-50 border-slate-200/80 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-900">Submission Deadline: </span>
                      <span className="font-bold text-slate-800">{asg.dueDate}</span>
                    </div>
                  </div>

                  {/* Countdown Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 ${
                        deadlineInfo.type === 'urgent' && isPending
                          ? 'bg-amber-200 text-amber-900 animate-pulse'
                          : deadlineInfo.type === 'overdue' && isPending
                          ? 'bg-rose-200 text-rose-900'
                          : !isPending
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {deadlineInfo.label}
                    </span>
                  </div>
                </div>

                {/* Description & Requirements */}
                <div className="text-xs text-slate-600 leading-relaxed">
                  <p className={isExpanded ? '' : 'line-clamp-2'}>{asg.description}</p>
                  {asg.description.length > 120 && (
                    <button
                      type="button"
                      onClick={() => toggleInstructions(asg.id)}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] mt-1 inline-block"
                    >
                      {isExpanded ? 'Show less' : 'Show full instructions...'}
                    </button>
                  )}
                </div>

                {/* Artifact / Submission Metadata Card if Submitted or Graded */}
                {(isSubmitted || isGraded) && (
                  <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 font-mono text-indigo-900 font-semibold">
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>{asg.submittedFile || 'Chưa có tệp nộp'}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Turned in: <strong className="text-slate-700">{asg.submittedAt || '—'}</strong>
                      </span>
                    </div>

                    {asg.submissionNotes && (
                      <p className="text-[11px] text-slate-600 italic">
                        Notes: "{asg.submissionNotes}"
                      </p>
                    )}
                  </div>
                )}

                {/* Action Bar Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  {/* Left info */}
                  <div className="text-xs text-slate-500">
                    {isGraded ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Graded by Instructor • Feedback Available
                      </span>
                    ) : isSubmitted ? (
                      <span className="text-blue-700 font-semibold flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-600" />
                        Delivered • In instructor review queue
                      </span>
                    ) : (
                      <span className="text-slate-600 font-medium">
                        Submission window is currently open.
                      </span>
                    )}
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-2.5">
                    {isPending && (
                      <button
                        id={`btn-submit-${asg.id}`}
                        onClick={() => {
                          setActiveSubmitItem(asg);
                          setSelectedFile('');
                          setSelectedFileSize('');
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Submit Assignment
                      </button>
                    )}

                    {isSubmitted && (
                      <button
                        id={`btn-resubmit-${asg.id}`}
                        onClick={() => {
                          setActiveSubmitItem(asg);
                          setSelectedFile(asg.submittedFile || '');
                          setSelectedFileSize('');
                        }}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Update / Resubmit
                      </button>
                    )}

                    {isGraded && (
                      <button
                        id={`btn-view-feedback-${asg.id}`}
                        onClick={() => setActiveFeedbackItem(asg)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        View Feedback ({asg.studentScore}/{asg.maxScore})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Submission Modal */}
      {activeSubmitItem && (
        <Modal
          isOpen={!!activeSubmitItem}
          onClose={() => setActiveSubmitItem(null)}
          title={`Submit Assignment: ${activeSubmitItem.title}`}
          subtitle={`${activeSubmitItem.courseCode} • Due: ${activeSubmitItem.dueDate}`}
          maxWidth="lg"
        >
          {submitSuccess ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Nộp bài thành công!</h4>
              <p className="text-xs text-slate-500">
                Your artifact has been logged to the course repository and queued for lecturer evaluation.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Deadline reminder banner inside modal */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between text-indigo-950">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    Deadline: <strong>{activeSubmitItem.dueDate}</strong>
                  </span>
                </div>
                <span className="font-bold text-[11px] bg-indigo-200/70 px-2 py-0.5 rounded-md">
                  Weight: {activeSubmitItem.weightPercent}%
                </span>
              </div>

              {/* Upload Dropzone */}
              <div className="p-5 border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-2xl bg-indigo-50/20 text-center transition-colors">
                <Upload className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  Select your project archive or drag & drop files here
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supported extensions: .ZIP, .TAR.GZ, .PDF, .IPYNB, .GO, .JAVA (Max 50MB)
                </p>

                <input
                  type="file"
                  id="student-file-upload-input"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0].name);
                      setSelectedFileSize(`${(e.target.files[0].size / (1024 * 1024)).toFixed(1)} MB`);
                    }
                  }}
                />

                <div className="flex items-center justify-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => document.getElementById('student-file-upload-input')?.click()}
                    className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    Browse Local File
                  </button>
                </div>

                {/* Selected File Chip */}
                {selectedFile && (
                  <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-mono font-bold">{selectedFile}</span>
                      <span className="text-emerald-700 text-[11px]">({selectedFileSize})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile('')}
                      className="text-slate-400 hover:text-rose-600 text-[11px] font-bold"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Submission Notes / GitHub Repo URL */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Submission Notes or Repository URL (Optional)
                </label>
                <textarea
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="e.g. GitHub repo link (https://github.com/vnu-alex/raft-lab3), branch name, and special compilation flags..."
                  rows={3}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono text-[11px]"
                />
              </div>

              {/* Academic Integrity Confirmation */}
              <label className="flex items-start gap-2 cursor-pointer p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  checked={academicIntegrityChecked}
                  onChange={(e) => setAcademicIntegrityChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-600 leading-snug">
                  I certify that this submission represents my own individual work in accordance with the
                  University Academic Integrity and Honor Code.
                </span>
              </label>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveSubmitItem(null)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedFile || !academicIntegrityChecked}
                  id="btn-confirm-submit-assignment"
                  className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-xs flex items-center gap-2"
                >
                  {submitting ? 'Uploading Artifact...' : 'Confirm Submission'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* View Graded Feedback Modal */}
      {activeFeedbackItem && (
        <Modal
          isOpen={!!activeFeedbackItem}
          onClose={() => setActiveFeedbackItem(null)}
          title={`Instructor Feedback & Evaluation: ${activeFeedbackItem.title}`}
          subtitle={`${activeFeedbackItem.courseCode} • Graded Artifact Review`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {/* Score Banner */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider block">
                  Final Evaluated Score
                </span>
                <p className="text-3xl font-black text-emerald-950 mt-0.5">
                  {activeFeedbackItem.studentScore}{' '}
                  <span className="text-base font-medium text-emerald-700">
                    / {activeFeedbackItem.maxScore}
                  </span>
                </p>
                <span className="text-[11px] text-emerald-700">
                  {activeFeedbackItem.studentScore !== undefined &&
                    `${Math.round(
                      (activeFeedbackItem.studentScore / activeFeedbackItem.maxScore) * 100
                    )}% • Grade: ${getLetterGrade(
                      (activeFeedbackItem.studentScore / activeFeedbackItem.maxScore) * 10
                    )}`}
                </span>
              </div>

              <div className="text-right">
                <Badge variant="emerald" size="md">
                  Verified by Lecturer
                </Badge>
                <span className="text-[11px] text-slate-400 block mt-1">Official Gradebook Record</span>
              </div>
            </div>

            {/* Instructor Remarks Block */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                Instructor Remarks & Guidance
              </h4>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <p className="text-xs text-slate-800 leading-relaxed italic">
                  "{activeFeedbackItem.feedback || '—'}"
                </p>
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                  <span>Feedback</span>
                  <span>{activeFeedbackItem.submittedAt || '—'}</span>
                </div>
              </div>
            </div>

            {/* Submitted File on Record */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="font-semibold text-slate-700 block text-[11px]">Submitted Artifact on Record:</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-indigo-700 font-bold">
                  {activeFeedbackItem.submittedFile || '—'}
                </span>
                <span className="text-[11px] text-slate-400">
                  Turned in: {activeFeedbackItem.submittedAt || '—'}
                </span>
              </div>
              {activeFeedbackItem.submissionNotes && (
                <p className="text-[11px] text-slate-500 italic mt-1">
                  Your notes: "{activeFeedbackItem.submissionNotes}"
                </p>
              )}
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                id="btn-close-feedback-modal"
                onClick={() => setActiveFeedbackItem(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-2xs"
              >
                Close Evaluation
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
