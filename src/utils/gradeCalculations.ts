import { GradeWeightConfig, GradeStatus } from '../types';

export const DEFAULT_GRADE_WEIGHTS: GradeWeightConfig = {
  attendance: 0,
  assignment: 20,
  quiz: 10,
  midterm: 20,
  finalExam: 50,
};

export interface WeightPreset {
  id: string;
  name: string;
  description: string;
  weights: GradeWeightConfig;
}

export const GRADE_WEIGHT_PRESETS: WeightPreset[] = [
  {
    id: 'standard',
    name: 'Standard Academic',
    description: '0% Attendance (tracked for eligibility only), 10% Assignment, 30% Midterm, 60% Final',
    weights: { attendance: 0, assignment: 10, quiz: 0, midterm: 30, finalExam: 60 },
  },
  {
    id: 'exam_heavy',
    name: 'Exam Focused',
    description: '0% Attendance, 15% Assignments, 10% Quizzes, 25% Midterm, 50% Final',
    weights: { attendance: 0, assignment: 15, quiz: 10, midterm: 25, finalExam: 50 },
  },
  {
    id: 'continuous',
    name: 'Continuous Assessment',
    description: '0% Attendance, 50% Assignments, 20% Quizzes, 15% Midterm, 15% Final',
    weights: { attendance: 0, assignment: 50, quiz: 20, midterm: 15, finalExam: 15 },
  },
  {
    id: 'balanced',
    name: 'Equal 4-Way Split',
    description: '0% Attendance, with 25% each for Assignment, Quiz, Midterm, and Final',
    weights: { attendance: 0, assignment: 25, quiz: 25, midterm: 25, finalExam: 25 },
  },
];

export interface ComponentScoresInput {
  attendance?: number | null;
  assignment?: number | null;
  quiz?: number | null;
  midterm?: number | null;
  finalExam?: number | null;
}

export function normalizeGradeScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const percentage = value <= 10 ? value * 10 : value;
  return Math.max(0, Math.min(100, percentage));
}

export interface WeightedGradeComponent {
  score: number;
  weight: number;
}

export interface AssignmentScore {
  score: number;
  maxScore: number;
  weight: number;
}

export function calculateAssignmentAverage(assignments: AssignmentScore[]): number | null {
  const validAssignments = assignments.filter(
    (assignment) =>
      Number.isFinite(assignment.score) &&
      Number.isFinite(assignment.maxScore) &&
      assignment.maxScore > 0 &&
      Number.isFinite(assignment.weight)
  );
  if (validAssignments.length === 0) return null;

  const weightedAssignments = validAssignments.filter((assignment) => assignment.weight > 0);
  const totalWeight = weightedAssignments.reduce((sum, assignment) => sum + assignment.weight, 0);
  const average = totalWeight > 0
    ? weightedAssignments.reduce(
        (sum, assignment) => sum + (assignment.score / assignment.maxScore) * 10 * assignment.weight,
      0
    ) / totalWeight
    : validAssignments.reduce(
        (sum, assignment) => sum + (assignment.score / assignment.maxScore) * 10,
      0
    ) / validAssignments.length;

  return Math.round(average * 100) / 100;
}

export function calculateWeightedGrade(components: WeightedGradeComponent[]): {
  overallScore: number;
  totalWeight: number;
} {
  const validComponents = components.filter(
    (component) => Number.isFinite(component.score) && Number.isFinite(component.weight) && component.weight > 0
  );
  const totalWeight = validComponents.reduce((sum, component) => sum + component.weight, 0);
  if (totalWeight <= 0) return { overallScore: 0, totalWeight: 0 };

  const weightedTotal = validComponents.reduce(
    (sum, component) => sum + normalizeGradeScore(component.score) * component.weight,
    0
  );
  return {
    overallScore: Math.round((weightedTotal / totalWeight) * 10) / 10,
    totalWeight,
  };
}

/**
 * Calculates overall grade percentage based on configurable component weights.
 */
export function calculateOverallScore(
  scores: ComponentScoresInput,
  weights: GradeWeightConfig = DEFAULT_GRADE_WEIGHTS
): { overallScore: number; isProjected: boolean; completedWeight: number } {
  const hasFinal = scores.finalExam !== null && scores.finalExam !== undefined && !isNaN(scores.finalExam);

  const hasAtt = scores.attendance !== null && scores.attendance !== undefined && !isNaN(scores.attendance);
  const hasAsg = scores.assignment !== null && scores.assignment !== undefined && !isNaN(scores.assignment);
  const hasQz = scores.quiz !== null && scores.quiz !== undefined && !isNaN(scores.quiz);
  const hasMid = scores.midterm !== null && scores.midterm !== undefined && !isNaN(scores.midterm);

  const att = hasAtt ? normalizeGradeScore(scores.attendance!) : 0;
  const asg = hasAsg ? normalizeGradeScore(scores.assignment!) : 0;
  const qz = hasQz ? normalizeGradeScore(scores.quiz!) : 0;
  const mid = hasMid ? normalizeGradeScore(scores.midterm!) : 0;
  const fin = hasFinal ? normalizeGradeScore(scores.finalExam!) : 0;

  if (hasFinal) {
    let completedWeight = 0;
    let rawTotal = 0;
    if (hasAtt) { completedWeight += weights.attendance; rawTotal += att * weights.attendance; }
    if (hasAsg) { completedWeight += weights.assignment; rawTotal += asg * weights.assignment; }
    if (hasQz) { completedWeight += weights.quiz; rawTotal += qz * weights.quiz; }
    if (hasMid) { completedWeight += weights.midterm; rawTotal += mid * weights.midterm; }
    completedWeight += weights.finalExam;
    rawTotal += fin * weights.finalExam;

    const divisor = completedWeight > 0 ? completedWeight : 100;
    const score = Math.round((rawTotal / divisor) * 10) / 10;
    return { overallScore: score, isProjected: false, completedWeight };
  } else {
    // Projected score based only on existing/completed continuous components
    let completedWeight = 0;
    let rawCompleted = 0;
    if (hasAtt) { completedWeight += weights.attendance; rawCompleted += att * weights.attendance; }
    if (hasAsg) { completedWeight += weights.assignment; rawCompleted += asg * weights.assignment; }
    if (hasQz) { completedWeight += weights.quiz; rawCompleted += qz * weights.quiz; }
    if (hasMid) { completedWeight += weights.midterm; rawCompleted += mid * weights.midterm; }

    if (completedWeight <= 0) return { overallScore: 0, isProjected: true, completedWeight: 0 };

    const projected = Math.round((rawCompleted / completedWeight) * 10) / 10;
    return { overallScore: projected, isProjected: true, completedWeight };
  }
}

/**
 * Letter grade mapping conforming to university grading systems
 */
export function getLetterGrade(percentage: number): string {
  const num = Number(percentage);
  if (!Number.isFinite(num) || num <= 0) return 'F';

  // Standardize to 10-point scale:
  // If percentage > 10, it's on a 100-point scale (e.g. 85.5 -> 8.55)
  const scoreOnTen = num > 10 ? num / 10 : num;

  if (scoreOnTen >= 9.0) return 'A+';
  if (scoreOnTen >= 8.5) return 'A';
  if (scoreOnTen >= 8.0) return 'B+';
  if (scoreOnTen >= 7.0) return 'B';
  if (scoreOnTen >= 6.5) return 'C+';
  if (scoreOnTen >= 5.5) return 'C';
  if (scoreOnTen >= 5.0) return 'D+';
  if (scoreOnTen >= 4.0) return 'D';
  return 'F';
}

/**
 * Standard 4.0 GPA scale conversion
 */
export function getGradePoints(letterGrade: string): number {
  const normalized = String(letterGrade || '').trim().toUpperCase();
  switch (normalized) {
    case 'A+':
    case 'A':
      return 4.0;
    case 'B+':
      return 3.5;
    case 'B':
      return 3.0;
    case 'C+':
      return 2.5;
    case 'C':
      return 2.0;
    case 'D+':
      return 1.5;
    case 'D':
      return 1.0;
    case 'F':
    default:
      return 0.0;
  }
}

/**
 * Grade status classification based on overall performance and final exam completion
 */
export function getGradeStatus(
  overallScore: number,
  hasFinalScore: boolean
): { status: GradeStatus; label: string; description: string } {
  const normalized = Number.isFinite(overallScore) ? overallScore : 0;

  if (!hasFinalScore) {
    if (normalized >= 85) {
      return {
        status: 'pending_final',
        label: 'In Progress (On Honors Track)',
        description: 'Excellent performance across coursework; awaiting final examination assessment.',
      };
    }
    if (normalized >= 70) {
      return {
        status: 'pending_final',
        label: 'In Progress (Good Standing)',
        description: 'Satisfactory academic progress in continuous components; pending final exam.',
      };
    }
    if (normalized >= 60) {
      return {
        status: 'warning',
        label: 'In Progress (Warning)',
        description: 'Continuous scores are near the passing threshold. Final exam is decisive.',
      };
    }
    return {
      status: 'at_risk',
      label: 'At Risk of Course Failure',
      description: 'Continuous assessment is below minimum passing requirement. Urgent remediation needed.',
    };
  }

  // With Final Exam completed
  if (normalized >= 85) {
    return {
      status: 'honors',
      label: 'Passed (Dean’s Honor List)',
      description: 'Outstanding mastery achieved with highest academic distinction.',
    };
  }
  if (normalized >= 70) {
    return {
      status: 'good_standing',
      label: 'Passed (Good Standing)',
      description: 'Successfully passed with solid command of syllabus competencies.',
    };
  }
  if (normalized >= 55) {
    return {
      status: 'good_standing',
      label: 'Passed (Satisfactory)',
      description: 'Met minimum graduation credit requirements for this course.',
    };
  }
  if (normalized >= 40) {
    return {
      status: 'warning',
      label: 'Conditional Pass (Grade D)',
      description: 'Earned the minimum passing score under the university grading scale.',
    };
  }
  return {
    status: 'failed',
    label: 'Failed (Grade F)',
    description: 'Did not meet cumulative threshold of 50%. Course credit not awarded.',
  };
}

/**
 * Calculates score needed on Final Exam to achieve target overall grade
 */
export function calculateRequiredFinalScore(
  targetOverall: number,
  currentScores: { attendance: number; assignment: number; quiz: number; midterm: number },
  weights: GradeWeightConfig
): { requiredFinal: number | null; isAchievable: boolean } {
  if (weights.finalExam <= 0) return { requiredFinal: null, isAchievable: false };

  const currentAccumulated =
    (currentScores.attendance * weights.attendance) +
    (currentScores.assignment * weights.assignment) +
    (currentScores.quiz * weights.quiz) +
    (currentScores.midterm * weights.midterm);

  const neededFinalWeight = (targetOverall * 100) - currentAccumulated;
  const requiredScore = Math.round((neededFinalWeight / weights.finalExam) * 10) / 10;

  return {
    requiredFinal: Math.max(0, requiredScore),
    isAchievable: requiredScore <= 100,
  };
}
