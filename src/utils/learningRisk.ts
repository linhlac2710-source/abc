export type LearningRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface StudentRiskMetrics {
  student_id: number;
  class_id: number;
  student_code?: string | null;
  student_name?: string | null;
  attendance_rate: number | null;
  assignment_submission_rate: number | null;
  average_grade: number | null;
  missing_assignment_count: number;
  absence_count: number;
}

export interface StudentRiskAssessment extends StudentRiskMetrics {
  risk_score: number;
  risk_level: LearningRiskLevel;
  reasons: string[];
  calculated_at: string;
}

export function calculateStudentRisk(metrics: StudentRiskMetrics, calculatedAt = new Date()): StudentRiskAssessment | null {
  const factors: Array<{ weight: number; score: number }> = [];
  const reasons: string[] = [];

  if (metrics.attendance_rate !== null) {
    const rate = Math.max(0, Math.min(1, metrics.attendance_rate));
    factors.push({ weight: 0.35, score: Math.max(0, (0.8 - rate) / 0.8) });
    if (rate < 0.8) reasons.push(`Tỷ lệ chuyên cần ${(rate * 100).toFixed(1)}% thấp hơn ngưỡng khuyến nghị 80%.`);
  }

  if (metrics.assignment_submission_rate !== null) {
    const rate = Math.max(0, Math.min(1, metrics.assignment_submission_rate));
    factors.push({ weight: 0.35, score: 1 - rate });
    if (metrics.missing_assignment_count > 0) {
      reasons.push(`Có ${metrics.missing_assignment_count} bài tập đã quá hạn nhưng chưa nộp.`);
    }
  }

  if (metrics.average_grade !== null) {
    const gradePercentage = Math.max(0, Math.min(100, metrics.average_grade * 10));
    factors.push({ weight: 0.3, score: Math.max(0, (70 - gradePercentage) / 70) });
    if (metrics.average_grade < 7) {
      reasons.push(`Điểm trung bình ${metrics.average_grade.toFixed(1)}/10 thấp hơn mốc theo dõi 7/10.`);
    }
  }

  if (factors.length === 0) return null;

  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const riskScore = factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0) / totalWeight;
  const roundedRiskScore = Number(riskScore.toFixed(3));
  const riskLevel: LearningRiskLevel = roundedRiskScore >= 0.6
    ? 'HIGH'
    : roundedRiskScore >= 0.3
      ? 'MEDIUM'
      : 'LOW';

  if (reasons.length === 0) reasons.push('Các chỉ số hiện có chưa vượt ngưỡng cảnh báo.');
  reasons.push('Mức rủi ro được tính từ chuyên cần (35%), tỷ lệ nộp bài (35%) và điểm học phần (30%), chỉ trên các chỉ số đã có dữ liệu.');

  return {
    ...metrics,
    risk_score: roundedRiskScore,
    risk_level: riskLevel,
    reasons,
    calculated_at: calculatedAt.toISOString(),
  };
}
