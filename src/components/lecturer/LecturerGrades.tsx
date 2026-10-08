import React, { useState, useMemo } from 'react';
import {
  Award,
  Search,
  Download,
  Edit2,
  Check,
  X,
  Sliders,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ChevronDown
} from 'lucide-react';
import { StudentRosterItem, GradeWeightConfig, Course, Assignment, AttendanceSession } from '../../types';
import { Badge } from '../common/Badge';
import { ClassStudentResult, GradeRecord } from '../../api/grades';
import {
  DEFAULT_GRADE_WEIGHTS,
  GRADE_WEIGHT_PRESETS,
  calculateOverallScore,
  getLetterGrade,
  getGradePoints,
  getGradeStatus
} from '../../utils/gradeCalculations';

interface LecturerGradesProps {
  roster: StudentRosterItem[];
  courses?: Course[];
  activeCourseCode?: string;
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
  onUpdateScore?: (studentId: string, newScore: number) => void;
  assignments?: Assignment[];
  attendanceSessions?: AttendanceSession[];
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
}

export const LecturerGrades: React.FC<LecturerGradesProps> = ({
  roster,
  courses = [],
  activeCourseCode = '',
  weights: initialWeights,
  onUpdateWeights,
  onUpdateStudentScores,
  onUpdateScore,
  assignments = [],
  attendanceSessions = [],
  gradeRecords = [],
  classResults = [],
  gradesLoading = false,
  gradesError = null,
  activeGradeClassId = null,
  onGradeClassChange,
  onCreateGrade,
  onSaveGrades,
  onUpdateGrade,
  onDeleteGrade,
}) => {
  // Configurable weights state
  const [activeCourse, setActiveCourse] = useState<string>(activeCourseCode);
  const [currentWeights, setCurrentWeights] = useState<GradeWeightConfig>(
    initialWeights ? { ...initialWeights, attendance: 0 } : DEFAULT_GRADE_WEIGHTS
  );

  // Weights modal state
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [tempWeights, setTempWeights] = useState<GradeWeightConfig>(currentWeights);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'honors' | 'good_standing' | 'warning' | 'pending_final'>('all');

  // Inline editing state
  const [inlineEditStudentId, setInlineEditStudentId] = useState<string | null>(null);
  const [inlineScores, setInlineScores] = useState<{
    attendance: number;
    assignment: number;
    quiz: number;
    midterm: number;
    finalExam: number | null;
  }>({
    attendance: 0,
    assignment: 0,
    quiz: 0,
    midterm: 0,
    finalExam: null,
  });

  // Comprehensive Evaluation Modal state
  const [evaluatingStudent, setEvaluatingStudent] = useState<any | null>(null);
  const [modalScores, setModalScores] = useState<{
    attendance: number;
    assignment: number;
    quiz: number;
    midterm: number;
    finalExam: number | null;
    hasFinal: boolean;
  }>({
    attendance: 0,
    assignment: 0,
    quiz: 0,
    midterm: 0,
    finalExam: null,
    hasFinal: true,
  });
  const [modalFeedback, setModalFeedback] = useState<string>('');

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [gradeStudentId, setGradeStudentId] = useState<number>(classResults[0]?.student_id || 0);
  const [gradeStudentCode, setGradeStudentCode] = useState(classResults[0]?.student_code || '');
  const [bulkScores, setBulkScores] = useState({ assignment: '0', midterm: '0', finalExam: '0' });
  const [studentDrafts, setStudentDrafts] = useState<Record<number, { assignment: string; midterm: string; finalExam: string }>>({});
  const [editingStudents, setEditingStudents] = useState<Record<number, boolean>>({});
  const [editingGrades, setEditingGrades] = useState<Record<number, { score: number; weight: number }>>({});
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Synchronize weights if prop updates
  React.useEffect(() => {
    if (initialWeights) {
      const enforcedWeights = { ...initialWeights, attendance: 0 };
      setCurrentWeights(enforcedWeights);
      setTempWeights(enforcedWeights);
    }
  }, [initialWeights]);

  React.useEffect(() => {
    if (activeGradeClassId) {
      setGradeStudentId(classResults[0]?.student_id || 0);
      setGradeStudentCode(classResults[0]?.student_code || '');
    }
  }, [activeGradeClassId, classResults]);

  React.useEffect(() => {
    const drafts: Record<number, { assignment: string; midterm: string; finalExam: string }> = {};
    classResults.forEach((student) => {
      const records = gradeRecords.filter((grade) => grade.student_id === student.student_id);
      const valueFor = (name: string) => String(records.find((grade) => grade.component.toLowerCase() === name.toLowerCase())?.score ?? 0);
      drafts[student.student_id] = {
        assignment: valueFor('Assignment'),
        midterm: valueFor('Midterm'),
        finalExam: valueFor('Final Exam'),
      };
    });
    setStudentDrafts(drafts);
  }, [classResults, gradeRecords]);

  const selectedGradeStudent = classResults.find((student) => student.student_id === gradeStudentId);
  const selectedGradeCourse = courses.find((course) => Number(course.id) === activeGradeClassId);

  const getAttendanceStats = (student: any) => {
    const studentCode = student?.student_code || student?.studentCode || '';
    const studentId = student?.student_id || student?.studentId || '';
    const codes = new Set(
      [studentCode, String(studentId)]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
    );
    const selectedClassSessions = attendanceSessions.filter(
      (session) => String(session.courseId) === String(activeGradeClassId)
    );
    const uniqueSessions = Array.from(
      selectedClassSessions.reduce((sessions, session) => {
        const key = `${session.date}|${session.startTime}|${session.endTime}`;
        const existing = sessions.get(key);
        if (!existing || session.records.some((record) => codes.has(String(record.studentId).trim().toLowerCase()))) {
          sessions.set(key, session);
        }
        return sessions;
      }, new Map<string, AttendanceSession>())
      .values()
    );
    let present = 0;
    let late = 0;
    const total = uniqueSessions.length;
    uniqueSessions.forEach((session) => {
      const record = session.records.find((item) =>
        codes.has(String(item.studentId).trim().toLowerCase())
      );
      if (record) {
        if (record.status === 'present') present += 1;
        if (record.status === 'late') late += 1;
      }
    });
    const absenceCount = Math.max(total - present - late, 0);
    const attendanceRate = total ? ((present + late / 2) / total) * 100 : 0;
    return {
      total,
      present,
      late,
      absenceCount,
      absenceRate: total ? absenceCount / total : 0,
      attendanceRate,
    };
  };

  const handleGradeStudentCodeChange = (value: string) => {
    setGradeStudentCode(value);
    const normalizedCode = value.trim().toLowerCase();
    const student = classResults.find(
      (item) => item.student_code.trim().toLowerCase() === normalizedCode
    );
    if (student) {
      setGradeStudentId(student.student_id);
    }
  };

  // Compute total weight for validation
  const tempTotalWeight =
    Number(tempWeights.attendance || 0) +
    Number(tempWeights.assignment || 0) +
    Number(tempWeights.quiz || 0) +
    Number(tempWeights.midterm || 0) +
    Number(tempWeights.finalExam || 0);

  const isTempWeightValid = tempTotalWeight === 100;

  // Compute calculated values for each student in the roster
  const computedStudents = useMemo(() => {
    return roster.map((student) => {
      const rawAttendance = Number(student.attendanceScore ?? student.attendanceRate ?? 0);
      const rawAssignment = Number(student.assignmentScore ?? 0);
      const rawQuiz = Number(student.quizScore ?? 0);
      const rawMidterm = Number(student.midtermScore ?? 0);
      const rawFinal = student.finalScore !== undefined && student.finalScore !== null ? Number(student.finalScore) : null;

      const attendanceStats = getAttendanceStats(student);
      const att = attendanceStats.total > 0
        ? attendanceStats.attendanceRate
        : Number.isFinite(rawAttendance) ? Math.max(0, Math.min(100, rawAttendance)) : 0;
      const asg = Number.isFinite(rawAssignment) ? Math.max(0, Math.min(100, rawAssignment)) : 0;
      const qz = Number.isFinite(rawQuiz) ? Math.max(0, Math.min(100, rawQuiz)) : 0;
      const mid = Number.isFinite(rawMidterm) ? Math.max(0, Math.min(100, rawMidterm)) : 0;
      const fin = rawFinal !== null && Number.isFinite(rawFinal) ? Math.max(0, Math.min(100, rawFinal)) : null;

      const calculated = calculateOverallScore(
        {
          attendance: att,
          assignment: asg,
          quiz: qz,
          midterm: mid,
          finalExam: fin,
        },
        currentWeights
      );

      const letterGrade = getLetterGrade(calculated.overallScore / 10);
      const gradePoints = getGradePoints(letterGrade);
      const statusInfo = getGradeStatus(calculated.overallScore, fin !== null);

      return {
        ...student,
        calculatedAttendance: att,
        calculatedAssignment: asg,
        calculatedQuiz: qz,
        calculatedMidterm: mid,
        calculatedFinal: fin,
        calculatedOverall: calculated.overallScore,
        calculatedIsProjected: calculated.isProjected,
        calculatedLetter: letterGrade,
        calculatedPoints: gradePoints,
        calculatedStatus: statusInfo.status,
        calculatedStatusLabel: statusInfo.label,
        calculatedStatusDesc: statusInfo.description,
      };
    });
  }, [roster, currentWeights, attendanceSessions, activeGradeClassId]);

  // Filtered roster
  const filteredRoster = useMemo(() => {
    return computedStudents.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'honors') return s.calculatedOverall >= 90;
      if (statusFilter === 'good_standing') return s.calculatedOverall >= 70 && s.calculatedOverall < 90;
      if (statusFilter === 'warning') return s.calculatedOverall < 70;
      if (statusFilter === 'pending_final') return s.calculatedFinal === null;

      return true;
    });
  }, [computedStudents, searchTerm, statusFilter]);

  // Class Statistics
  const classAvg = useMemo(() => {
    if (computedStudents.length === 0) return 0;
    const sum = computedStudents.reduce((acc, s) => acc + s.calculatedOverall, 0);
    return Math.round((sum / computedStudents.length) * 10) / 10;
  }, [computedStudents]);

  const avgAttendance = useMemo(() => {
    if (computedStudents.length === 0) return 0;
    const sum = computedStudents.reduce((acc, s) => acc + s.calculatedAttendance, 0);
    return Math.round((sum / computedStudents.length) * 10) / 10;
  }, [computedStudents]);

  const avgAssignment = useMemo(() => {
    if (computedStudents.length === 0) return 0;
    const sum = computedStudents.reduce((acc, s) => acc + s.calculatedAssignment, 0);
    return Math.round((sum / computedStudents.length) * 10) / 10;
  }, [computedStudents]);

  const avgQuiz = useMemo(() => {
    if (computedStudents.length === 0) return 0;
    const sum = computedStudents.reduce((acc, s) => acc + s.calculatedQuiz, 0);
    return Math.round((sum / computedStudents.length) * 10) / 10;
  }, [computedStudents]);

  const avgMidterm = useMemo(() => {
    if (computedStudents.length === 0) return 0;
    const sum = computedStudents.reduce((acc, s) => acc + s.calculatedMidterm, 0);
    return Math.round((sum / computedStudents.length) * 10) / 10;
  }, [computedStudents]);

  const avgFinal = useMemo(() => {
    const withFinal = computedStudents.filter((s) => s.calculatedFinal !== null);
    if (withFinal.length === 0) return 0;
    const sum = withFinal.reduce((acc, s) => acc + (s.calculatedFinal || 0), 0);
    return Math.round((sum / withFinal.length) * 10) / 10;
  }, [computedStudents]);

  // Handle saving configured weights
  const handleSaveWeights = () => {
    if (!isTempWeightValid) {
      alert(`Weights must total exactly 100%. Currently: ${tempTotalWeight}%`);
      return;
    }
    const enforcedWeights = { ...tempWeights, attendance: 0 };
    setCurrentWeights(enforcedWeights);
    if (onUpdateWeights) {
      onUpdateWeights(activeCourse, enforcedWeights);
    }
    setIsWeightModalOpen(false);
    showToast(
      `Grade weights updated! All student overall grades recalculated automatically.`
    );
  };

  // Start Inline Edit
  const startInlineEdit = (student: typeof computedStudents[0]) => {
    setInlineEditStudentId(student.id);
    setInlineScores({
      attendance: student.calculatedAttendance,
      assignment: student.calculatedAssignment,
      quiz: student.calculatedQuiz,
      midterm: student.calculatedMidterm,
      finalExam: student.calculatedFinal,
    });
  };

  // Save Inline Edit
  const saveInlineEdit = (studentId: string) => {
    const scores = {
      attendanceScore: Math.max(0, Math.min(100, Number(inlineScores.attendance) || 0)),
      assignmentScore: Math.max(0, Math.min(100, Number(inlineScores.assignment) || 0)),
      quizScore: Math.max(0, Math.min(100, Number(inlineScores.quiz) || 0)),
      midtermScore: Math.max(0, Math.min(100, Number(inlineScores.midterm) || 0)),
      finalScore:
        inlineScores.finalExam !== null
          ? Math.max(0, Math.min(100, Number(inlineScores.finalExam) || 0))
          : null,
    };

    const recalculated = calculateOverallScore(
      {
        attendance: scores.attendanceScore,
        assignment: scores.assignmentScore,
        quiz: scores.quizScore,
        midterm: scores.midtermScore,
        finalExam: scores.finalScore,
      },
      currentWeights
    );

    if (onUpdateStudentScores) {
      onUpdateStudentScores(studentId, scores);
    } else if (onUpdateScore) {
      onUpdateScore(studentId, recalculated.overallScore);
    }

    setInlineEditStudentId(null);
    showToast(`Updated grades for student. Overall calculated: ${recalculated.overallScore}%`);
  };

  // Open Full Evaluation Modal
  const openEvaluationModal = (student: typeof computedStudents[0]) => {
    setEvaluatingStudent(student);
    const hasFinal = student.calculatedFinal !== null;
    setModalScores({
      attendance: student.calculatedAttendance,
      assignment: student.calculatedAssignment,
      quiz: student.calculatedQuiz,
      midterm: student.calculatedMidterm,
      finalExam: student.calculatedFinal,
      hasFinal: hasFinal,
    });
    setModalFeedback(student.gradeFeedback || '');
  };

  // Save Full Evaluation Modal
  const handleSaveEvaluationModal = () => {
    if (!evaluatingStudent) return;

    const scores = {
      attendanceScore: Math.max(0, Math.min(100, Number(modalScores.attendance) || 0)),
      assignmentScore: Math.max(0, Math.min(100, Number(modalScores.assignment) || 0)),
      quizScore: Math.max(0, Math.min(100, Number(modalScores.quiz) || 0)),
      midtermScore: Math.max(0, Math.min(100, Number(modalScores.midterm) || 0)),
      finalScore: modalScores.hasFinal
        ? Math.max(0, Math.min(100, Number(modalScores.finalExam ?? 0)))
        : null,
    };

    const recalculated = calculateOverallScore(
      {
        attendance: scores.attendanceScore,
        assignment: scores.assignmentScore,
        quiz: scores.quizScore,
        midterm: scores.midtermScore,
        finalExam: scores.finalScore,
      },
      currentWeights
    );

    if (onUpdateStudentScores) {
      onUpdateStudentScores(evaluatingStudent.id, scores, modalFeedback);
    } else if (onUpdateScore) {
      onUpdateScore(evaluatingStudent.id, recalculated.overallScore);
    }

    setEvaluatingStudent(null);
    showToast(`Saved assessment for ${evaluatingStudent.name}. Final: ${recalculated.overallScore}% (${getLetterGrade(recalculated.overallScore)})`);
  };

  // Auto-Pull from attendance records & assignments
  const handleAutoSyncStudentActivity = () => {
    if (!evaluatingStudent) return;

    // Check if attendance sessions exist
    let computedAtt = evaluatingStudent.calculatedAttendance;
    if (attendanceSessions.length > 0) {
      let attendedCount = 0;
      let totalCount = 0;
      attendanceSessions.forEach((sess) => {
        const rec = sess.records.find((r) => r.studentId === evaluatingStudent.studentId);
        if (rec) {
          totalCount++;
          if (rec.status === 'present') attendedCount += 1;
          else if (rec.status === 'late') attendedCount += 0.5;
        }
      });
      if (totalCount > 0) {
        computedAtt = Math.round((attendedCount / totalCount) * 100);
      }
    }

    // Check assignment submissions
    let computedAsg = evaluatingStudent.calculatedAssignment;
    const studentSubs = assignments.flatMap((a) =>
      (a.submissions || []).filter((s) => s.studentId === evaluatingStudent.studentId && s.score !== undefined)
    );
    if (studentSubs.length > 0) {
      const sum = studentSubs.reduce((acc, s) => acc + (s.score || 0), 0);
      computedAsg = Math.round(sum / studentSubs.length);
    }

    setModalScores((prev) => ({
      ...prev,
      attendance: computedAtt,
      assignment: computedAsg,
    }));

    showToast(`Synced LMS records: Attendance ${computedAtt}%, Assignments ${computedAsg}%`);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Mã sinh viên',
      'Student Name',
      'Email',
      `Attendance (${currentWeights.attendance}%)`,
      `Assignments (${currentWeights.assignment}%)`,
      `Quizzes (${currentWeights.quiz}%)`,
      `Midterm (${currentWeights.midterm}%)`,
      `Final (${currentWeights.finalExam}%)`,
      'Overall Grade (%)',
      'Letter Grade',
      'GPA Points (4.0)',
      'Grade Status',
      'Instructor Feedback',
    ];

    const rows = computedStudents.map((s) => [
      `"${s.studentId}"`,
      `"${s.name}"`,
      `"${s.email}"`,
      s.calculatedAttendance,
      s.calculatedAssignment,
      s.calculatedQuiz,
      s.calculatedMidterm,
      s.calculatedFinal !== null ? s.calculatedFinal : 'Pending',
      s.calculatedOverall,
      `"${s.calculatedLetter}"`,
      s.calculatedPoints.toFixed(1),
      `"${s.calculatedStatusLabel}"`,
      `"${(s.gradeFeedback || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Gradebook_${activeCourse}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Gradebook exported to CSV successfully.');
  };

  // Preview live overall in modal
  const liveModalOverall = useMemo(() => {
    return calculateOverallScore(
      {
        attendance: modalScores.attendance,
        assignment: modalScores.assignment,
        quiz: modalScores.quiz,
        midterm: modalScores.midterm,
        finalExam: modalScores.hasFinal ? modalScores.finalExam : null,
      },
      currentWeights
    );
  }, [modalScores, currentWeights]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold">Nhập điểm theo lớp và sinh viên</h3>
            <p className="mt-1 text-xs text-slate-500">Assignment 10% · Midterm 30% · Final Exam 60%. Không cộng điểm danh; vắng quá 20% sẽ bị 0 toàn bộ điểm thành phần.</p>
          </div>
          {gradesLoading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        {gradesError && <p className="mt-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{gradesError}</p>}
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">Trang điểm theo lớp</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const classId = Number(course.id);
              const isActive = classId === activeGradeClassId;
              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onGradeClassChange?.(classId)}
                  className={`min-h-24 rounded-2xl border px-4 py-3 text-left text-xs transition-colors ${
                    isActive
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  <span className="mb-2 block text-lg font-bold">{course.code || course.class_code}</span>
                  <span className={`block text-[10px] ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {course.title || course.class_name}
                  </span>
                  <span className={`mt-2 block text-[10px] ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Bấm để xem danh sách sinh viên
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {false && <form className="mt-3 grid gap-2 sm:grid-cols-[1.1fr_1.1fr_1fr_1fr_1fr_auto]" onSubmit={async (event) => {
          event.preventDefault();
          if (!selectedGradeStudent || !onSaveGrades) return;
          await onSaveGrades(selectedGradeStudent.student_id, [
            { component: 'Assignment', score: Number(bulkScores.assignment || 0), weight: 10 },
            { component: 'Midterm', score: Number(bulkScores.midterm || 0), weight: 30 },
            { component: 'Final Exam', score: Number(bulkScores.finalExam || 0), weight: 60 },
          ]);
        }}>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Mã sinh viên</label>
            <input
              required
              list="grade-student-codes"
              value={gradeStudentCode}
              onChange={(e) => handleGradeStudentCodeChange(e.target.value)}
              placeholder="Nhập mã sinh viên"
              className="w-full rounded-xl border px-3 py-2 text-xs"
            />
            <datalist id="grade-student-codes">
              {classResults.map((student) => <option key={student.student_id} value={student.student_code}>{student.student_name}</option>)}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Sinh viên</label>
            <select value={gradeStudentId} onChange={(e) => {
              const student = classResults.find((item) => item.student_id === Number(e.target.value));
              setGradeStudentId(Number(e.target.value));
              setGradeStudentCode(student?.student_code || '');
            }} className="w-full rounded-xl border px-3 py-2 text-xs">
              {classResults.map((student) => <option key={student.student_id} value={student.student_id}>{student.student_code} - {student.student_name}</option>)}
            </select>
          </div>
          <label className="text-xs font-semibold text-slate-600">Assignment (10%)
            <input aria-label="Assignment" type="number" min={0} max={10} step={0.1} value={bulkScores.assignment} onFocus={(e) => { if (e.currentTarget.value === '0') setBulkScores((prev) => ({ ...prev, assignment: '' })); }} onChange={(e) => setBulkScores((prev) => ({ ...prev, assignment: e.target.value }))} className="no-number-spinner mt-1 w-full rounded-xl border px-3 py-2 text-xs" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Midterm (30%)
            <input aria-label="Midterm" type="number" min={0} max={10} step={0.1} value={bulkScores.midterm} onFocus={(e) => { if (e.currentTarget.value === '0') setBulkScores((prev) => ({ ...prev, midterm: '' })); }} onChange={(e) => setBulkScores((prev) => ({ ...prev, midterm: e.target.value }))} className="no-number-spinner mt-1 w-full rounded-xl border px-3 py-2 text-xs" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Final Exam (60%)
            <input aria-label="Final Exam" type="number" min={0} max={10} step={0.1} value={bulkScores.finalExam} onFocus={(e) => { if (e.currentTarget.value === '0') setBulkScores((prev) => ({ ...prev, finalExam: '' })); }} onChange={(e) => setBulkScores((prev) => ({ ...prev, finalExam: e.target.value }))} className="no-number-spinner mt-1 w-full rounded-xl border px-3 py-2 text-xs" />
          </label>
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs">
            <span className="block font-semibold text-slate-600">Điểm danh (không tính điểm)</span>
            {selectedGradeStudent && (() => {
              const attendance = getAttendanceStats(selectedGradeStudent!);
              const exceeded = attendance.total > 0 && attendance.absenceRate > 0.2;
              return <><strong className={exceeded ? 'text-rose-600' : 'text-emerald-600'}>{Math.round(attendance.attendanceRate)}% đi học</strong><span className="block text-[10px] text-slate-500">{attendance.total} buổi · Vắng {Math.round(attendance.absenceRate * 100)}%{exceeded ? ' · Các điểm sẽ = 0' : ''}</span></>;
            })()}
          </div>
          <button disabled={!selectedGradeStudent || !onSaveGrades} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Lưu tất cả</button>
        </form>}
        {false && (classResults.length === 0 && !gradesLoading ? <p className="mt-4 text-xs text-slate-500">Lớp này chưa có sinh viên được duyệt.</p> : <div className="mt-4 space-y-2">{gradeRecords.map((grade) => {
          const draft = editingGrades[grade.id] || { score: grade.score, weight: grade.weight };
          return <div key={grade.id} className="grid gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs sm:grid-cols-[1fr_90px_90px_auto] sm:items-center">
            <span><strong>{grade.student_code || `ID ${grade.student_id}`}</strong> · {grade.student_name || 'Chưa có tên'} · {grade.component}</span>
            <input type="number" min={0} max={10} step={0.1} value={draft.score} onChange={(e) => setEditingGrades((prev) => ({ ...prev, [grade.id]: { ...draft, score: Number(e.target.value) } }))} className="rounded-lg border px-2 py-1" />
            <input type="number" min={0.1} max={100} step={0.1} value={draft.weight} onChange={(e) => setEditingGrades((prev) => ({ ...prev, [grade.id]: { ...draft, weight: Number(e.target.value) } }))} className="rounded-lg border px-2 py-1" />
            <span className="flex gap-2"><button onClick={async () => { await onUpdateGrade?.(grade.id, draft); setEditingGrades((prev) => { const next = { ...prev }; delete next[grade.id]; return next; }); }} className="font-bold text-indigo-600">Lưu</button><button onClick={() => void onDeleteGrade?.(grade.id)} className="font-bold text-rose-600">Xóa</button></span>
          </div>;
        })}</div>)}
        {classResults.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <div className="border-b bg-slate-50 px-4 py-3">
              <h4 className="font-bold text-slate-800">Danh sách sinh viên đã đăng ký</h4>
              <p className="mt-1 text-xs text-slate-500">Nhập hoặc sửa điểm trực tiếp trên từng dòng rồi bấm Lưu.</p>
            </div>
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="border-b bg-white text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mã sinh viên</th>
                  <th className="px-4 py-3">Sinh viên</th>
                  <th className="px-3 py-3">Assignment (10%)</th>
                  <th className="px-3 py-3">Midterm (30%)</th>
                  <th className="px-3 py-3">Final Exam (60%)</th>
                  <th className="px-3 py-3">Điểm danh</th>
                  <th className="px-3 py-3">Điểm môn</th>
                  <th className="px-3 py-3">Điểm chữ</th>
                  <th className="px-3 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classResults.map((student) => {
                  const draft = studentDrafts[student.student_id] || { assignment: '0', midterm: '0', finalExam: '0' };
                  const attendance = getAttendanceStats(student);
                  const attendanceExceeded = attendance.total > 0 && attendance.absenceRate > 0.2;
                  const assignmentScore = Number(draft.assignment || 0);
                  const midtermScore = Number(draft.midterm || 0);
                  const finalScore = Number(draft.finalExam || 0);
                  const overallScore = Math.round(((assignmentScore * 10 + midtermScore * 30 + finalScore * 60) / 100) * 100) / 100;
                  const letterGrade = getLetterGrade(overallScore);
                  const isEditing = editingStudents[student.student_id] === true;
                  const updateDraft = (key: 'assignment' | 'midterm' | 'finalExam', value: string) => {
                    setStudentDrafts((prev) => ({ ...prev, [student.student_id]: { ...draft, [key]: value } }));
                  };
                  return (
                    <tr key={student.student_id} className="bg-white">
                      <td className="px-4 py-3 font-semibold text-slate-800">{student.student_code}</td>
                      <td className="px-4 py-3">
                        <span className="text-slate-500">{student.student_name}</span>
                      </td>
                      {(['assignment', 'midterm', 'finalExam'] as const).map((key) => (
                        <td key={key} className="px-3 py-3">
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step={0.1}
                            value={draft[key]}
                            disabled={!isEditing}
                            onFocus={(event) => { if (event.currentTarget.value === '0') updateDraft(key, ''); }}
                            onChange={(event) => updateDraft(key, event.target.value)}
                            className="no-number-spinner w-24 rounded-lg border px-2 py-1.5 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                      ))}
                      <td className={`px-3 py-3 font-semibold ${attendanceExceeded ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {Math.round(attendance.attendanceRate)}% đi học
                        <span className="block text-[10px]">Vắng {Math.round(attendance.absenceRate * 100)}%</span>
                        {attendanceExceeded && <span className="block text-[10px]">Kiểm tra điều kiện dự thi</span>}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-800">{overallScore.toFixed(2)}/10</td>
                      <td className="px-3 py-3 font-bold text-indigo-600">{letterGrade}</td>
                      <td className="px-3 py-3">
                        {!isEditing ? (
                          <button
                            type="button"
                            title="Sửa điểm"
                            aria-label={`Sửa điểm của ${student.student_code}`}
                            disabled={!onSaveGrades}
                            onClick={() => setEditingStudents((prev) => ({ ...prev, [student.student_id]: true }))}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Lưu điểm"
                            aria-label={`Lưu điểm của ${student.student_code}`}
                            disabled={!onSaveGrades}
                            onClick={async () => {
                              await onSaveGrades?.(student.student_id, [
                                { component: 'Assignment', score: Number(draft.assignment || 0), weight: 10 },
                                { component: 'Midterm', score: Number(draft.midterm || 0), weight: 30 },
                                { component: 'Final Exam', score: Number(draft.finalExam || 0), weight: 60 },
                              ]);
                              setEditingStudents((prev) => ({ ...prev, [student.student_id]: false }));
                            }}
                            className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 animate-fadeIn text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {false && <>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Grade Management & Assessment
            </h2>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-md border border-indigo-100">
              {activeCourse}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enter component scores (attendance, assignment, quiz, midterm, final) with configurable weighting calculation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Configurable Weights Button */}
          <button
            onClick={() => {
              setTempWeights(currentWeights);
              setIsWeightModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors shadow-2xs"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            Configure Weights ({currentWeights.attendance}/{currentWeights.assignment}/{currentWeights.quiz}/{currentWeights.midterm}/{currentWeights.finalExam}%)
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Gradebook (CSV)
          </button>
        </div>
      </div>

      {/* Configurable Weights Overview Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Configured Weight Distribution:</span>
            <span className="text-slate-500">Calculates overall grade automatically</span>
          </div>
          <button
            onClick={() => {
              setTempWeights(currentWeights);
              setIsWeightModalOpen(true);
            }}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-start sm:self-auto"
          >
            Adjust Weight Distribution
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Multi-segment Weight Visualizer */}
        <div className="space-y-1.5">
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${currentWeights.attendance}%` }}
              className="bg-sky-500 h-full transition-all duration-300"
              title={`Attendance: ${currentWeights.attendance}%`}
            />
            <div
              style={{ width: `${currentWeights.assignment}%` }}
              className="bg-indigo-500 h-full transition-all duration-300"
              title={`Assignment: ${currentWeights.assignment}%`}
            />
            <div
              style={{ width: `${currentWeights.quiz}%` }}
              className="bg-purple-500 h-full transition-all duration-300"
              title={`Quiz: ${currentWeights.quiz}%`}
            />
            <div
              style={{ width: `${currentWeights.midterm}%` }}
              className="bg-amber-500 h-full transition-all duration-300"
              title={`Midterm: ${currentWeights.midterm}%`}
            />
            <div
              style={{ width: `${currentWeights.finalExam}%` }}
              className="bg-rose-500 h-full transition-all duration-300"
              title={`Final Exam: ${currentWeights.finalExam}%`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
              <span className="text-slate-600">Attendance:</span>
              <strong className="text-slate-900 font-mono">{currentWeights.attendance}%</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-slate-600">Assignment:</span>
              <strong className="text-slate-900 font-mono">{currentWeights.assignment}%</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
              <span className="text-slate-600">Quiz:</span>
              <strong className="text-slate-900 font-mono">{currentWeights.quiz}%</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-slate-600">Midterm:</span>
              <strong className="text-slate-900 font-mono">{currentWeights.midterm}%</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-slate-600">Final Exam:</span>
              <strong className="text-slate-900 font-mono">{currentWeights.finalExam}%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Class Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Class Average
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {classAvg.toFixed(1)}%
            </span>
            <span className="text-xs font-bold text-indigo-600">
              {getLetterGrade(classAvg)}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Weighted overall</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-sky-600 uppercase tracking-wider block">
            Avg Attendance
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {avgAttendance.toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Weight: {currentWeights.attendance}%</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider block">
            Avg Assignment
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {avgAssignment.toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Weight: {currentWeights.assignment}%</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider block">
            Avg Quiz
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {avgQuiz.toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Weight: {currentWeights.quiz}%</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">
            Avg Midterm
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {avgMidterm.toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Weight: {currentWeights.midterm}%</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">
            Avg Final Exam
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {avgFinal.toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Weight: {currentWeights.finalExam}%</span>
        </div>
      </div>

      {/* Gradebook Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs py-1.5 px-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Students ({computedStudents.length})</option>
              <option value="honors">Honors Standing (A/A+)</option>
              <option value="good_standing">Good Standing (B/C+)</option>
              <option value="warning">Academic Warning (&lt;70%)</option>
              <option value="pending_final">Pending Final Exam</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Showing {filteredRoster.length} students</span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-indigo-600 font-medium">Click any score to edit or evaluate</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-4 py-3.5">Student</th>
                <th className="px-3 py-3.5">Mã sinh viên</th>
                <th className="px-3 py-3.5 text-center">
                  Attendance
                  <span className="block text-[10px] font-normal text-sky-600">({currentWeights.attendance}%)</span>
                </th>
                <th className="px-3 py-3.5 text-center">
                  Assignment
                  <span className="block text-[10px] font-normal text-indigo-600">({currentWeights.assignment}%)</span>
                </th>
                <th className="px-3 py-3.5 text-center">
                  Quiz
                  <span className="block text-[10px] font-normal text-purple-600">({currentWeights.quiz}%)</span>
                </th>
                <th className="px-3 py-3.5 text-center">
                  Midterm
                  <span className="block text-[10px] font-normal text-amber-600">({currentWeights.midterm}%)</span>
                </th>
                <th className="px-3 py-3.5 text-center">
                  Final Exam
                  <span className="block text-[10px] font-normal text-rose-600">({currentWeights.finalExam}%)</span>
                </th>
                <th className="px-3 py-3.5 text-center font-bold text-slate-900 bg-slate-100/60">
                  Overall Score
                  <span className="block text-[10px] font-normal text-slate-500">(Weighted)</span>
                </th>
                <th className="px-3 py-3.5 text-center">Grade</th>
                <th className="px-4 py-3.5">Trạng thái</th>
                <th className="px-4 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoster.map((student) => {
                const isInlineEditing = inlineEditStudentId === student.id;

                // If inline editing, calculate live overall preview
                const previewOverall = isInlineEditing
                  ? calculateOverallScore(
                      {
                        attendance: inlineScores.attendance,
                        assignment: inlineScores.assignment,
                        quiz: inlineScores.quiz,
                        midterm: inlineScores.midterm,
                        finalExam: inlineScores.finalExam,
                      },
                      currentWeights
                    ).overallScore
                  : student.calculatedOverall;

                const previewLetter = isInlineEditing ? getLetterGrade(previewOverall / 10) : student.calculatedLetter;

                return (
                  <tr
                    key={student.id}
                    className={`transition-colors ${
                      isInlineEditing ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Student Info */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={student.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'Student')}&background=random`}
                          alt={student.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">{student.name}</span>
                          <span className="text-[11px] text-slate-400 block truncate">{student.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Student ID */}
                    <td className="px-3 py-3.5 font-mono text-slate-700 font-medium text-[11px]">
                      {student.studentId}
                    </td>

                    {/* 1. Attendance Score */}
                    <td className="px-3 py-3.5 text-center">
                      {isInlineEditing ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={inlineScores.attendance}
                          onChange={(e) =>
                            setInlineScores({ ...inlineScores, attendance: Number(e.target.value) })
                          }
                          className="w-16 px-1.5 py-1 text-center font-mono font-bold bg-white border border-indigo-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <button
                          onClick={() => startInlineEdit(student)}
                          className="font-mono font-semibold text-slate-800 hover:text-indigo-600 hover:underline px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors"
                        >
                          {student.calculatedAttendance}
                        </button>
                      )}
                    </td>

                    {/* 2. Assignment Score */}
                    <td className="px-3 py-3.5 text-center">
                      {isInlineEditing ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={inlineScores.assignment}
                          onChange={(e) =>
                            setInlineScores({ ...inlineScores, assignment: Number(e.target.value) })
                          }
                          className="w-16 px-1.5 py-1 text-center font-mono font-bold bg-white border border-indigo-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <button
                          onClick={() => startInlineEdit(student)}
                          className="font-mono font-semibold text-slate-800 hover:text-indigo-600 hover:underline px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors"
                        >
                          {student.calculatedAssignment}
                        </button>
                      )}
                    </td>

                    {/* 3. Quiz Score */}
                    <td className="px-3 py-3.5 text-center">
                      {isInlineEditing ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={inlineScores.quiz}
                          onChange={(e) =>
                            setInlineScores({ ...inlineScores, quiz: Number(e.target.value) })
                          }
                          className="w-16 px-1.5 py-1 text-center font-mono font-bold bg-white border border-indigo-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <button
                          onClick={() => startInlineEdit(student)}
                          className="font-mono font-semibold text-slate-800 hover:text-indigo-600 hover:underline px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors"
                        >
                          {student.calculatedQuiz}
                        </button>
                      )}
                    </td>

                    {/* 4. Midterm Score */}
                    <td className="px-3 py-3.5 text-center">
                      {isInlineEditing ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={inlineScores.midterm}
                          onChange={(e) =>
                            setInlineScores({ ...inlineScores, midterm: Number(e.target.value) })
                          }
                          className="w-16 px-1.5 py-1 text-center font-mono font-bold bg-white border border-indigo-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <button
                          onClick={() => startInlineEdit(student)}
                          className="font-mono font-semibold text-slate-800 hover:text-indigo-600 hover:underline px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors"
                        >
                          {student.calculatedMidterm}
                        </button>
                      )}
                    </td>

                    {/* 5. Final Exam Score */}
                    <td className="px-3 py-3.5 text-center">
                      {isInlineEditing ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Pending"
                          value={inlineScores.finalExam !== null ? inlineScores.finalExam : ''}
                          onChange={(e) =>
                            setInlineScores({
                              ...inlineScores,
                              finalExam: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          className="w-16 px-1.5 py-1 text-center font-mono font-bold bg-white border border-indigo-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <button
                          onClick={() => startInlineEdit(student)}
                          className="font-mono font-semibold text-slate-800 hover:text-indigo-600 hover:underline px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors"
                        >
                          {student.calculatedFinal !== null ? (
                            student.calculatedFinal
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Pending</span>
                          )}
                        </button>
                      )}
                    </td>

                    {/* Calculated Overall Score */}
                    <td className="px-3 py-3.5 text-center bg-slate-50/50">
                      <span className="text-sm font-black font-mono text-slate-900">
                        {previewOverall.toFixed(1)}%
                      </span>
                    </td>

                    {/* Letter Grade */}
                    <td className="px-3 py-3.5 text-center">
                      <span
                        className={`font-black font-mono text-xs px-2 py-0.5 rounded-md ${
                          previewLetter.startsWith('A')
                            ? 'bg-emerald-100 text-emerald-800'
                            : previewLetter.startsWith('B')
                            ? 'bg-indigo-100 text-indigo-800'
                            : previewLetter.startsWith('C')
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {previewLetter}
                      </span>
                    </td>

                    {/* Grade Status */}
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={
                          student.calculatedStatus === 'honors'
                            ? 'emerald'
                            : student.calculatedStatus === 'good_standing'
                            ? 'indigo'
                            : student.calculatedStatus === 'warning'
                            ? 'amber'
                            : student.calculatedStatus === 'pending_final'
                            ? 'blue'
                            : 'rose'
                        }
                        size="sm"
                      >
                        {student.calculatedStatusLabel}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {isInlineEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => saveInlineEdit(student.id)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                            title="Save Scores"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setInlineEditStudentId(null)}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => startInlineEdit(student)}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            Quick Edit
                          </button>
                          <button
                            onClick={() => openEvaluationModal(student)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200/60"
                          >
                            Evaluate
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
      </div>

      {/* MODAL 1: Configurable Weights Modal */}
      </>}
      {isWeightModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Configure Grade Evaluation Weights
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set the percentage contribution for each component. Total must equal 100%.
                </p>
              </div>
              <button
                onClick={() => setIsWeightModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Quick Presets
              </span>
              <div className="grid grid-cols-2 gap-2">
                {GRADE_WEIGHT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setTempWeights(p.weights)}
                    className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-xs"
                  >
                    <span className="font-semibold text-slate-900 block">{p.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                      {p.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Attendance weight is fixed at 0%. It is still tracked for eligibility, but is excluded from the course-grade calculation.
            </p>

            {/* Individual Component Weight Inputs */}
            <div className="space-y-3.5 pt-2">
              {/* 1. Attendance Weight */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span className="font-semibold text-slate-900">Attendance Score Weight</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">0%</span>
                </div>
              </div>

              {/* 2. Assignment Weight */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span className="font-semibold text-slate-900">Assignment Score Weight</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-bold text-slate-900">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tempWeights.assignment}
                      onChange={(e) =>
                        setTempWeights({ ...tempWeights, assignment: Number(e.target.value) })
                      }
                      className="w-14 px-2 py-0.5 text-right border border-slate-300 rounded-md bg-white text-xs"
                    />
                    <span>%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={tempWeights.assignment}
                  onChange={(e) =>
                    setTempWeights({ ...tempWeights, assignment: Number(e.target.value) })
                  }
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* 3. Quiz Weight */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="font-semibold text-slate-900">Quiz Score Weight</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-bold text-slate-900">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tempWeights.quiz}
                      onChange={(e) =>
                        setTempWeights({ ...tempWeights, quiz: Number(e.target.value) })
                      }
                      className="w-14 px-2 py-0.5 text-right border border-slate-300 rounded-md bg-white text-xs"
                    />
                    <span>%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={tempWeights.quiz}
                  onChange={(e) =>
                    setTempWeights({ ...tempWeights, quiz: Number(e.target.value) })
                  }
                  className="w-full accent-purple-500"
                />
              </div>

              {/* 4. Midterm Weight */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="font-semibold text-slate-900">Midterm Score Weight</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-bold text-slate-900">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tempWeights.midterm}
                      onChange={(e) =>
                        setTempWeights({ ...tempWeights, midterm: Number(e.target.value) })
                      }
                      className="w-14 px-2 py-0.5 text-right border border-slate-300 rounded-md bg-white text-xs"
                    />
                    <span>%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={tempWeights.midterm}
                  onChange={(e) =>
                    setTempWeights({ ...tempWeights, midterm: Number(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              {/* 5. Final Exam Weight */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="font-semibold text-slate-900">Final Exam Score Weight</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-bold text-slate-900">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tempWeights.finalExam}
                      onChange={(e) =>
                        setTempWeights({ ...tempWeights, finalExam: Number(e.target.value) })
                      }
                      className="w-14 px-2 py-0.5 text-right border border-slate-300 rounded-md bg-white text-xs"
                    />
                    <span>%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={tempWeights.finalExam}
                  onChange={(e) =>
                    setTempWeights({ ...tempWeights, finalExam: Number(e.target.value) })
                  }
                  className="w-full accent-rose-500"
                />
              </div>
            </div>

            {/* Total Validation Meter */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                isTempWeightValid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {isTempWeightValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>
                  {isTempWeightValid
                    ? 'Total weight is valid (100%). Ready to apply.'
                    : `Total weight is ${tempTotalWeight}%. Adjust components so they sum to 100%.`}
                </span>
              </div>
              <span className="font-mono font-black text-sm">{tempTotalWeight}%</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsWeightModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!isTempWeightValid}
                onClick={handleSaveWeights}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
              >
                Apply Weights & Recalculate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Full Student Evaluation Modal */}
      {evaluatingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            {/* Student Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src={evaluatingStudent.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(evaluatingStudent.name || 'Student')}&background=random`}
                  alt={evaluatingStudent.name}
                  className="w-12 h-12 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {evaluatingStudent.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    ID: <strong className="font-mono text-slate-700">{evaluatingStudent.studentId}</strong> • {evaluatingStudent.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEvaluatingStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Activity Sync Button */}
            <div className="flex items-center justify-between p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
              <div className="text-xs">
                <span className="font-bold text-indigo-900 block">Auto-Sync LMS Activity</span>
                <span className="text-indigo-600 text-[11px]">
                  Calculate attendance & assignment scores from enrolled class sessions.
                </span>
              </div>
              <button
                onClick={handleAutoSyncStudentActivity}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Sync Activity
              </button>
            </div>

            {/* 5 Component Inputs */}
            <div className="space-y-3">
              {/* 1. Attendance Score */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    1. Attendance Score (Weight: {currentWeights.attendance}%)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={modalScores.attendance}
                      onChange={(e) =>
                        setModalScores({ ...modalScores, attendance: Number(e.target.value) })
                      }
                      className="w-16 px-2 py-0.5 text-center font-mono font-bold bg-white border border-slate-300 rounded-md text-xs text-slate-900"
                    />
                    <span className="text-slate-400">/ 100</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={modalScores.attendance}
                  onChange={(e) =>
                    setModalScores({ ...modalScores, attendance: Number(e.target.value) })
                  }
                  className="w-full accent-sky-500"
                />
                <span className="text-[11px] text-slate-500 block">
                  Contributes {((modalScores.attendance * currentWeights.attendance) / 100).toFixed(1)} pts to final grade.
                </span>
              </div>

              {/* 2. Assignment Score */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    2. Assignment Score (Weight: {currentWeights.assignment}%)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={modalScores.assignment}
                      onChange={(e) =>
                        setModalScores({ ...modalScores, assignment: Number(e.target.value) })
                      }
                      className="w-16 px-2 py-0.5 text-center font-mono font-bold bg-white border border-slate-300 rounded-md text-xs text-slate-900"
                    />
                    <span className="text-slate-400">/ 100</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={modalScores.assignment}
                  onChange={(e) =>
                    setModalScores({ ...modalScores, assignment: Number(e.target.value) })
                  }
                  className="w-full accent-indigo-500"
                />
                <span className="text-[11px] text-slate-500 block">
                  Contributes {((modalScores.assignment * currentWeights.assignment) / 100).toFixed(1)} pts to final grade.
                </span>
              </div>

              {/* 3. Quiz Score */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    3. Quiz Score (Weight: {currentWeights.quiz}%)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={modalScores.quiz}
                      onChange={(e) =>
                        setModalScores({ ...modalScores, quiz: Number(e.target.value) })
                      }
                      className="w-16 px-2 py-0.5 text-center font-mono font-bold bg-white border border-slate-300 rounded-md text-xs text-slate-900"
                    />
                    <span className="text-slate-400">/ 100</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={modalScores.quiz}
                  onChange={(e) =>
                    setModalScores({ ...modalScores, quiz: Number(e.target.value) })
                  }
                  className="w-full accent-purple-500"
                />
                <span className="text-[11px] text-slate-500 block">
                  Contributes {((modalScores.quiz * currentWeights.quiz) / 100).toFixed(1)} pts to final grade.
                </span>
              </div>

              {/* 4. Midterm Score */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    4. Midterm Score (Weight: {currentWeights.midterm}%)
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={modalScores.midterm}
                      onChange={(e) =>
                        setModalScores({ ...modalScores, midterm: Number(e.target.value) })
                      }
                      className="w-16 px-2 py-0.5 text-center font-mono font-bold bg-white border border-slate-300 rounded-md text-xs text-slate-900"
                    />
                    <span className="text-slate-400">/ 100</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={modalScores.midterm}
                  onChange={(e) =>
                    setModalScores({ ...modalScores, midterm: Number(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
                <span className="text-[11px] text-slate-500 block">
                  Contributes {((modalScores.midterm * currentWeights.midterm) / 100).toFixed(1)} pts to final grade.
                </span>
              </div>

              {/* 5. Final Exam Score */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      5. Final Exam Score (Weight: {currentWeights.finalExam}%)
                    </span>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!modalScores.hasFinal}
                        onChange={(e) =>
                          setModalScores({ ...modalScores, hasFinal: !e.target.checked })
                        }
                        className="rounded text-indigo-600"
                      />
                      <span>Mark as Pending</span>
                    </label>
                  </div>
                  {modalScores.hasFinal && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={modalScores.finalExam ?? 0}
                        onChange={(e) =>
                          setModalScores({ ...modalScores, finalExam: Number(e.target.value) })
                        }
                        className="w-16 px-2 py-0.5 text-center font-mono font-bold bg-white border border-slate-300 rounded-md text-xs text-slate-900"
                      />
                      <span className="text-slate-400">/ 100</span>
                    </div>
                  )}
                </div>
                {modalScores.hasFinal ? (
                  <>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={modalScores.finalExam ?? 0}
                      onChange={(e) =>
                        setModalScores({ ...modalScores, finalExam: Number(e.target.value) })
                      }
                      className="w-full accent-rose-500"
                    />
                    <span className="text-[11px] text-slate-500 block">
                      Contributes {(((modalScores.finalExam ?? 0) * currentWeights.finalExam) / 100).toFixed(1)} pts to final grade.
                    </span>
                  </>
                ) : (
                  <p className="text-[11px] text-amber-700 italic">
                    Final Exam has not been recorded yet. The overall grade will show as projected based on continuous coursework.
                  </p>
                )}
              </div>
            </div>

            {/* Live Overall Calculated Grade Preview Banner */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                  Calculated Overall Grade
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black font-mono">
                    {liveModalOverall.overallScore.toFixed(1)}%
                  </span>
                  <span className="text-sm font-bold text-emerald-400">
                    Grade {getLetterGrade(liveModalOverall.overallScore / 10)}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({getGradePoints(getLetterGrade(liveModalOverall.overallScore / 10)).toFixed(1)} pts)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Status: {getGradeStatus(liveModalOverall.overallScore, modalScores.hasFinal).label}
                </span>
              </div>

              <div className="text-right text-xs text-slate-300 font-mono">
                <span>
                  Sum of weighted components
                </span>
              </div>
            </div>

            {/* Instructor Feedback */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Instructor Remarks & Feedback for Student:
              </label>
              <textarea
                rows={2}
                value={modalFeedback}
                onChange={(e) => setModalFeedback(e.target.value)}
                placeholder="Add personalized feedback visible to the student on their transcript view..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEvaluatingStudent(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEvaluationModal}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
              >
                Save & Update Grade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
