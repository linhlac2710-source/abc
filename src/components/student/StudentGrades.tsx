import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Calendar,
  Building,
  Info,
} from 'lucide-react';
import { GradeItem, GradeWeightConfig, AttendanceSession, UserProfile, Course } from '../../types';
import { Badge } from '../common/Badge';
import {
  calculateOverallScore,
  calculateWeightedGrade,
  getLetterGrade,
  getGradePoints,
  getGradeStatus,
  DEFAULT_GRADE_WEIGHTS,
  normalizeGradeScore,
} from '../../utils/gradeCalculations';
import { GradesAPI } from '../../api/grades';

type StudentResult = {
  student_id: number;
  class_id: number;
  student_code?: string;
  student_name?: string;
  attendance_stats?: {
    total: number;
    present: number;
    late: number;
    absent: number;
    attendanceRate: number;
    absenceRate: number;
    attendanceExceeded?: boolean;
    attendanceScore?: number;
  };
  attendance_exceeded?: boolean;
  grades: Array<{ id: number; component: string; score: number; weight: number }>;
  total_weight: number;
  aggregate_score: number;
  is_complete: boolean;
};

interface StudentGradesProps {
  grades: GradeItem[];
  attendanceSessions?: AttendanceSession[];
  currentUser?: UserProfile | null;
  courses?: Course[];
  onRefreshGrades?: () => Promise<void> | void;
}

export const StudentGrades: React.FC<StudentGradesProps> = ({
  grades,
  attendanceSessions = [],
  currentUser,
  courses = [],
  onRefreshGrades,
}) => {
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(grades[0]?.id || null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'honors' | 'good_standing' | 'pending_final'>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  const normalizeTenScale = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    return value > 10 ? value / 10 : value;
  };

  const formatTenScale = (value: number) => {
    if (!Number.isFinite(value)) return '0.0';
    return (value > 10 ? value / 10 : value).toFixed(1);
  };

  // Compute overall average percentage
  const avgOverallPercentage = useMemo(() => {
    if (grades.length === 0) return '0.0';
    const sum = grades.reduce((acc, g) => acc + g.currentPercentage, 0);
    return (sum / grades.length / 10).toFixed(1);
  }, [grades]);

  // Compute honors count
  const honorsCount = useMemo(() => {
    return grades.filter((g) => g.currentPercentage >= 90).length;
  }, [grades]);

  const toggleExpand = (id: string) => {
    setExpandedCourseId(expandedCourseId === id ? null : id);
  };

  // Track per-class loading / error / result
  const [loadingResultFor, setLoadingResultFor] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [classResults, setClassResults] = useState<Record<string, StudentResult | null>>({});

  const resolveClassId = (grade: GradeItem): number | null => {
    const directNum = Number(grade.id);
    if (Number.isFinite(directNum) && directNum > 0) return directNum;
    if (courses && courses.length > 0) {
      const match = courses.find(
        (c) =>
          String(c.id) === String(grade.id) ||
          String(c.code || c.class_code).toLowerCase() === String(grade.courseCode).toLowerCase()
      );
      if (match && Number.isFinite(Number(match.id))) return Number(match.id);
    }
    return null;
  };

  const fetchClassResult = async (cid: string) => {
    const grade = grades.find((g) => g.id === cid);
    if (!grade) return;
    const classIdNum = resolveClassId(grade);
    if (!classIdNum) return;

    setLoadingResultFor(cid);
    setResultError(null);
    try {
      const res = await GradesAPI.myClassGrades(classIdNum);
      setClassResults((prev) => ({ ...prev, [cid]: res as any }));
    } catch (err: any) {
      setResultError(err?.message || (err?.data && err.data.detail) || String(err));
      setClassResults((prev) => ({ ...prev, [cid]: null }));
    } finally {
      setLoadingResultFor(null);
    }
  };

  const getEmptyAttendanceStats = (overrides: Partial<Record<string, any>> = {}) => ({
    total: 0,
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    attendanceRate: 0,
    absenceRate: 0,
    attendanceExceeded: false,
    attendanceScore: 0,
    sessionsWithRecord: [],
    ...overrides,
  });

  useEffect(() => {
    if (expandedCourseId) {
      void fetchClassResult(expandedCourseId);
    }
  }, [expandedCourseId, grades, courses]);

  const handleManualSync = async (cid: string) => {
    setIsSyncing(true);
    try {
      if (onRefreshGrades) {
        await onRefreshGrades();
      }
      await fetchClassResult(cid);
    } finally {
      setIsSyncing(false);
    }
  };

  // Compute live attendance data for a course
  const getCourseAttendanceData = (grade: GradeItem) => {
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

    const classSessions = (attendanceSessions || []).filter((s) => {
      const matchesId = String(s.courseId) === String(grade.id);
      const matchesCode =
        grade.courseCode &&
        String(s.courseCode || '').trim().toLowerCase() === String(grade.courseCode || '').trim().toLowerCase();
      const courseMatch = courses?.find(
        (c) =>
          (String(c.id) === String(grade.id) || String(c.code || c.class_code).toLowerCase() === String(grade.courseCode).toLowerCase()) &&
          (String(s.courseId) === String(c.id) || String(s.courseCode || '').toLowerCase() === String(c.code || c.class_code).toLowerCase())
      );
      return matchesId || matchesCode || Boolean(courseMatch);
    });

    const uniqueSessions = Array.from(
      classSessions.reduce((map, session) => {
        const key = `${session.date}|${session.startTime}|${session.endTime}`;
        if (!map.has(key)) map.set(key, session);
        return map;
      }, new Map<string, AttendanceSession>())
      .values()
    );

    // Compute live per-session student record
    const sessionsWithRecord = uniqueSessions.map((session) => {
      const rec = session.records?.find((r) => {
        const rStudentId = String(r.studentId || '').trim().toLowerCase();
        const rStudentName = String(r.studentName || '').trim().toLowerCase();
        return studentIdentifiers.has(rStudentId) || (rStudentName && studentIdentifiers.has(rStudentName));
      });
      const rawStatus = rec ? rec.status : session.status === 'closed' ? 'absent' : 'scheduled';
      return {
        session,
        record: rec || null,
        effectiveStatus: rawStatus,
      };
    });
    const recordedSessions = sessionsWithRecord.filter(
      ({ session, record }) => session.status === 'closed' || Boolean(record)
    );

    let pres = 0;
    let lt = 0;
    let abs = 0;
    let exc = 0;

    recordedSessions.forEach(({ effectiveStatus }) => {
      if (effectiveStatus === 'present') pres++;
      else if (effectiveStatus === 'late') lt++;
      else if (effectiveStatus === 'excused') {
        pres++;
        exc++;
      } else if (effectiveStatus === 'absent') {
        abs++;
      }
    });

    const totalSes = recordedSessions.length;
    const rate = totalSes > 0 ? Number((((pres + lt) / totalSes) * 100).toFixed(1)) : 100;
    const absCount = totalSes > 0 ? Math.max(0, totalSes - pres - lt) : 0;
    const absRate = totalSes > 0 ? Number(((absCount / totalSes) * 100).toFixed(1)) : 0;
    const exceeded = totalSes > 0 && (absCount / totalSes) > 0.2; // Vắng quá 20%
    const score = exceeded ? 0 : rate;

    // Backend result if available
    const backendStats = (classResults[grade.id] as any)?.attendance_stats || grade.attendanceStats;

    if (backendStats && backendStats.total > 0) {
      const backendTotal = Number(backendStats.total);
      const backendPresent = Number(backendStats.present || 0);
      const backendLate = Number(backendStats.late || 0);
      const backendAbsent = Number(backendStats.absent || 0);
      const backendRate = Number.isFinite(Number(backendStats.attendanceRate))
        ? Number(backendStats.attendanceRate)
        : Number((((backendPresent + backendLate) / backendTotal) * 100).toFixed(1));
      const backendAbsenceRate = Number(((backendAbsent / backendTotal) * 100).toFixed(1));
      const backendExceeded = backendStats.attendanceExceeded ?? (backendAbsent / backendTotal > 0.2);

      return {
        total: backendTotal,
        present: backendPresent,
        late: backendLate,
        absent: backendAbsent,
        excused: backendStats.excused ?? 0,
        attendanceRate: backendRate,
        absenceRate: backendAbsenceRate,
        attendanceExceeded: backendExceeded,
        attendanceScore: backendStats.attendanceScore ?? (backendExceeded ? 0 : backendRate),
        sessionsWithRecord: recordedSessions,
      };
    }

    if (totalSes > 0) {
      return {
        total: totalSes,
        present: pres,
        late: lt,
        absent: absCount,
        excused: exc,
        attendanceRate: rate,
        absenceRate: absRate,
        attendanceExceeded: exceeded,
        attendanceScore: score,
        sessionsWithRecord: recordedSessions,
      };
    }

    return getEmptyAttendanceStats({
      total: totalSes,
      present: pres,
      late: lt,
      absent: absCount,
      excused: exc,
      attendanceRate: rate,
      absenceRate: absRate,
      attendanceExceeded: exceeded,
      attendanceScore: score,
      sessionsWithRecord: recordedSessions,
    });
  };

  // Helper to compute live course score and GPA
  const getComputedCourseDetails = (grade: GradeItem) => {
    const attStats = getCourseAttendanceData(grade) ?? getEmptyAttendanceStats();
    const isAttendanceExceeded = attStats.attendanceExceeded === true;
    const attScore = attStats.attendanceScore ?? (grade.attendanceScore ?? 100);

    // Check if components are available
    const rawComponents = (classResults[grade.id] as any)?.grades || grade.components;
    if (Array.isArray(rawComponents) && rawComponents.length > 0) {
      const weightedGrade = calculateWeightedGrade(rawComponents.map((component: any) => {
        const isAttendance = String(component.component || component.name || '').toLowerCase().includes('attendance');
        return {
          score: Number(isAttendance ? attScore : component.score || 0),
          weight: isAttendance ? 0 : Number(component.weight || 0),
        };
      }));
      const completedWeight = weightedGrade.totalWeight;
      const effectiveComponents = rawComponents.map((c: any) => {
        const isAtt = String(c.component || c.name || '').toLowerCase().includes('attendance');
        const score = isAtt ? attScore : Number(c.score || 0);
        const weight = isAtt ? 0 : Number(c.weight || 0);
        return {
          name: String(c.component || c.name || 'Component'),
          score,
          weight,
          contribution: completedWeight > 0
            ? (normalizeGradeScore(score) / 10) * (weight / completedWeight)
            : 0,
          pending: false,
          highlight: false,
        };
      });

      const overallPercent = completedWeight > 0 ? weightedGrade.overallScore : (grade.currentPercentage || 0);
      const letter = getLetterGrade(overallPercent);
      const points = getGradePoints(letter);
      const status = isAttendanceExceeded
        ? { status: 'warning' as const, label: 'Vượt ngưỡng vắng; kiểm tra điều kiện dự thi', description: 'Tỷ lệ vắng được theo dõi riêng và không làm thay đổi GPA.' }
        : getGradeStatus(overallPercent, completedWeight >= 100);

      return {
        attStats,
        isAttendanceExceeded,
        attScore,
        asgScore: grade.assignmentScore ?? (effectiveComponents.find((c) => c.name.toLowerCase().includes('assignment'))?.score ?? 0),
        midScore: grade.midtermScore ?? (effectiveComponents.find((c) => c.name.toLowerCase().includes('midterm'))?.score ?? 0),
        finScore: grade.finalScore ?? (effectiveComponents.find((c) => c.name.toLowerCase().includes('final'))?.score ?? null),
        overallPercent,
        letter,
        points,
        status,
        components: effectiveComponents,
      };
    }

    // Fallback: calculate using component scores input
    const weights: GradeWeightConfig = { ...(grade.weights || DEFAULT_GRADE_WEIGHTS), attendance: 0 };
    const asgScore = grade.assignmentScore;
    const qzScore = grade.quizScore;
    const midScore = grade.midtermScore;
    const finScore = grade.finalScore ?? null;

    const calcResult = calculateOverallScore(
      {
        attendance: attScore,
        assignment: asgScore,
        quiz: qzScore,
        midterm: midScore,
        finalExam: finScore,
      },
      weights
    );

    const overallPercent = calcResult.overallScore || grade.currentPercentage || 0;
    const letter = getLetterGrade(overallPercent);
    const points = getGradePoints(letter);
    const status = isAttendanceExceeded
      ? { status: 'warning' as const, label: 'Vượt ngưỡng vắng; kiểm tra điều kiện dự thi', description: 'Tỷ lệ vắng được theo dõi riêng và không làm thay đổi GPA.' }
      : getGradeStatus(overallPercent, finScore !== null && finScore !== undefined);

    const fallbackComponents = [
      { name: 'Điểm danh (Chuyên cần)', score: attScore, weight: weights.attendance, contribution: (attScore * weights.attendance) / 100, pending: false, highlight: false },
      ...(asgScore !== undefined && asgScore !== null ? [{ name: 'Bài tập (Assignment)', score: asgScore, weight: weights.assignment, contribution: (asgScore * weights.assignment) / 100, pending: false, highlight: false }] : []),
      ...(midScore !== undefined && midScore !== null ? [{ name: 'Kiểm tra giữa kỳ (Midterm)', score: midScore, weight: weights.midterm, contribution: (midScore * weights.midterm) / 100, pending: false, highlight: false }] : []),
      ...(weights.finalExam > 0 ? [{ name: 'Thi cuối kỳ (Final Exam)', score: finScore ?? 0, weight: weights.finalExam, contribution: finScore !== null ? (finScore * weights.finalExam) / 100 : 0, pending: finScore === null, highlight: false }] : []),
    ];

    return {
      attStats,
      isAttendanceExceeded,
      attScore,
      asgScore: asgScore ?? 0,
      midScore: midScore ?? 0,
      finScore,
      overallPercent,
      letter,
      points,
      status,
      components: fallbackComponents,
    };
  };

  const courseDetailsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getComputedCourseDetails>>();
    grades.forEach((g) => {
      map.set(g.id, getComputedCourseDetails(g));
    });
    return map;
  }, [grades, classResults, attendanceSessions, courses, currentUser]);

  // Compute Semester GPA accurately from all enrolled courses
  const totalCredits = grades.reduce((sum, g) => sum + (g.credits || 0), 0);
  const weightedPoints = grades.reduce((sum, g) => {
    const details = courseDetailsMap.get(g.id);
    const coursePoints = details ? details.points : (g.gradePoints || 0);
    return sum + (g.credits || 0) * coursePoints;
  }, 0);
  const semesterGpa = totalCredits > 0 ? (weightedPoints / totalCredits).toFixed(2) : '0.00';

  const handleDownloadTranscript = () => {
    const lines = [
      '===========================================================',
      '        OFFICIAL STUDENT ACADEMIC TRANSCRIPT (FALL 2026)',
      '===========================================================',
      `Term GPA: ${semesterGpa} / 4.00    |    Credits Enrolled: ${totalCredits}`,
      `Academic Standing: ${Number(semesterGpa) >= 3.6 ? 'Xuất sắc (Dean’s Honor List)' : Number(semesterGpa) >= 3.2 ? 'Giỏi' : Number(semesterGpa) >= 2.5 ? 'Khá' : 'Trung bình'}`,
      '-----------------------------------------------------------',
      'Course Code | Course Title | Credits | Overall % | Grade | GPA | Status',
      '-----------------------------------------------------------',
      ...grades.map((g) => {
        const details = courseDetailsMap.get(g.id);
        const overall = details ? details.overallPercent : g.currentPercentage;
        const letter = details ? details.letter : g.letterGrade;
        const pts = details ? details.points : g.gradePoints;
        const statusLabel = details?.status.label || g.gradeStatusLabel || 'Passed';
        return `${g.courseCode.padEnd(11)} | ${g.courseTitle.slice(0, 25).padEnd(25)} | ${g.credits} cr | ${overall.toFixed(1)}% | ${letter.padEnd(3)} | ${pts.toFixed(1)} | ${statusLabel}`;
      }),
      '===========================================================',
      'Detailed Component Scores Breakdown Available in Student Portal',
      '===========================================================',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Academic_Transcript_Fall_2026.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered grades list
  const filteredGrades = useMemo(() => {
    return grades.filter((g) => {
      const details = courseDetailsMap.get(g.id);
      const overall = details ? details.overallPercent : g.currentPercentage;
      if (filterStatus === 'all') return true;
      if (filterStatus === 'honors') return overall >= 90;
      if (filterStatus === 'good_standing') return overall >= 70 && overall < 90;
      if (filterStatus === 'pending_final') return g.finalScore === null;
      return true;
    });
  }, [grades, filterStatus, courseDetailsMap]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Bảng điểm học phần & Điểm danh chuyên cần
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi chi tiết các cột điểm thành phần, điểm chuyên cần đồng bộ từ giảng viên và kết quả học tập.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshGrades && (
            <button
              onClick={() => onRefreshGrades()}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Đồng bộ dữ liệu giảng viên
            </button>
          )}
          <button
            onClick={handleDownloadTranscript}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            Tải bảng điểm (TXT)
          </button>
        </div>
      </div>

      {/* GPA & Academic Status Banner Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-5 text-white shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-indigo-200">
            Điểm trung bình học kỳ (GPA)
          </span>
          <div className="my-2">
            <span className="text-4xl font-black font-mono">{semesterGpa}</span>
            <span className="text-xs text-indigo-200 ml-1.5">/ Thang điểm 4.00</span>
          </div>
          <span className="text-[11px] text-indigo-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-300" />
            Học lực: {Number(semesterGpa) >= 3.6 ? 'Xuất sắc' : Number(semesterGpa) >= 3.2 ? 'Giỏi' : Number(semesterGpa) >= 2.5 ? 'Khá' : 'Trung bình'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Số tín chỉ tích lũy
          </span>
          <div className="my-2">
            <span className="text-4xl font-extrabold text-slate-900 font-mono">{totalCredits}</span>
            <span className="text-xs text-slate-400 ml-1.5">Tín chỉ</span>
          </div>
          <span className="text-[11px] text-slate-500">Tất cả các học phần đang được đánh giá và tính điểm</span>
        </div>
      </div>

      {/* Courses List */}
      <div className="space-y-4">
        {filteredGrades.map((grade) => {
          const isExpanded = expandedCourseId === grade.id;
          const details = courseDetailsMap.get(grade.id) || getComputedCourseDetails(grade);

          const weights: GradeWeightConfig = grade.weights || DEFAULT_GRADE_WEIGHTS;
          const attStats = details.attStats ?? getEmptyAttendanceStats();
          const isAttendanceExceeded = details.isAttendanceExceeded;
          const attScore = details.attScore;
          const asgScore = details.asgScore;
          const midScore = details.midScore;
          const finScore = details.finScore;
          const overallPercent = details.overallPercent;
          const letter = details.letter;
          const points = details.points;
          const status = details.status;

          return (
            <div
              key={grade.id}
              className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                isAttendanceExceeded ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
              }`}
            >
              {/* Main Course Summary Header (Always Visible) */}
              <div
                onClick={() => toggleExpand(grade.id)}
                className="p-5 hover:bg-slate-50/70 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-indigo-700 text-sm font-mono tracking-tight">
                      {grade.courseCode}
                    </span>
                    <span className="text-slate-300">•</span>
                    <h3 className="font-bold text-slate-900 text-sm">{grade.courseTitle}</h3>
                    <span className="text-[11px] text-slate-400 font-medium">({grade.credits} Tín chỉ)</span>
                  </div>

                  {/* Component Quick Chips */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 ${
                      isAttendanceExceeded
                        ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                        : 'bg-sky-50 text-sky-700 border-sky-200'
                    }`}>
                      <span className="font-semibold">Điểm danh:</span>
                      <strong className="font-mono">{formatTenScale(attScore)}/10</strong>
                      <span className="text-[10px] opacity-80 font-normal">
                        ({attStats.attendanceRate}% chuyên cần · {attStats.present + attStats.late}/{attStats.total} buổi tham gia · trọng số {weights.attendance}%)
                      </span>
                      {weights.attendance === 0 && (
                        <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-sm font-bold">
                          Không tính vào điểm tổng
                        </span>
                      )}
                      {isAttendanceExceeded && (
                        <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider">
                          Vắng &gt;20%
                        </span>
                      )}
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 font-medium">
                      Bài tập: <strong className="font-mono">{formatTenScale(asgScore)}/10</strong> ({weights.assignment}%)
                    </span>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md border border-amber-100 font-medium">
                      Giữa kỳ: <strong className="font-mono">{formatTenScale(midScore)}/10</strong> ({weights.midterm}%)
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border font-medium ${
                      finScore !== null && finScore !== undefined
                        ? 'bg-rose-50 text-rose-700 border-rose-100'
                        : 'bg-slate-100 text-slate-500 border-slate-200 italic'
                    }`}>
                      Cuối kỳ: <strong className="font-mono">{finScore !== null && finScore !== undefined ? `${formatTenScale(finScore)}/10` : 'Chờ thi'}</strong> ({weights.finalExam}%)
                    </span>
                  </div>
                </div>

                {/* Right side: Overall Score & Grade Status */}
                <div className="flex items-center gap-5 shrink-0 self-start md:self-center">
                  {/* Grade Status Badge */}
                  <div className="text-right">
                    <Badge
                      variant={
                        status.status === 'honors'
                          ? 'emerald'
                          : status.status === 'good_standing'
                          ? 'indigo'
                          : status.status === 'warning'
                          ? 'amber'
                          : status.status === 'pending_final'
                          ? 'blue'
                          : 'rose'
                      }
                      size="md"
                    >
                      {status.label}
                    </Badge>
                    <span className="text-[10px] text-slate-400 block mt-0.5 text-right">
                      Điểm TB môn: {formatTenScale(overallPercent)}/10 ({overallPercent}%)
                    </span>
                  </div>

                  {/* Overall Score Box */}
                  <div className="text-right bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200/80 min-w-[90px]">
                    <div className="flex items-baseline justify-end gap-1.5">
                      <span className="text-xl font-black text-slate-900 font-mono">
                        {formatTenScale(overallPercent)}/10
                      </span>
                      <span className={`text-xs font-black px-1.5 py-0.2 rounded-sm ${
                        letter.startsWith('A')
                          ? 'bg-emerald-100 text-emerald-800'
                          : letter.startsWith('B')
                          ? 'bg-indigo-100 text-indigo-800'
                          : letter.startsWith('C')
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {letter}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Tổng kết ({points.toFixed(1)} GPA)
                    </span>
                  </div>

                  <div className="text-slate-400 p-1">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown (When Expanded) */}
              {isExpanded && (
                <div className="bg-slate-50/80 p-5 border-t border-slate-200/80 space-y-6 animate-fadeIn">
                  {/* Student result fetched from backend */}
                  {loadingResultFor === grade.id ? (
                    <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      Đang đồng bộ kết quả điểm danh & điểm số từ giảng viên...
                    </div>
                  ) : resultError ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center text-xs text-rose-700 flex items-center justify-between">
                      <span>{resultError}</span>
                      <button
                        onClick={() => handleManualSync(grade.id)}
                        className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : null}

                  {/* BẢNG ĐIỂM HỌC PHẦN */}
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Bảng điểm
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          {grade.courseCode} · {grade.courseTitle}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleManualSync(grade.id)}
                          disabled={isSyncing || loadingResultFor === grade.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-medium transition-colors"
                          title="Đồng bộ lại điểm danh từ giảng viên"
                        >
                          <RefreshCw className={`w-3 h-3 text-indigo-600 ${isSyncing || loadingResultFor === grade.id ? 'animate-spin' : ''}`} />
                          Đồng bộ từ giảng viên
                        </button>
                        <Badge
                          variant={
                            status.status === 'honors'
                              ? 'emerald'
                              : status.status === 'good_standing'
                              ? 'indigo'
                              : status.status === 'warning'
                              ? 'amber'
                              : status.status === 'pending_final'
                              ? 'blue'
                              : 'rose'
                          }
                          size="sm"
                        >
                          {status.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Thành phần</th>
                            <th className="px-4 py-3 font-semibold text-right">Điểm</th>
                            <th className="px-4 py-3 font-semibold text-right">Trọng số</th>
                            <th className="px-4 py-3 font-semibold text-right">Đóng góp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.components.map((item) => (
                            <tr
                              key={item.name}
                              className={`border-t border-slate-200 ${
                                item.highlight ? 'bg-rose-50/60' : ''
                              }`}
                            >
                              <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                                <span>{item.name}</span>
                                {item.highlight && (
                                  <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded-sm font-bold">
                                    Vắng &gt;20%
                                  </span>
                                )}
                                {item.weight === 0 && (
                                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-sm font-semibold">
                                    Không tính vào điểm tổng
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                                {item.pending ? (
                                  <span className="text-slate-400 italic font-normal">Chờ thi</span>
                                ) : (
                                  `${formatTenScale(item.score)}/10`
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-600">
                                {item.weight}%
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-semibold text-indigo-700">
                                +{item.contribution.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                            <td className="px-4 py-3 text-slate-900">Tổng điểm môn học</td>
                            <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                              {formatTenScale(overallPercent)}/10
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600">
                              {details.components.reduce((sum, c) => sum + c.weight, 0)}%
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-black text-indigo-700">
                              {formatTenScale(overallPercent)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* PHẦN ĐIỂM DANH ĐỒNG BỘ TỪ GIẢNG VIÊN */}
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                            Chi tiết điểm danh từ giảng viên (Đồng bộ trực tiếp)
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Dữ liệu chuyên cần được giảng viên ghi nhận và đồng bộ trực tiếp vào bảng điểm môn học.
                        </p>
                      </div>

                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 self-start sm:self-center">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Đồng bộ theo thời gian thực
                      </span>
                    </div>

                    {/* Quick Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                        <span className="text-[11px] font-medium text-slate-500 block">Tổng số buổi</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black font-mono text-slate-900">{attStats.total}</span>
                          <span className="text-xs text-slate-400">buổi</span>
                        </div>
                      </div>

                      <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
                        <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Có mặt
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black font-mono text-emerald-800">{attStats.present}</span>
                          <span className="text-xs text-emerald-600">buổi</span>
                        </div>
                      </div>

                      <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80">
                        <span className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Đi muộn
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black font-mono text-amber-800">{attStats.late}</span>
                          <span className="text-xs text-amber-600">buổi</span>
                        </div>
                      </div>

                      <div className={`p-3 rounded-xl border ${
                        attStats.absent > 0 ? 'bg-rose-50/80 border-rose-200' : 'bg-slate-50 border-slate-200/80'
                      }`}>
                        <span className={`text-[11px] font-medium flex items-center gap-1 ${
                          attStats.absent > 0 ? 'text-rose-700' : 'text-slate-500'
                        }`}>
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Vắng mặt
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className={`text-2xl font-black font-mono ${
                            attStats.absent > 0 ? 'text-rose-800' : 'text-slate-900'
                          }`}>
                            {attStats.absent}
                          </span>
                          <span className="text-xs text-slate-400">buổi</span>
                        </div>
                      </div>
                    </div>

                    {/* Attendance Regulation Notice Banner */}
                    {isAttendanceExceeded ? (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold text-rose-950 block">
                            Cảnh báo quy chế: Vắng quá 20% số buổi học ({attStats.absent}/{attStats.total} buổi)
                          </strong>
                          <span>
                            Vui lòng xác nhận điều kiện dự thi với giảng viên. Chuyên cần có trọng số 0% nên cảnh báo này không tự thay đổi điểm thành phần hoặc GPA.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong>Đủ điều kiện dự thi:</strong> Tỷ lệ chuyên cần đạt <strong>{attStats.attendanceRate}%</strong> ({attStats.present}/{attStats.total} buổi). Điểm chuyên cần quy đổi sang hệ 10: <strong>{formatTenScale(attScore)}/10</strong>.
                              <strong>Đủ điều kiện dự thi:</strong> Tỷ lệ chuyên cần đạt <strong>{attStats.attendanceRate}%</strong> ({attStats.present} có mặt + {attStats.late} đi muộn / {attStats.total} buổi). Điểm chuyên cần quy đổi sang hệ 10: <strong>{formatTenScale(attScore)}/10</strong>.
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                          Chuyên cần đạt chuẩn
                        </span>
                      </div>
                    )}

                    {/* Session Log Table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>Lịch sử các buổi điểm danh do giảng viên tổ chức</span>
                        <span className="text-[11px] font-normal text-slate-400">
                          {attStats.sessionsWithRecord.length} ca học đã ghi nhận
                        </span>
                      </div>

                      {attStats.sessionsWithRecord.length === 0 ? (
                        <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                          Chưa có phiên điểm danh nào được giảng viên ghi nhận cho lớp học này.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                          <table className="min-w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50 text-slate-600">
                              <tr>
                                <th className="px-3 py-2.5 font-semibold">Buổi học</th>
                                <th className="px-3 py-2.5 font-semibold">Thời gian & Phòng</th>
                                <th className="px-3 py-2.5 font-semibold">Giảng viên ghi nhận</th>
                                <th className="px-3 py-2.5 font-semibold text-right">Giờ điểm danh / Ghi chú</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attStats.sessionsWithRecord.map(({ session, record, effectiveStatus }, idx) => (
                                <tr key={session.id || idx} className="border-t border-slate-100 hover:bg-slate-50/60">
                                  <td className="px-3 py-2.5">
                                    <span className="font-semibold text-slate-900 block">
                                      {session.sessionTitle || `Buổi học #${idx + 1}`}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      Mã ca: {session.id}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-1.5 text-slate-600">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      <span>{session.date}</span>
                                      <span className="text-slate-300">•</span>
                                      <span>{session.startTime} - {session.endTime}</span>
                                    </div>
                                    {session.room && (
                                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                        <Building className="w-3 h-3" />
                                        <span>{session.room}</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {effectiveStatus === 'present' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        Có mặt
                                      </span>
                                    ) : effectiveStatus === 'late' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                        <Clock className="w-3 h-3 text-amber-600" />
                                        Đi muộn
                                      </span>
                                    ) : effectiveStatus === 'excused' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                        <ShieldCheck className="w-3 h-3 text-purple-600" />
                                        Có phép
                                      </span>
                                    ) : effectiveStatus === 'absent' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                        <XCircle className="w-3 h-3 text-rose-600" />
                                        Vắng mặt
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                        Chưa diễn ra
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-600">
                                    {record?.checkInTime ? (
                                      <div>
                                        <span className="text-slate-800 font-semibold">{record.checkInTime}</span>
                                        {record.notes && (
                                          <span className="block text-[10px] text-slate-400 italic">
                                            {record.notes}
                                          </span>
                                        )}
                                      </div>
                                    ) : effectiveStatus === 'absent' ? (
                                      <span className="text-rose-600 font-semibold">Không có mặt</span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lecturer Evaluation Feedback Note (if present) */}
                  {grade.feedback && (
                    <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-1">
                      <span className="text-xs font-bold text-indigo-900 block">
                        Nhận xét và đánh giá từ giảng viên:
                      </span>
                      <p className="text-xs text-indigo-800 italic">
                        "{grade.feedback}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
