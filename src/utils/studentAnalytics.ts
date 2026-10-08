import type { AttendanceSession } from '../types';

export interface AssignmentProgressItem {
  id?: string | number;
  status?: string | null;
  submittedAt?: string | null;
  dueDate?: string | null;
  studentScore?: number | null;
  submissions?: Array<{ status?: string | null; submittedAt?: string | null }>;
}

export function calculateAssignmentProgress(assignments: AssignmentProgressItem[]) {
  const uniqueAssignments = Array.from(
    new Map(assignments.map((assignment, index) => [String(assignment.id ?? index), assignment])).values()
  );
  const totalAssigned = uniqueAssignments.length;
  let completedCount = 0;
  let gradedCount = 0;
  let submittedCount = 0;
  let pendingCount = 0;
  let lateOrMissingCount = 0;
  let onTimeCount = 0;

  uniqueAssignments.forEach((assignment) => {
    const status = String(assignment.status || '').trim().toLowerCase();
    const submissionStatuses = (assignment.submissions || []).map((submission) =>
      String(submission.status || '').trim().toLowerCase()
    );
    const hasSubmission =
      Boolean(assignment.submittedAt) ||
      (assignment.studentScore !== null && assignment.studentScore !== undefined) ||
      ['submitted', 'graded', 'late'].includes(status) ||
      submissionStatuses.some((value) => ['submitted', 'graded', 'late'].includes(value));
    const isLate = status === 'late' || submissionStatuses.includes('late');
    const isMissing = status === 'missing' || submissionStatuses.includes('missing');
    const isGraded = status === 'graded' || submissionStatuses.includes('graded');

    if (hasSubmission) {
      completedCount++;
      if (isGraded) gradedCount++;
      else if (isLate || isMissing) lateOrMissingCount++;
      else submittedCount++;
      if (!isLate && !isMissing) onTimeCount++;
    } else if (!isMissing) {
      pendingCount++;
    }
    if (!hasSubmission && isMissing) lateOrMissingCount++;
  });

  return {
    totalAssigned,
    completedCount,
    gradedCount,
    submittedCount,
    pendingCount,
    lateOrMissingCount,
    completionRate: totalAssigned > 0 ? Number(((completedCount / totalAssigned) * 100).toFixed(1)) : 0,
    onTimeRate: totalAssigned > 0 ? Number(((onTimeCount / totalAssigned) * 100).toFixed(1)) : 0,
  };
}

export function calculateWeeklyAttendanceTrend(
  sessions: AttendanceSession[],
  studentIdentifiers: Set<string>,
  enrolledCourseKeys: Set<string>
) {
  const uniqueSessions = new Map<string, AttendanceSession>();
  sessions.forEach((session) => {
    const courseId = String(session.courseId || '').trim().toLowerCase();
    const courseCode = String(session.courseCode || '').trim().toLowerCase();
    if (!enrolledCourseKeys.has(courseId) && !enrolledCourseKeys.has(courseCode)) return;

    const record = session.records?.find((entry) => {
      const studentId = String(entry.studentId || '').trim().toLowerCase();
      const studentName = String(entry.studentName || '').trim().toLowerCase();
      return studentIdentifiers.has(studentId) || (studentName && studentIdentifiers.has(studentName));
    });
    if (session.status !== 'closed' && !record) return;

    const key = `${courseId}|${session.date}|${session.startTime}|${session.endTime}`;
    if (!uniqueSessions.has(key)) uniqueSessions.set(key, session);
  });

  const weeklyTotals = new Map<string, { attended: number; total: number }>();
  uniqueSessions.forEach((session) => {
    const dateText = String(session.date || '');
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateText);
    const date = dateParts
      ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
      : new Date(dateText);
    if (!Number.isFinite(date.getTime())) return;

    const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    const totals = weeklyTotals.get(weekKey) || { attended: 0, total: 0 };
    const studentRecord = session.records?.find((entry) => {
      const studentId = String(entry.studentId || '').trim().toLowerCase();
      const studentName = String(entry.studentName || '').trim().toLowerCase();
      return studentIdentifiers.has(studentId) || (studentName && studentIdentifiers.has(studentName));
    });
    const status = String(studentRecord?.status || '').trim().toLowerCase();

    totals.total++;
    if (status === 'present' || status === 'late' || status === 'excused') totals.attended++;
    weeklyTotals.set(weekKey, totals);
  });

  return Array.from(weeklyTotals.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-8)
    .map(([week, totals]) => ({
      week: new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(`${week}T12:00:00`)),
      attended: totals.attended,
      total: totals.total,
      rate: Number(((totals.attended / totals.total) * 100).toFixed(1)),
    }));
}

export interface CourseGradeSummaryItem {
  credits?: number | null;
  currentPercentage?: number | null;
  gradePoints?: number | null;
  letterGrade?: string | null;
  components?: Array<{ key?: string; name?: string; weight?: number | null }>;
}

export function calculateStudentGradeSummary(
  grades: CourseGradeSummaryItem[],
  getGradePoints: (letter: string) => number,
  getLetterGrade: (percentage: number) => string
) {
  const gradedCourses = grades.filter((grade) =>
    (grade.components || []).some((component) =>
      !String(component.key || component.name || '').toLowerCase().includes('attendance') &&
      Number(component.weight) > 0
    )
  );
  const totalCredits = gradedCourses.reduce((sum, grade) => sum + Math.max(0, Number(grade.credits) || 0), 0);
  const percentageTotal = gradedCourses.reduce(
    (sum, grade) => sum + (Number(grade.currentPercentage) || 0) * (Math.max(0, Number(grade.credits) || 0) || 1),
    0
  );
  const percentageWeight = gradedCourses.reduce(
    (sum, grade) => sum + (Math.max(0, Number(grade.credits) || 0) || 1),
    0
  );
  const overallPercentage = percentageWeight > 0 ? Number((percentageTotal / percentageWeight).toFixed(1)) : null;
  const gpaTotal = gradedCourses.reduce((sum, grade) => {
    const letter = grade.letterGrade || getLetterGrade(Number(grade.currentPercentage) || 0);
    const points = Number.isFinite(Number(grade.gradePoints)) ? Number(grade.gradePoints) : getGradePoints(letter);
    return sum + points * (Math.max(0, Number(grade.credits) || 0) || 1);
  }, 0);
  const gpaWeight = gradedCourses.reduce(
    (sum, grade) => sum + (Math.max(0, Number(grade.credits) || 0) || 1),
    0
  );

  return {
    gradedCourseCount: gradedCourses.length,
    overallPercentage,
    cumulativeGpa: gpaWeight > 0 ? Number((gpaTotal / gpaWeight).toFixed(2)) : null,
    letterGrade: overallPercentage === null ? '-' : getLetterGrade(overallPercentage),
    totalCredits,
  };
}
