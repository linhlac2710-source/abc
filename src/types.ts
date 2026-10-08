export type Role = 'student' | 'lecturer' | 'admin';

export interface UserProfile {
  id: string;
  full_name: string;
  name: string; // for compatibility
  email: string;
  password?: string;
  role: Role;

  // Student specific fields
  student_id?: string;
  studentId?: string; // compatibility alias
  student_code?: string;
  phone?: string;
  major?: string;
  class_name?: string;

  // Lecturer specific fields
  lecturer_id?: string;
  lecturer_code?: string;
  facultyId?: string; // compatibility alias

  // Academic and campus metadata
  department: string;
  avatarUrl: string;
  status: 'active' | 'suspended' | 'on_leave';
  joinedDate: string;
}

export interface ClassJoinRequest {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  avatarUrl?: string;
  major?: string;
  className?: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface EnrolledStudentProfile {
  id: string;
  student_id?: string;
  studentId?: string;
  full_name: string;
  email?: string;
  major?: string;
  class_name?: string;
  avatarUrl?: string;
  role: 'student';
}

export interface Course {
  id: string;
  // User specified class fields:
  class_code: string;
  class_name: string;
  subject: string;
  lecturer: string;
  room: string;
  capacity: number;
  schedule: string;

  // Compatibility fields:
  code: string;
  title: string;
  department: string;
  credits: number;
  lecturerName: string;
  lecturerId: string;
  virtualLink?: string;
  enrolledCount: number;
  progressPercent: number;
  semester: string;
  bannerColor: string; // Tailwind color token or gradient style
  description: string;
  classStatus?: 'active' | 'upcoming' | 'archived' | 'closed' | 'rejected';
  attendanceRate?: number;
  averageGrade?: number;
  startDate?: string;
  durationWeeks?: number;

  // Enrolled student management & requests:
  enrolledStudentIds?: string[];
  enrolledStudents?: EnrolledStudentProfile[];
  joinRequests?: ClassJoinRequest[];
}

export interface ScheduleItem {
  id: string;
  courseCode: string;
  courseTitle: string;
  subject?: string;
  lecturerName: string;
  room: string;
  building: string;
  startTime: string; // "09:00"
  endTime: string; // "10:30"
  date?: string; // "2026-09-21"
  classStartDate?: string;
  classDurationWeeks?: number;
  dayOfWeek?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  type: 'Lecture' | 'Lab' | 'Tutorial' | 'Seminar';
  status: 'upcoming' | 'in_progress' | 'completed';
  sessionTopic: string;
  checkInCode?: string;
  isCheckedIn?: boolean;
  color?: string;
}

export interface ScheduleConflict {
  id: string;
  type: 'room' | 'lecturer' | 'both';
  sessionA: ScheduleItem;
  sessionB: ScheduleItem;
  date: string;
  dayOfWeek?: string;
  room?: string;
  lecturerName?: string;
  overlapStart: string;
  overlapEnd: string;
  warningMessage: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  avatarUrl?: string;
  submittedAt?: string;
  fileName?: string;
  fileSize?: string;
  notes?: string;
  status: 'submitted' | 'late' | 'graded' | 'missing';
  score?: number;
  maxScore: number;
  feedback?: string;
  gradedAt?: string;
  gradedBy?: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  description: string;
  dueDate: string;
  weightPercent: number;
  maxScore: number;
  status: 'pending' | 'submitted' | 'graded' | 'late' | 'missing';
  studentScore?: number;
  feedback?: string;
  submittedAt?: string;
  submittedFile?: string;
  submissionNotes?: string;
  totalSubmissions?: number;
  pendingGradingCount?: number;
  submissions?: AssignmentSubmission[];
}

export interface GradeWeightConfig {
  attendance: number;
  assignment: number;
  quiz: number;
  midterm: number;
  finalExam: number;
}

export type GradeStatus =
  | 'honors'
  | 'good_standing'
  | 'in_progress'
  | 'warning'
  | 'at_risk'
  | 'pending_final'
  | 'failed';

export interface GradeItem {
  id: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  components: {
    name: string;
    key?: 'attendance' | 'assignment' | 'quiz' | 'midterm' | 'finalExam';
    weight: number;
    score: number;
    maxScore: number;
    contributedPoints?: number;
  }[];
  attendanceScore?: number;
  assignmentScore?: number;
  quizScore?: number;
  midtermScore: number;
  finalScore?: number | null;
  currentPercentage: number;
  letterGrade: string;
  gradePoints: number; // 4.0 scale
  classAverage: number;
  weights?: GradeWeightConfig;
  gradeStatus?: GradeStatus;
  gradeStatusLabel?: string;
  feedback?: string;
  attendanceStats?: {
    total: number;
    present: number;
    late: number;
    absent: number;
    attendanceRate: number;
    absenceRate: number;
    attendanceExceeded?: boolean;
    attendanceScore?: number;
  };
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'scheduled';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  avatarUrl?: string;
  status: AttendanceStatus;
  checkInTime?: string;
  method?: 'code' | 'qr' | 'manual' | 'rfid';
  notes?: string;
  warning?: string | null;
}

export interface AttendanceSession {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  lecturerId: string;
  lecturerName: string;
  sessionTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  status: 'scheduled' | 'active' | 'closed';
  sessionStatus?: 'UPCOMING' | 'ACTIVE' | 'LOCKED';
  attendanceMethod?: 'MANUAL' | 'QR';
  sessionCode?: string;
  checkInCode: string;
  allowLateMinutes?: number;
  createdAt: string;
  startedAt?: string;
  closedAt?: string;
  records: AttendanceRecord[];
}

export interface StudentAttendance {
  courseCode: string;
  courseTitle: string;
  totalSessions: number;
  attendedSessions: number;
  lateSessions: number;
  absentSessions: number;
  percentage: number;
  minRequiredPercentage: number; // 80%
  attendanceExceeded?: boolean;
  status: 'good' | 'warning' | 'critical';
  recentSessions: {
    date: string;
    topic: string;
    status: 'present' | 'late' | 'absent' | 'excused';
  }[];
}

export interface LearningRiskFactor {
  id: string;
  level: 'low' | 'moderate' | 'high';
  courseCode: string;
  title: string;
  reason: string;
  metric: string;
  suggestedAction: string;
  actionType: 'schedule_office_hours' | 'review_material' | 'peer_study' | 'submit_makeup';
  resolved?: boolean;
}

export interface RecommendedLearningItem {
  id: string;
  title: string;
  category: 'Foundation' | 'Recommended Skill' | 'Remedial' | 'Advanced Elective';
  courseRelation: string;
  estimatedHours: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  relevanceReason: string;
  progressPercent: number;
  tags: string[];
}

export interface StudentRosterItem {
  id: string;
  studentId: string;
  name: string;
  email: string;
  avatarUrl: string;
  courseId: string;
  attendanceRate: number;
  currentGradePercent: number;
  letterGrade: string;
  assignmentsSubmitted: number;
  totalAssignments: number;
  riskStatus: 'low' | 'moderate' | 'high';
  lastAttendanceStatus: 'present' | 'late' | 'absent' | 'excused';
  // Configurable Grade Management Component Scores
  attendanceScore?: number;
  assignmentScore?: number;
  quizScore?: number;
  midtermScore?: number;
  finalScore?: number | null;
  overallScore?: number;
  gradeStatus?: GradeStatus;
  gradeStatusLabel?: string;
  gradeFeedback?: string;
}

export interface SystemStatSummary {
  totalStudents: number;
  totalLecturers: number;
  totalCourses: number;
  overallAttendanceRate: number;
  smartClassroomsActive: number;
  totalSmartClassrooms: number;
  iotDevicesOnline: number;
  iotTotalDevices: number;
  systemLoadPercent: number;
  activeSessionsNow: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'academic' | 'attendance' | 'assignment' | 'system';
  unread: boolean;
  roleTarget: Role | 'all';
}

export interface StudentQuizRecord {
  id: string;
  title: string;
  courseCode: string;
  score: number;
  maxScore: number;
  classAverage: number;
  percentile: number;
  date: string;
  topic: string;
  status: 'passed' | 'excellent' | 'needs_review';
}

// --- Analytics types (from backend schemas)
export interface StudentRiskResponse {
  student_id: number;
  class_id: number;
  student_code?: string | null;
  student_name?: string | null;
  attendance_rate: number | null; // 0.0 - 1.0
  assignment_submission_rate: number | null; // 0.0 - 1.0
  average_grade: number | null; // 0.0 - 10.0
  missing_assignment_count: number;
  absence_count: number;
  risk_score: number; // 0.0 - 1.0
  risk_level: string; // LOW | MEDIUM | HIGH
  reasons: string[];
  calculated_at: string;
}

export interface LearningRecommendationItemSimple {
  id?: number | null;
  recommendation_type: string;
  title: string;
  description: string;
  priority: string; // HIGH | MEDIUM | LOW
  reason: string;
  target_topic?: string | null;
  recommended_order: number;
  status: string; // PENDING | IN_PROGRESS | COMPLETED
  created_at?: string | null;
}

export interface StudentLearningPathResponse {
  student_id: number;
  class_id: number;
  student_code?: string | null;
  student_name?: string | null;
  risk_level?: string | null;
  risk_score: number | null;
  total_recommendations: number;
  recommendations: LearningRecommendationItemSimple[];
  generated_at: string;
}

export interface StudentAnalyticsData {
  attendance: {
    overallRate: number;
    totalSessions: number;
    attendedSessions: number;
    lateSessions: number;
    absentSessions: number;
    weeklyTrend: { week: string; rate: number; attended: number; total: number }[];
    courseBreakdown: { courseCode: string; courseTitle: string; rate: number; attended: number; total: number; minRequired: number }[];
  };
  assignments: {
    completionRate: number;
    totalAssigned: number;
    completedCount: number;
    gradedCount: number;
    submittedCount: number;
    pendingCount: number;
    lateOrMissingCount: number;
    onTimeRate: number;
    submissionTrend: { name: string; score: number; weight: number; status: string; dueDate: string }[];
  };
  grades: {
    cumulativeGpa: number;
    overallPercentage: number;
    letterGrade: string;
    componentAverages: { component: string; studentScore: number; classAvg: number; weight: number }[];
    courseGrades: { courseCode: string; courseTitle: string; percentage: number; letter: string; gpa: number }[];
    historicalProgression: { term: string; gpa: number; avgPercentage: number }[];
  };
  quizzes: {
    overallAverage: number;
    quizzesTaken: number;
    totalQuizzes: number;
    records: StudentQuizRecord[];
    topicMastery: { topic: string; masteryPercent: number; questionsAnswered: number }[];
  };
  learningProgress: {
    overallProgressPct: number;
    activeStreakDays: number;
    studyHoursThisWeek: number;
    competenciesAchieved: number;
    totalCompetencies: number;
    courseProgressList: { courseCode: string; courseTitle: string; progressPercent: number; completedModules: number; totalModules: number; nextMilestone: string }[];
    weeklyActivityHours: { day: string; lecture: number; lab: number; selfStudy: number }[];
  };
}

export interface ClassAttendanceDistributionBucket {
  range: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface ClassGradeBucket {
  range: string;
  label: string;
  letter: string;
  count: number;
  percentage: number;
  color: string;
}

export interface LecturerAttentionStudent {
  id: string;
  studentId: string;
  name: string;
  email: string;
  avatarUrl: string;
  attendanceRate: number;
  currentGradePercent: number;
  letterGrade: string;
  missingAssignmentsCount: number;
  riskSeverity: 'high' | 'moderate' | 'critical';
  attentionTriggers: string[];
  suggestedAction: string;
  lastActive: string;
}
