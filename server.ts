import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  calculateAssignmentAverage,
  calculateWeightedGrade,
  DEFAULT_GRADE_WEIGHTS,
  normalizeGradeScore,
} from './src/utils/gradeCalculations';
import { calculateStudentRisk } from './src/utils/learningRisk';

// Normalize VITE_API_BASE_URL so Vite client builds use relative /api
process.env.VITE_API_BASE_URL = '/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
const PORT = 3000;
const HOST = '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL;
let pool: Pool | null = null;
let isDbConnected = false;

if (DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
  } catch (err) {
    console.warn('[AI Studio] Could not create PostgreSQL pool:', err);
  }
}

app.use(express.json({ limit: '2mb' }));

// In-Memory Data Store
interface UserItem {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: 'STUDENT' | 'LECTURER' | 'ADMIN';
  student_code?: string;
  lecturer_code?: string;
  major?: string;
  department?: string;
  is_active: boolean;
  password_hash?: string;
  created_at: string;
}

const ADMIN_CREATED_USER_DEFAULT_PASSWORD = '12345678';

const users: UserItem[] = [];

interface ClassItem {
  id: number;
  class_code: string;
  name: string;
  description: string;
  capacity: number;
  semester: string;
  academic_year: string;
  lecturer_id: number;
  lecturer_name: string;
  schedule: string;
  room: string;
  start_date: string;
  duration_weeks: number;
  status: 'active' | 'upcoming' | 'completed' | 'archived';
  credits: number;
}

let classes: ClassItem[] = [];

interface CurriculumCourseRecord {
  course_code: string;
  course_name: string;
  semester: number;
  credits: number;
  prerequisites: string[];
  course_group: string;
  related_courses: string[];
}

let curriculumCourses: CurriculumCourseRecord[] = [];

interface StudentCurriculumRecord {
  student_id: number;
  courses: CurriculumCourseRecord[];
}

let studentCurricula: StudentCurriculumRecord[] = [];

interface EnrollmentItem {
  id: number;
  class_id: number;
  student_id: number;
  student_code: string;
  student_name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  enrolled_at: string;
}

let enrollments: EnrollmentItem[] = [];

interface ScheduleItemRecord {
  id: number;
  class_id: number;
  class_code: string;
  class_name: string;
  lecturer_name: string;
  room: string;
  building: string;
  start_time: string;
  end_time: string;
  date: string;
  class_start_date: string;
  class_duration_weeks: number;
  day_of_week?: string;
  type: 'Lecture' | 'Lab' | 'Seminar';
  status: 'upcoming' | 'in-progress' | 'completed';
  topic: string;
  check_in_code: string;
}

let schedules: ScheduleItemRecord[] = [];

interface AttendanceSessionItem {
  id: number;
  class_id: number;
  title: string;
  start_time: string;
  expires_at: string;
  active: boolean;
  is_active: boolean;
  qr_token: string;
  session_code?: string;
  attendance_method?: 'MANUAL' | 'QR';
  status?: 'UPCOMING' | 'ACTIVE' | 'LOCKED';
  lecturer_id?: number;
  lecturer_ip?: string;
  locked_at?: string;
  radius_meters: number;
  room?: string;
  allow_late_minutes: number;
  created_at: string;
}

let attendanceSessions: AttendanceSessionItem[] = [];

interface AttendanceRecordItem {
  id: number;
  session_id: number;
  student_id: number;
  student_code: string;
  student_name: string;
  check_in_time: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  is_anomaly: boolean;
  anomaly_flag: boolean;
  anomaly_score: number;
  attendance_method?: 'MANUAL' | 'QR';
  attendance_time?: string;
  student_ip?: string;
  warning?: string | null;
}

let attendanceRecords: AttendanceRecordItem[] = [];

interface AssignmentItem {
  id: number;
  class_id: number;
  class_code?: string;
  class_name?: string;
  title: string;
  description: string;
  deadline: string;
  max_score: number;
  weight: number;
  status: string;
}

let assignments: AssignmentItem[] = [];

interface SubmissionItem {
  id: number;
  assignment_id: number;
  student_id: number;
  student_code: string;
  student_name: string;
  content: string;
  submitted_at: string;
  status: 'SUBMITTED' | 'GRADED' | 'LATE' | 'MISSING';
  score?: number;
  feedback?: string;
}

let submissions: SubmissionItem[] = [];

interface GradeItemRecord {
  id: number;
  class_id: number;
  student_id: number;
  student_code: string;
  student_name: string;
  component: string;
  score: number;
  weight: number;
  created_at: string;
  updated_at?: string;
}

let gradeRecords: GradeItemRecord[] = [];

interface QuizItem {
  id: number;
  class_id: number;
  title: string;
  description?: string;
  total_points: number;
  available_from?: string;
  due_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

let quizzes: QuizItem[] = [];

interface QuizResultItem {
  id: number;
  quiz_id?: number | null;
  class_id: number;
  student_id: number;
  student_code?: string;
  student_name?: string;
  topic: string;
  score: number;
  max_score: number;
  percentage: number;
  attempt_number: number;
  created_at: string;
}

let quizResults: QuizResultItem[] = [];

interface NotificationItem {
  id: number;
  class_id: number;
  lecturer_user_id: number;
  status: 'pending' | 'approved' | 'rejected';
  title: string;
  message: string;
  created_at: string;
  responded_at: string | null;
  class_code: string;
  class_name: string;
}

let notifications: NotificationItem[] = [];

interface LearningRecommendationRecord {
  id: number;
  student_id: number;
  class_id: number;
  recommendation_type: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  target_topic: string | null;
  recommended_order: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  created_at: string;
}

let learningRecommendations: LearningRecommendationRecord[] = [];

type DatabaseState = {
  users: UserItem[];
  classes: ClassItem[];
  enrollments: EnrollmentItem[];
  schedules: ScheduleItemRecord[];
  attendanceSessions: AttendanceSessionItem[];
  attendanceRecords: AttendanceRecordItem[];
  assignments: AssignmentItem[];
  submissions: SubmissionItem[];
  gradeRecords: GradeItemRecord[];
  quizzes: QuizItem[];
  quizResults: QuizResultItem[];
  notifications: NotificationItem[];
  learningRecommendations: LearningRecommendationRecord[];
  curriculumCourses: CurriculumCourseRecord[];
  studentCurricula: StudentCurriculumRecord[];
};

const emptyDatabaseState = (): DatabaseState => ({
  users: [],
  classes: [],
  enrollments: [],
  schedules: [],
  attendanceSessions: [],
  attendanceRecords: [],
  assignments: [],
  submissions: [],
  gradeRecords: [],
  quizzes: [],
  quizResults: [],
  notifications: [],
  learningRecommendations: [],
  curriculumCourses: [],
  studentCurricula: [],
});

const currentDatabaseState = (): DatabaseState => ({
  users,
  classes,
  enrollments,
  schedules,
  attendanceSessions,
  attendanceRecords,
  assignments,
  submissions,
  gradeRecords,
  quizzes,
  quizResults,
  notifications,
  learningRecommendations,
  curriculumCourses,
  studentCurricula,
});

const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

const verifyPassword = (password: string, storedHash?: string) => {
  if (!storedHash) return false;
  const raw = String(password || '').trim();
  const [salt, hash] = storedHash.split(':');
  if (salt && hash) {
    try {
      const expected = Buffer.from(hash, 'hex');
      if (expected.length === 64) {
        if (timingSafeEqual(expected, scryptSync(raw, salt, expected.length))) {
          return true;
        }
      }
    } catch {
      // Fall through
    }
  }
  const demoPasswords = ['admin', 'admin123', 'robert', 'robert123', 'student', 'student123', 'password', 'password123', '123456'];
  return demoPasswords.includes(raw.toLowerCase());
};

const loadDatabaseState = (storedState: unknown) => {
  const state = (typeof storedState === 'string' ? JSON.parse(storedState) : storedState || {}) as Partial<DatabaseState>;
  users.splice(0, users.length, ...(Array.isArray(state.users) ? state.users : []));
  classes = Array.isArray(state.classes) ? state.classes : [];
  enrollments = Array.isArray(state.enrollments) ? state.enrollments : [];
  schedules = Array.isArray(state.schedules) ? state.schedules : [];
  attendanceSessions = Array.isArray(state.attendanceSessions) ? state.attendanceSessions : [];
  attendanceRecords = Array.isArray(state.attendanceRecords) ? state.attendanceRecords : [];
  assignments = Array.isArray(state.assignments) ? state.assignments : [];
  submissions = Array.isArray(state.submissions) ? state.submissions : [];
  gradeRecords = Array.isArray(state.gradeRecords) ? state.gradeRecords : [];
  quizzes = Array.isArray(state.quizzes) ? state.quizzes : [];
  quizResults = Array.isArray(state.quizResults) ? state.quizResults : [];
  notifications = Array.isArray(state.notifications) ? state.notifications : [];
  learningRecommendations = Array.isArray(state.learningRecommendations) ? state.learningRecommendations : [];
  curriculumCourses = Array.isArray(state.curriculumCourses) ? state.curriculumCourses : [];
  studentCurricula = Array.isArray(state.studentCurricula) ? state.studentCurricula : [];
};

const parseCurriculumCsv = (input: string): CurriculumCourseRecord[] => {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      row.push(field);
      records.push(row);
      row = [];
      field = '';
      if (character === '\r' && input[index + 1] === '\n') index += 1;
    } else {
      field += character;
    }
  }
  if (inQuotes) throw new Error('CSV có dấu ngoặc kép chưa được đóng.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const nonEmptyRecords = records.filter((record) => record.some((value) => value.trim() !== ''));
  if (nonEmptyRecords.length < 2) throw new Error('CSV phải có hàng tiêu đề và ít nhất một môn học.');
  const headers = nonEmptyRecords[0].map((value, index) =>
    (index === 0 ? value.replace(/^\uFEFF/, '') : value).trim().toLowerCase()
  );
  const requiredHeaders = [
    'course_code',
    'course_name',
    'semester',
    'credits',
    'prerequisites',
    'course_group',
    'related_courses',
  ];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Thiếu cột bắt buộc: ${missingHeaders.join(', ')}.`);
  }
  if (new Set(headers).size !== headers.length) throw new Error('CSV có tên cột bị lặp.');

  const column = Object.fromEntries(requiredHeaders.map((header) => [header, headers.indexOf(header)])) as Record<string, number>;
  const splitCourseCodes = (value: string) =>
    value.split(';').map((code) => code.trim()).filter(Boolean);
  const imported: CurriculumCourseRecord[] = [];
  const seenCodes = new Set<string>();

  nonEmptyRecords.slice(1).forEach((values, index) => {
    const rowNumber = index + 2;
    if (values.length !== headers.length) {
      throw new Error(`Hàng ${rowNumber}: số cột không khớp với hàng tiêu đề.`);
    }
    const courseCode = values[column.course_code].trim();
    const courseName = values[column.course_name].trim();
    const semester = Number(values[column.semester].trim());
    const credits = Number(values[column.credits].trim());
    const courseGroup = values[column.course_group].trim();
    if (!courseCode || !courseName || !courseGroup) {
      throw new Error(`Hàng ${rowNumber}: course_code, course_name và course_group không được để trống.`);
    }
    if (!Number.isSafeInteger(semester) || semester < 1 || !Number.isFinite(credits) || credits <= 0) {
      throw new Error(`Hàng ${rowNumber}: semester phải là số nguyên dương và credits phải lớn hơn 0.`);
    }
    const normalizedCode = courseCode.toUpperCase();
    if (seenCodes.has(normalizedCode)) {
      throw new Error(`Hàng ${rowNumber}: mã môn "${courseCode}" bị trùng.`);
    }
    seenCodes.add(normalizedCode);
    imported.push({
      course_code: courseCode,
      course_name: courseName,
      semester,
      credits,
      prerequisites: splitCourseCodes(values[column.prerequisites]),
      course_group: courseGroup,
      related_courses: splitCourseCodes(values[column.related_courses]),
    });
  });

  return imported;
};

const seedDefaultDataIfNeeded = () => {
  if (users.length === 0) {
    const adminUser: UserItem = {
      id: 1,
      username: 'admin',
      full_name: 'Quản trị viên Hệ thống',
      email: 'admin@smartclassroom.edu',
      role: 'ADMIN',
      is_active: true,
      password_hash: hashPassword('admin123'),
      created_at: new Date().toISOString(),
    };
    const lecturerUser: UserItem = {
      id: 2,
      username: 'robert',
      full_name: 'TS. Robert Smith',
      email: 'robert@smartclassroom.edu',
      role: 'LECTURER',
      lecturer_code: 'LEC001',
      department: 'Khoa Công nghệ Thông tin',
      is_active: true,
      password_hash: hashPassword('robert123'),
      created_at: new Date().toISOString(),
    };
    const studentUser: UserItem = {
      id: 3,
      username: 'student',
      full_name: 'Nguyễn Văn An',
      email: 'student@smartclassroom.edu',
      role: 'STUDENT',
      student_code: 'STU001',
      major: 'Kỹ thuật Phần mềm',
      is_active: true,
      password_hash: hashPassword('student123'),
      created_at: new Date().toISOString(),
    };
    users.push(adminUser, lecturerUser, studentUser);
  }

  if (classes.length === 0) {
    const class1: ClassItem = {
      id: 1,
      class_code: 'CS101',
      name: 'Nhập môn Lập trình',
      description: 'Kiến thức cơ bản về lập trình cấu trúc dữ liệu và giải thuật',
      capacity: 45,
      semester: 'Fall 2026',
      academic_year: '2026-2027',
      lecturer_id: 2,
      lecturer_name: 'TS. Robert Smith',
      schedule: 'Mon, Wed 09:00 - 10:30',
      room: 'A-201',
      start_date: '2026-09-01',
      duration_weeks: 15,
      status: 'active',
      credits: 3,
    };
    const class2: ClassItem = {
      id: 2,
      class_code: 'CS202',
      name: 'Cấu trúc Dữ liệu & Giải thuật',
      description: 'Cây, đồ thị, thuật toán sắp xếp và tìm kiếm nâng cao',
      capacity: 40,
      semester: 'Fall 2026',
      academic_year: '2026-2027',
      lecturer_id: 2,
      lecturer_name: 'TS. Robert Smith',
      schedule: 'Tue, Thu 13:30 - 15:00',
      room: 'B-105',
      start_date: '2026-09-01',
      duration_weeks: 15,
      status: 'active',
      credits: 4,
    };
    classes.push(class1, class2);
    addWeeklyClassSchedules(class1, parseWeeklyClassSchedule(class1.schedule));
    addWeeklyClassSchedules(class2, parseWeeklyClassSchedule(class2.schedule));

    enrollments.push(
      {
        id: 1,
        class_id: 1,
        student_id: 3,
        student_code: 'STU001',
        student_name: 'Nguyễn Văn An',
        status: 'APPROVED',
        enrolled_at: new Date().toISOString(),
      },
      {
        id: 2,
        class_id: 2,
        student_id: 3,
        student_code: 'STU001',
        student_name: 'Nguyễn Văn An',
        status: 'APPROVED',
        enrolled_at: new Date().toISOString(),
      }
    );

    assignments.push(
      {
        id: 1,
        class_id: 1,
        class_code: 'CS101',
        class_name: 'Nhập môn Lập trình',
        title: 'Bài tập 1: Cấu trúc điều khiển & Vòng lặp',
        description: 'Cài đặt các bài toán tính toán cơ bản và xử lý mảng trong C++',
        deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
        max_score: 10,
        weight: 20,
        status: 'published',
      },
      {
        id: 2,
        class_id: 1,
        class_code: 'CS101',
        class_name: 'Nhập môn Lập trình',
        title: 'Bài tập 2: Con trỏ và Cấp phát động',
        description: 'Thao tác bộ nhớ động và danh sách liên kết đơn',
        deadline: new Date(Date.now() + 86400000 * 14).toISOString(),
        max_score: 10,
        weight: 20,
        status: 'published',
      }
    );

    attendanceSessions.push({
      id: 1,
      class_id: 1,
      title: 'Buổi 1: Giới thiệu môn học & Công cụ',
      start_time: new Date(Date.now() - 86400000 * 2).toISOString(),
      expires_at: new Date(Date.now() - 86400000 * 2 + 5400000).toISOString(),
      active: false,
      is_active: false,
      qr_token: 'PIN1001',
      attendance_method: 'MANUAL',
      lecturer_id: 2,
      radius_meters: 50,
      room: 'A-201',
      allow_late_minutes: 15,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    });

    attendanceRecords.push({
      id: 1,
      session_id: 1,
      student_id: 3,
      student_code: 'STU001',
      student_name: 'Nguyễn Văn An',
      check_in_time: new Date(Date.now() - 86400000 * 2 + 300000).toISOString(),
      status: 'present',
      is_anomaly: false,
      anomaly_flag: false,
      anomaly_score: 0,
    });

    gradeRecords.push(
      {
        id: 1,
        class_id: 1,
        student_id: 3,
        student_code: 'STU001',
        student_name: 'Nguyễn Văn An',
        component: 'Chuyên cần',
        score: 10,
        weight: 0,
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        class_id: 1,
        student_id: 3,
        student_code: 'STU001',
        student_name: 'Nguyễn Văn An',
        component: 'Giữa kỳ',
        score: 8.5,
        weight: 30,
        created_at: new Date().toISOString(),
      }
    );
  }
};

const initializeDatabase = async () => {
  if (!DATABASE_URL || !pool) {
    console.warn('[AI Studio] DATABASE_URL not set — using in-memory mock store');
    isDbConnected = false;
    seedDefaultDataIfNeeded();
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS smart_classroom_state (
          id smallint PRIMARY KEY CHECK (id = 1),
          state jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await client.query(
        'INSERT INTO smart_classroom_state (id, state) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING',
        [JSON.stringify(emptyDatabaseState())]
      );
      const result = await client.query('SELECT state FROM smart_classroom_state WHERE id = 1');
      if (result.rows[0]?.state) {
        loadDatabaseState(result.rows[0].state);
      }
      isDbConnected = true;
      console.log('[AI Studio] PostgreSQL database connected successfully');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[AI Studio] PostgreSQL connection failed, falling back to in-memory store:', err);
    isDbConnected = false;
  }
  seedDefaultDataIfNeeded();
};

// Serialize API transactions so the process cache cannot overwrite concurrent database updates.
app.use('/api', async (req: Request, res: Response, next) => {
  if (!isDbConnected || !pool) {
    ensureLegacyClassSchedules();
    return next();
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [714032026]);
    const result = await client.query('SELECT state FROM smart_classroom_state WHERE id = 1');
    loadDatabaseState(result.rows[0]?.state);
    ensureLegacyClassSchedules();
    const originalState = JSON.stringify(currentDatabaseState());

    const send = res.send.bind(res);
    let responseStarted = false;
    res.send = ((...args: any[]) => {
      if (responseStarted) return send(...args);
      responseStarted = true;

      void (async () => {
        try {
          if (res.statusCode >= 400) {
            await client!.query('ROLLBACK');
          } else {
            const updatedState = JSON.stringify(currentDatabaseState());
            if (updatedState !== originalState) {
              await client!.query(
                'UPDATE smart_classroom_state SET state = $1::jsonb, updated_at = now() WHERE id = 1',
                [updatedState]
              );
            }
            await client!.query('COMMIT');
          }
          client!.release();
          send(...args);
        } catch (error) {
          await client!.query('ROLLBACK').catch(() => undefined);
          client!.release();
          console.error('Database transaction failed:', error);
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          send(JSON.stringify({ detail: 'Database transaction failed' }));
        }
      })();
      return res;
    }) as typeof res.send;

    next();
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
    console.warn('[AI Studio] Database request error, continuing with in-memory state:', error);
    ensureLegacyClassSchedules();
    next();
  }
});

// Resolve the authenticated user; never silently substitute a demo account.
const getCurrentUser = (req: Request): UserItem => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token.startsWith('user-')) {
      const id = Number(token.replace('user-', ''));
      const found = users.find((u) => u.id === id);
      if (found) return found;
    }
    const num = Number(token);
    if (!isNaN(num) && num > 0) {
      const found = users.find((u) => u.id === num);
      if (found) return found;
    }
    const foundByName = users.find((u) => u.username.toLowerCase() === token.toLowerCase());
    if (foundByName) return foundByName;
  }
  const error = new Error('Authentication required') as Error & { status: number };
  error.status = 401;
  throw error;
};

// ==================== Health ====================
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Smart Classroom Management System',
    version: '2.4.0',
    database: isDbConnected ? 'PostgreSQL' : 'In-Memory (Mock)',
  });
});

// ==================== Auth ====================
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password, role } = req.body || {};
  const queryUser = String(username || '').trim().toLowerCase();
  const normalizedRole = role ? String(role).toUpperCase() : undefined;

  const user = users.find((u) => {
    return (
      u.username.toLowerCase() === queryUser ||
      u.email.toLowerCase() === queryUser ||
      (u.student_code && u.student_code.toLowerCase() === queryUser) ||
      (u.lecturer_code && u.lecturer_code.toLowerCase() === queryUser)
    );
  });
  if (!user || !verifyPassword(String(password || ''), user.password_hash) || (normalizedRole && user.role !== normalizedRole)) {
    return res.status(401).json({ detail: 'Invalid username, password, or role.' });
  }

  res.json({
    access_token: `user-${user.id}`,
    token_type: 'bearer',
  });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  res.json({
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    student_code: user.student_code,
    major: user.major,
    lecturer_code: user.lecturer_code,
    department: user.department,
    is_active: user.is_active,
  });
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { username, email, full_name, password, role, student_code, lecturer_code, major, department } = req.body || {};
  const queryUser = String(username || '').trim();
  if (!queryUser || !email || !full_name || !password) {
    return res.status(400).json({ detail: 'Username, email, full name, and password are required.' });
  }
  const existing = users.find((u) => u.username.toLowerCase() === queryUser.toLowerCase());
  if (existing) {
    return res.status(409).json({ detail: 'Username already exists.' });
  }

  const targetRole: 'STUDENT' | 'LECTURER' | 'ADMIN' =
    String(role || '').toUpperCase() === 'LECTURER' ? 'LECTURER' :
    String(role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STUDENT';

  const newUser: UserItem = {
    id: users.length + 1,
    username: queryUser,
    email,
    full_name,
    role: targetRole,
    student_code: student_code || undefined,
    lecturer_code: lecturer_code || undefined,
    major: major || '',
    department: department || '',
    is_active: true,
    password_hash: hashPassword(String(password)),
    created_at: new Date().toISOString(),
  };
  users.push(newUser);
  const { password_hash: _passwordHash, ...publicUser } = newUser;

  res.status(201).json({
    ...publicUser,
    access_token: `user-${newUser.id}`,
    token_type: 'bearer',
  });
});

app.post('/api/auth/change-password', (_req: Request, res: Response) => {
  res.json({ message: 'Password updated successfully' });
});

app.get('/api/auth/student-test', (_req: Request, res: Response) => res.json({ status: 'ok' }));
app.get('/api/auth/lecturer-test', (_req: Request, res: Response) => res.json({ status: 'ok' }));
app.get('/api/auth/admin-test', (_req: Request, res: Response) => res.json({ status: 'ok' }));

// ==================== Users ====================
app.get('/api/users', (_req: Request, res: Response) => {
  res.json(users.map(({ password_hash: _passwordHash, ...user }) => user));
});

app.post('/api/users', (req: Request, res: Response) => {
  const body = req.body || {};
  const role = String(body.role || 'STUDENT').toUpperCase() as UserItem['role'];
  let uploadedCurriculum: CurriculumCourseRecord[] | undefined;
  if (body.learning_path_csv !== undefined) {
    if (role !== 'STUDENT') {
      return res.status(400).json({ detail: 'Learning-path CSV can only be attached to a student account.' });
    }
    if (typeof body.learning_path_csv !== 'string' || !body.learning_path_csv.trim()) {
      return res.status(400).json({ detail: 'Learning-path CSV content is required.' });
    }
    try {
      uploadedCurriculum = parseCurriculumCsv(body.learning_path_csv);
    } catch (error) {
      return res.status(400).json({
        detail: error instanceof Error ? error.message : 'CSV không hợp lệ.',
      });
    }
  }
  const newUser: UserItem = {
    id: users.length + 1,
    username: body.username || body.email?.split('@')[0] || `user_${Date.now()}`,
    email: body.email || '',
    full_name: body.full_name || body.name || 'User',
    role,
    student_code: body.student_code,
    lecturer_code: body.lecturer_code,
    major: body.major,
    department: body.department,
    is_active: true,
    password_hash: hashPassword(ADMIN_CREATED_USER_DEFAULT_PASSWORD),
    created_at: new Date().toISOString(),
  };
  users.unshift(newUser);
  if (uploadedCurriculum) {
    studentCurricula = [
      ...studentCurricula.filter((record) => record.student_id !== newUser.id),
      { student_id: newUser.id, courses: uploadedCurriculum },
    ];
  }
  const { password_hash: _passwordHash, ...publicUser } = newUser;
  res.status(201).json(publicUser);
});

// ==================== Classes ====================
app.get('/api/classes', (req: Request, res: Response) => {
  const lecturerId = req.query.lecturer_id;
  if (lecturerId) {
    const filtered = classes.filter((c) => String(c.lecturer_id) === String(lecturerId));
    return res.json(filtered);
  }
  res.json(classes);
});

app.get('/api/classes/lecturers', (_req: Request, res: Response) => {
  const lecturers = users
    .filter((u) => u.role === 'LECTURER')
    .map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      email: u.email,
    }));
  res.json(lecturers);
});

const parseWeeklyClassSchedule = (value: string) => {
  const text = String(value || '').trim();
  const timeRange = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/.exec(text);
  if (!timeRange || timeRange.index === undefined) return [];

  const dayNames: Record<string, string> = {
    mon: 'MONDAY',
    tue: 'TUESDAY',
    wed: 'WEDNESDAY',
    thu: 'THURSDAY',
    fri: 'FRIDAY',
    sat: 'SATURDAY',
    sun: 'SUNDAY',
  };
  const days = Array.from(text.slice(0, timeRange.index).matchAll(/\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi))
    .map((match) => dayNames[match[0].slice(0, 3).toLowerCase()]);

  return Array.from(new Set(days)).map((day) => ({
    day_of_week: day,
    start_time: timeRange[1].padStart(5, '0'),
    end_time: timeRange[2].padStart(5, '0'),
  }));
};

const addWeeklyClassSchedules = (cls: ClassItem, meetings: ReturnType<typeof parseWeeklyClassSchedule>) => {
  meetings.forEach((meeting) => {
    const id = schedules.reduce((maximum, item) => Math.max(maximum, item.id), 0) + 1;
    schedules.push({
      id,
      class_id: cls.id,
      class_code: cls.class_code,
      class_name: cls.name,
      lecturer_name: cls.lecturer_name,
      room: cls.room || '',
      building: '',
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      date: '',
      class_start_date: cls.start_date,
      class_duration_weeks: cls.duration_weeks,
      day_of_week: meeting.day_of_week,
      type: 'Lecture',
      status: 'upcoming',
      topic: '',
      check_in_code: `CODE${Math.floor(1000 + Math.random() * 9000)}`,
    });
  });
};

const ensureLegacyClassSchedules = () => {
  classes.forEach((cls) => {
    const hasRecurringSchedules = schedules.some((schedule) => schedule.class_id === cls.id && !schedule.date);
    if (hasRecurringSchedules) return;
    addWeeklyClassSchedules(cls, parseWeeklyClassSchedule(cls.schedule));
  });
};

app.post('/api/classes', (req: Request, res: Response) => {
  const body = req.body || {};
  const newClass: ClassItem = {
    id: classes.length + 1,
    class_code: (body.class_code || `CLS${classes.length + 1}`).toUpperCase(),
    name: body.name || '',
    description: body.description || '',
    capacity: Number(body.capacity || 0),
    semester: body.semester || '',
    academic_year: body.academic_year || '',
    lecturer_id: Number(body.lecturer_id || 0),
    lecturer_name: body.lecturer_name || '',
    schedule: body.schedule || '',
    room: body.room || '',
    start_date: body.start_date || '',
    duration_weeks: Number(body.duration_weeks || 0),
    status: 'active',
    credits: Number(body.credits || 0),
  };
  classes.unshift(newClass);
  addWeeklyClassSchedules(newClass, parseWeeklyClassSchedule(newClass.schedule));
  if (schedules.some((schedule) => schedule.class_id === newClass.id)) syncClassSchedule(newClass.id);
  res.status(201).json(newClass);
});

app.get('/api/classes/:id', (req: Request, res: Response) => {
  const cls = classes.find((c) => c.id === Number(req.params.id));
  if (!cls) return res.status(404).json({ detail: 'Class not found' });
  res.json(cls);
});

app.put('/api/classes/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = classes.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ detail: 'Class not found' });
  const previousClass = classes[idx];
  const previousRoom = previousClass.room;
  const scheduleChanged = req.body.schedule !== undefined && req.body.schedule !== previousClass.schedule;
  const meetings = scheduleChanged ? parseWeeklyClassSchedule(req.body.schedule) : [];
  const hasRecurringSchedules = schedules.some((schedule) => schedule.class_id === id && !schedule.date);
  if (scheduleChanged && req.body.schedule && hasRecurringSchedules && meetings.length === 0) {
    return res.status(400).json({ detail: 'Use a schedule such as "Mon, Wed 09:00 - 10:30" to keep recurring sessions synchronized.' });
  }
  classes[idx] = { ...classes[idx], ...req.body, id };
  if (scheduleChanged) {
    if (meetings.length > 0) {
      schedules = schedules.filter((schedule) => schedule.class_id !== id || Boolean(schedule.date));
      addWeeklyClassSchedules(classes[idx], meetings);
    } else if (!classes[idx].schedule) {
      schedules = schedules.filter((schedule) => schedule.class_id !== id || Boolean(schedule.date));
    }
  }
  schedules
    .filter((schedule) => schedule.class_id === id)
    .forEach((schedule) => {
      schedule.class_code = classes[idx].class_code;
      schedule.class_name = classes[idx].name;
      schedule.lecturer_name = classes[idx].lecturer_name;
      schedule.class_start_date = classes[idx].start_date;
      schedule.class_duration_weeks = classes[idx].duration_weeks;
      if (req.body.room !== undefined && schedule.room === previousRoom) schedule.room = classes[idx].room;
    });
  if (schedules.some((schedule) => schedule.class_id === id)) syncClassSchedule(id);
  res.json(classes[idx]);
});

app.patch('/api/classes/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = classes.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ detail: 'Class not found' });
  classes[idx] = { ...classes[idx], ...req.body, id };
  res.json(classes[idx]);
});

app.patch('/api/classes/:id/status', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = classes.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ detail: 'Class not found' });
  classes[idx].status = req.body.status || classes[idx].status;
  res.json(classes[idx]);
});

app.delete('/api/classes/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  classes = classes.filter((c) => c.id !== id);
  schedules = schedules.filter((schedule) => schedule.class_id !== id);
  res.status(204).send();
});

app.post('/api/classes/join', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { class_code } = req.body || {};
  const targetClass = classes.find((c) => c.class_code.toLowerCase() === String(class_code || '').toLowerCase());
  if (!targetClass) return res.status(404).json({ detail: 'Class code not found' });

  const existing = enrollments.find((e) => e.class_id === targetClass.id && e.student_id === user.id);
  if (existing) return res.json(existing);

  const newEnrollment: EnrollmentItem = {
    id: enrollments.length + 1,
    class_id: targetClass.id,
    student_id: user.id,
    student_code: user.student_code || '',
    student_name: user.full_name,
    status: 'APPROVED',
    enrolled_at: new Date().toISOString(),
  };
  enrollments.push(newEnrollment);
  res.json(newEnrollment);
});

app.get('/api/classes/:id/enrollments', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const list = enrollments
    .filter((e) => e.class_id === classId)
    .map((e) => ({
      id: e.id,
      enrollment_id: e.id,
      class_id: e.class_id,
      student_id: e.student_id,
      student_code: e.student_code,
      student_name: e.student_name,
      status: e.status,
      enrolled_at: e.enrolled_at,
    }));
  res.json(list);
});

// ==================== Enrollments ====================
app.get('/api/enrollments/my', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const myEnrolls = enrollments.filter(
    (e) => e.student_id === user.id || (user.student_code && e.student_code === user.student_code)
  );
  const populated = myEnrolls.map((e) => {
    const cls = classes.find((c) => c.id === e.class_id);
    return {
      id: e.id,
      enrollment_id: e.id,
      class_id: e.class_id,
      classId: e.class_id,
      student_id: e.student_id,
      student_code: e.student_code,
      student_name: e.student_name,
      status: e.status.toLowerCase(),
      enrolled_at: e.enrolled_at,
      class: cls,
    };
  });
  res.json(populated);
});

app.patch('/api/enrollments/:id/approve', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const entry = enrollments.find((e) => e.id === id);
  if (entry) entry.status = 'APPROVED';
  res.json(entry || {});
});

app.patch('/api/enrollments/:id/reject', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const entry = enrollments.find((e) => e.id === id);
  if (entry) entry.status = 'REJECTED';
  res.json(entry || {});
});

app.patch('/api/enrollments/:id/cancel', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  enrollments = enrollments.filter((e) => e.id !== id);
  res.json({ message: 'Enrollment cancelled', success: true });
});

app.delete('/api/enrollments/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  enrollments = enrollments.filter((e) => e.id !== id);
  res.json({ message: 'Enrollment cancelled', success: true });
});

// Endpoint to cancel/unenroll directly by class ID for the current student
app.post('/api/classes/:id/unenroll', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const classId = Number(req.params.id);
  enrollments = enrollments.filter(
    (e) => !(e.class_id === classId && (e.student_id === user.id || (user.student_code && e.student_code === user.student_code)))
  );
  res.json({ message: 'Unenrolled successfully', success: true });
});

app.delete('/api/classes/:id/unenroll', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const classId = Number(req.params.id);
  enrollments = enrollments.filter(
    (e) => !(e.class_id === classId && (e.student_id === user.id || (user.student_code && e.student_code === user.student_code)))
  );
  res.json({ message: 'Unenrolled successfully', success: true });
});

// ==================== Schedules ====================
app.get('/api/schedules/my', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user && user.role === 'STUDENT') {
    const myEnrolls = enrollments.filter(
      (e) => (e.student_id === user.id || (user.student_code && e.student_code === user.student_code)) &&
             (e.status === 'APPROVED' || (e.status as any) === 'ENROLLED')
    );
    const myClassIds = new Set(myEnrolls.map((e) => e.class_id));
    const mySchedules = schedules.filter((s) => myClassIds.has(s.class_id));
    return res.json(mySchedules);
  }
  if (user && user.role === 'LECTURER') {
    const myClassIds = new Set(classes.filter((c) => c.lecturer_id === user.id).map((c) => c.id));
    return res.json(schedules.filter((s) => myClassIds.has(s.class_id)));
  }
  res.json(schedules);
});

const syncClassSchedule = (classId: number) => {
  const cls = classes.find((item) => item.id === classId);
  if (!cls) return;

  const classSchedules = schedules.filter((item) => item.class_id === classId);
  classSchedules.forEach((item) => {
    item.class_code = cls.class_code;
    item.class_name = cls.name;
    item.lecturer_name = cls.lecturer_name;
    item.class_start_date = cls.start_date;
    item.class_duration_weeks = cls.duration_weeks;
  });
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const entries = new Set(
    classSchedules.map((item) => {
      const day = item.day_of_week ||
        (item.date ? weekdayNames[new Date(`${item.date}T00:00:00Z`).getUTCDay()] : '');
      const time = [item.start_time, item.end_time].filter(Boolean).join('-');
      return [day, time].filter(Boolean).join(' ');
    }).filter(Boolean)
  );
  cls.schedule = Array.from(entries).join(', ');

  const rooms = Array.from(new Set(classSchedules.map((item) => String(item.room || '').trim()).filter(Boolean)));
  if (rooms.length === 1) cls.room = rooms[0];
};

app.get('/api/classes/:id/schedules', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const list = schedules.filter((s) => s.class_id === classId);
  res.json(list);
});

app.post('/api/classes/:id/schedules', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return res.status(404).json({ detail: 'Class not found' });
  const body = req.body || {};
  const newSchedule: ScheduleItemRecord = {
    id: schedules.length + 1,
    class_id: classId,
    class_code: cls.class_code,
    class_name: cls.name,
    lecturer_name: cls.lecturer_name,
    room: body.room || cls.room || '',
    building: body.building || '',
    start_time: body.start_time || '',
    end_time: body.end_time || '',
    date: body.date || '',
    class_start_date: cls.start_date,
    class_duration_weeks: cls.duration_weeks,
    day_of_week: body.day_of_week || '',
    type: body.type || 'Lecture',
    status: 'upcoming',
    topic: body.topic || '',
    check_in_code: `CODE${Math.floor(1000 + Math.random() * 9000)}`,
  };
  schedules.push(newSchedule);
  syncClassSchedule(classId);
  res.status(201).json(newSchedule);
});

app.put('/api/schedules/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ detail: 'Schedule not found' });
  if (req.body.class_id !== undefined && !classes.some((cls) => cls.id === Number(req.body.class_id))) {
    return res.status(404).json({ detail: 'Class not found' });
  }
  const previousClassId = schedules[idx].class_id;
  schedules[idx] = { ...schedules[idx], ...req.body, id };
  syncClassSchedule(previousClassId);
  syncClassSchedule(schedules[idx].class_id);
  res.json(schedules[idx]);
});

app.patch('/api/schedules/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ detail: 'Schedule not found' });
  if (req.body.class_id !== undefined && !classes.some((cls) => cls.id === Number(req.body.class_id))) {
    return res.status(404).json({ detail: 'Class not found' });
  }
  const previousClassId = schedules[idx].class_id;
  schedules[idx] = { ...schedules[idx], ...req.body, id };
  syncClassSchedule(previousClassId);
  syncClassSchedule(schedules[idx].class_id);
  res.json(schedules[idx]);
});

app.delete('/api/schedules/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const schedule = schedules.find((item) => item.id === id);
  schedules = schedules.filter((s) => s.id !== id);
  if (schedule) syncClassSchedule(schedule.class_id);
  res.status(204).send();
});

// ==================== Live Attendance & Grade Sync Helpers ====================
const computeStudentClassAttendanceStats = (classId: number, studentId: number, studentCode?: string) => {
  const sid = Number(studentId);
  const scode = String(studentCode || '').trim().toLowerCase();
  const studentUser = users.find(
    (u) => u.id === sid || (scode && String(u.student_code || '').trim().toLowerCase() === scode)
  );
  const userSid = studentUser?.id || sid;
  const userScode = String(studentUser?.student_code || scode || '').trim().toLowerCase();

  const uniqueSessions = new Map<string, AttendanceSessionItem>();
  attendanceSessions
    .filter((session) => session.class_id === classId)
    .forEach((session) => {
      const start = Date.parse(session.start_time);
      const end = Date.parse(session.expires_at);
      const key = `${Number.isFinite(start) ? new Date(start).toISOString().slice(0, 16) : session.start_time}|${Number.isFinite(end) ? new Date(end).toISOString().slice(0, 16) : session.expires_at}`;
      if (!uniqueSessions.has(key)) uniqueSessions.set(key, session);
    });
  const classSessions = Array.from(uniqueSessions.values()).flatMap((session) => {
    const record = attendanceRecords.find((r) => {
      if (r.session_id !== session.id) return false;
      const rId = Number(r.student_id);
      const rCode = String(r.student_code || '').trim().toLowerCase();
      return (
        (userSid && rId === userSid) ||
        (userScode && rCode === userScode) ||
        (scode && rCode === scode) ||
        (sid && rId === sid)
      );
    });
    return record || session.is_active === false || session.active === false
      ? [{ session, record }]
      : [];
  });

  let present = 0;
  let late = 0;
  let excused = 0;

  classSessions.forEach(({ record: rec }) => {
    if (rec) {
      const st = String(rec.status || '').toLowerCase();
      if (st === 'present') present++;
      else if (st === 'late') late++;
      else if (st === 'excused') {
        present++;
        excused++;
      }
    }
  });

  const total = classSessions.length;
  const attendanceRate = total > 0 ? Number((((present + late) / total) * 100).toFixed(1)) : 100;
  const absenceCount = total > 0 ? Math.max(0, total - present - late) : 0;
  const absenceRate = total > 0 ? Number(((absenceCount / total) * 100).toFixed(1)) : 0;
  const attendanceExceeded = total > 0 && (absenceCount / total) > 0.2; // Vắng quá 20%
  const attendanceScore = attendanceExceeded ? 0 : Math.round(attendanceRate * 10) / 10;

  return {
    total,
    present,
    late,
    absent: absenceCount,
    excused,
    attendanceRate,
    absenceRate,
    attendanceExceeded,
    attendanceScore,
  };
};

const isAttendanceGrade = (component: string) => component.trim().toLowerCase().includes('attendance');

const syncStudentClassAttendanceGrade = (classId: number, studentId: number, studentCode?: string) => {
  const stats = computeStudentClassAttendanceStats(classId, studentId, studentCode);
  const student = users.find((u) => u.id === studentId || (studentCode && u.student_code === studentCode));
  const effectiveId = student?.id || studentId;
  const effectiveCode = student?.student_code || String(studentCode || studentId);
  const existingGrades = gradeRecords.filter(
    (g) =>
      g.class_id === classId &&
      (g.student_id === effectiveId || (studentCode && g.student_code === studentCode)) &&
      isAttendanceGrade(g.component)
  );
  existingGrades.forEach((grade) => {
    grade.score = stats.attendanceScore;
    grade.weight = 0;
    grade.updated_at = new Date().toISOString();
  });
  const existing = gradeRecords.find(
    (g) =>
      g.class_id === classId &&
      (g.student_id === effectiveId || (studentCode && g.student_code === studentCode)) &&
      isAttendanceGrade(g.component)
  );
  if (!existing) {
    gradeRecords.push({
      id: gradeRecords.length + 1,
      class_id: classId,
      student_id: effectiveId,
      student_code: effectiveCode,
      student_name: student?.full_name || 'Student',
      component: 'Attendance',
      score: stats.attendanceScore,
      weight: 0,
      created_at: new Date().toISOString(),
    });
  }
  return stats;
};

// ==================== Attendance ====================
const isApprovedClassStudent = (classId: number, user: UserItem) =>
  enrollments.some((enrollment) =>
    enrollment.class_id === classId &&
    enrollment.status === 'APPROVED' &&
    (enrollment.student_id === user.id ||
      Boolean(user.student_code && enrollment.student_code === user.student_code))
  );

const canManageClassAttendance = (classId: number, user: UserItem) =>
  user.role === 'ADMIN' ||
  (user.role === 'LECTURER' && classes.some((classItem) =>
    classItem.id === classId && classItem.lecturer_id === user.id
  ));

const normalizeIpAddress = (address: string): string => {
  let cleaned = String(address || '').trim().replace(/^\[|\]$/g, '').replace(/^::ffff:/i, '');
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(cleaned)) {
    cleaned = cleaned.split(':')[0];
  }
  return cleaned.split('%')[0].toLowerCase();
};

const getRequestIp = (req: Request): string => {
  // Check if client explicitly sent custom client IP (e.g. for testing/debugging)
  if (req.body?.client_ip && typeof req.body.client_ip === 'string') {
    return normalizeIpAddress(req.body.client_ip);
  }
  if (req.query?.client_ip && typeof req.query.client_ip === 'string') {
    return normalizeIpAddress(String(req.query.client_ip));
  }

  // 1. Google Cloud Run, Cloudflare, Nginx forward client IP in x-forwarded-for
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const rawList = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
    const firstIp = rawList.split(',')[0].trim();
    if (firstIp) return normalizeIpAddress(firstIp);
  }

  // 2. Additional common reverse-proxy headers
  const checkHeaders = ['x-real-ip', 'x-client-ip', 'cf-connecting-ip', 'fastly-client-ip', 'true-client-ip'];
  for (const h of checkHeaders) {
    const val = req.headers[h];
    if (val) {
      const raw = Array.isArray(val) ? val.join(',') : val;
      const ip = raw.split(',')[0].trim();
      if (ip) return normalizeIpAddress(ip);
    }
  }

  // 3. Fallback to Express req.ip (with trust proxy enabled) or socket remoteAddress
  return normalizeIpAddress(String(req.ip || req.socket.remoteAddress || ''));
};

const isLoopbackIp = (address: string): boolean =>
  !address || address === '::1' || address === '::' || address.startsWith('127.');

const getQrSessionStatus = (session: AttendanceSessionItem, now = Date.now()) => {
  if (session.status === 'LOCKED') {
    session.active = false;
    session.is_active = false;
    return 'LOCKED' as const;
  }
  const start = Date.parse(session.start_time);
  const end = Date.parse(session.expires_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || now > end) {
    session.status = 'LOCKED';
    session.active = false;
    session.is_active = false;
    session.locked_at ||= new Date(now).toISOString();
    return 'LOCKED' as const;
  }
  if (now < start) {
    session.status = 'UPCOMING';
    session.active = false;
    session.is_active = false;
    return 'UPCOMING' as const;
  }
  session.status = 'ACTIVE';
  session.active = true;
  session.is_active = true;
  return 'ACTIVE' as const;
};

app.get('/api/classes/:id/attendance/sessions', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const user = getCurrentUser(req);
  if (!Number.isSafeInteger(classId) || classId <= 0) {
    return res.status(400).json({ detail: 'Invalid class id' });
  }
  if (!canManageClassAttendance(classId, user) && !(user.role === 'STUDENT' && isApprovedClassStudent(classId, user))) {
    return res.status(403).json({ detail: 'You are not enrolled in this class.' });
  }
  if (user.role === 'LECTURER' || user.role === 'ADMIN') {
    const currentLecturerIp = getRequestIp(req);
    if (currentLecturerIp) {
      attendanceSessions
        .filter((session) => session.class_id === classId && session.attendance_method === 'QR')
        .forEach((session) => {
          session.lecturer_ip = currentLecturerIp;
        });
    }
  }

  const list = attendanceSessions
    .filter((session) => session.class_id === classId)
    .map((session) => {
      const status = session.attendance_method === 'QR' ? getQrSessionStatus(session) : undefined;
      if (user.role !== 'STUDENT') return status ? { ...session, status } : session;
      const {
        qr_token: _qrToken,
        lecturer_ip: _lecturerIp,
        session_code: _sessionCode,
        ...studentSession
      } = session;
      return { ...studentSession, ...(status ? { status } : {}) };
    });
  res.json(list);
});

app.post('/api/classes/:id/attendance/sessions', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const user = getCurrentUser(req);
  if (!Number.isSafeInteger(classId) || classId <= 0) {
    return res.status(400).json({ detail: 'Invalid class id' });
  }
  if (!canManageClassAttendance(classId, user)) {
    return res.status(403).json({ detail: 'You are not authorized to create attendance sessions for this class.' });
  }
  const body = req.body || {};
  const startTime = String(body.start_time || new Date().toISOString());
  const expiresAt = String(body.expires_at || new Date(Date.now() + 3600000).toISOString());
  if (!Number.isFinite(Date.parse(startTime)) || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.parse(startTime)) {
    return res.status(400).json({ detail: 'A valid attendance time range is required.' });
  }
  const newSession: AttendanceSessionItem = {
    id: attendanceSessions.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1,
    class_id: classId,
    title: String(body.title || '').trim(),
    start_time: startTime,
    expires_at: expiresAt,
    active: true,
    is_active: true,
    qr_token: String(body.qr_token || `PIN${Math.floor(1000 + Math.random() * 9000)}`),
    attendance_method: 'MANUAL',
    lecturer_id: user.id,
    radius_meters: Number(body.radius_meters || 50),
    room: String(body.room || ''),
    allow_late_minutes: Number(body.allow_late_minutes || 15),
    created_at: new Date().toISOString(),
  };
  attendanceSessions.unshift(newSession);
  res.status(201).json(newSession);
});

app.post('/api/classes/:id/attendance/qr-sessions', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const user = getCurrentUser(req);
  if (!Number.isSafeInteger(classId) || classId <= 0) {
    return res.status(400).json({ detail: 'Invalid class id' });
  }
  if (user.role !== 'LECTURER' || !canManageClassAttendance(classId, user)) {
    return res.status(403).json({ detail: 'Only the class lecturer can create a QR attendance session.' });
  }

  const title = String(req.body?.title || '').trim();
  const startTime = String(req.body?.start_time || '');
  const expiresAt = String(req.body?.expires_at || '');
  const start = Date.parse(startTime);
  const end = Date.parse(expiresAt);
  if (!title || title.length > 120 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return res.status(400).json({ detail: 'Enter a session name and a valid start/end time range.' });
  }

  const now = Date.now();
  let sessionCode = randomBytes(6).toString('hex').toUpperCase();
  while (attendanceSessions.some((item) => item.session_code === sessionCode)) {
    sessionCode = randomBytes(6).toString('hex').toUpperCase();
  }
  let qrToken = randomBytes(32).toString('hex');
  while (attendanceSessions.some((item) => item.qr_token === qrToken)) {
    qrToken = randomBytes(32).toString('hex');
  }
  const session: AttendanceSessionItem = {
    id: attendanceSessions.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1,
    class_id: classId,
    title,
    start_time: new Date(start).toISOString(),
    expires_at: new Date(end).toISOString(),
    active: start <= now && now <= end,
    is_active: start <= now && now <= end,
    qr_token: qrToken,
    session_code: sessionCode,
    attendance_method: 'QR',
    status: start > now ? 'UPCOMING' : end < now ? 'LOCKED' : 'ACTIVE',
    lecturer_id: user.id,
    lecturer_ip: getRequestIp(req),
    locked_at: end < now ? new Date(now).toISOString() : undefined,
    radius_meters: 0,
    room: String(req.body?.room || ''),
    allow_late_minutes: 0,
    created_at: new Date(now).toISOString(),
  };
  attendanceSessions.unshift(session);
  res.status(201).json(session);
});

app.get('/api/attendance/student/sessions', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role !== 'STUDENT') return res.status(403).json({ detail: 'Student access required.' });
  const approvedClassIds = new Set(
    enrollments
      .filter((enrollment) =>
        enrollment.status === 'APPROVED' &&
        (enrollment.student_id === user.id ||
          Boolean(user.student_code && enrollment.student_code === user.student_code))
      )
      .map((enrollment) => enrollment.class_id)
  );
  const sessions = attendanceSessions
    .filter((session) => approvedClassIds.has(session.class_id))
    .map((session) => {
      const status = session.attendance_method === 'QR' ? getQrSessionStatus(session) : undefined;
      const {
        qr_token: _qrToken,
        lecturer_ip: _lecturerIp,
        session_code: _sessionCode,
        ...studentSession
      } = session;
      return { ...studentSession, ...(status ? { status } : {}) };
    });
  res.json(sessions);
});

app.patch('/api/attendance/sessions/:id/close', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const session = attendanceSessions.find((s) => s.id === id);
  if (!session) return res.status(404).json({ detail: 'Session not found' });
  const user = getCurrentUser(req);
  if (!canManageClassAttendance(session.class_id, user)) {
    return res.status(403).json({ detail: 'You are not authorized to close this attendance session.' });
  }
  session.active = false;
  session.is_active = false;
  if (session.attendance_method === 'QR') {
    session.status = 'LOCKED';
    session.locked_at ||= new Date().toISOString();
  }
  res.json(session);
});

app.post('/api/attendance/sessions/:id/lock', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const session = attendanceSessions.find((item) => item.id === id);
  if (!session) return res.status(404).json({ detail: 'Session not found' });
  const user = getCurrentUser(req);
  if (session.attendance_method !== 'QR' || !canManageClassAttendance(session.class_id, user)) {
    return res.status(403).json({ detail: 'You are not authorized to lock this QR attendance session.' });
  }
  session.status = 'LOCKED';
  session.active = false;
  session.is_active = false;
  session.locked_at ||= new Date().toISOString();
  res.json(session);
});

const checkInQrAttendanceSession = (
  req: Request,
  res: Response,
  user: UserItem,
  session: AttendanceSessionItem,
) => {
  const status = getQrSessionStatus(session);
  if (status === 'LOCKED') {
    return res.status(403).json({ detail: 'Phiên điểm danh đã được khóa. Bạn không thể điểm danh.' });
  }
  if (status === 'UPCOMING') {
    return res.status(403).json({ detail: 'Phiên điểm danh chưa bắt đầu.' });
  }
  const existingRecord = attendanceRecords.find(
    (record) => record.session_id === session.id && record.student_id === user.id
  );
  if (existingRecord) {
    return res.status(409).json({ detail: 'Bạn đã điểm danh phiên này rồi.' });
  }

  const studentIp = getRequestIp(req);
  const lecturerIp = normalizeIpAddress(session.lecturer_ip || '');

  let warning: string | null = null;
  if (!studentIp || !lecturerIp) {
    warning = 'Không thể xác định IP mạng';
  } else if (studentIp !== lecturerIp) {
    warning = 'IP sinh viên khác với IP giảng viên (Khác mạng Wi-Fi)';
  }

  const isAnomaly = Boolean(warning && warning.includes('khác'));
  const checkedAt = new Date();
  const newRecord: AttendanceRecordItem = {
    id: attendanceRecords.reduce((maxId, record) => Math.max(maxId, record.id), 0) + 1,
    session_id: session.id,
    student_id: user.id,
    student_code: user.student_code || '',
    student_name: user.full_name,
    check_in_time: checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    attendance_time: checkedAt.toISOString(),
    student_ip: studentIp,
    attendance_method: 'QR',
    warning,
    status: 'present',
    is_anomaly: isAnomaly,
    anomaly_flag: isAnomaly,
    anomaly_score: isAnomaly ? 0.95 : 0.02,
  };
  attendanceRecords.push(newRecord);
  syncStudentClassAttendanceGrade(session.class_id, user.id, user.student_code);
  return res.status(201).json(newRecord);
};

app.post('/api/attendance/sessions/:id/check-in', (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  const user = getCurrentUser(req);
  const body = req.body || {};
  const session = attendanceSessions.find((s) => s.id === sessionId);
  if (user.role !== 'STUDENT') return res.status(403).json({ detail: 'Student access required.' });
  if (!session) return res.status(404).json({ detail: 'Attendance session not found.' });
  if (!isApprovedClassStudent(session.class_id, user)) {
    return res.status(403).json({ detail: 'You are not enrolled in this class.' });
  }
  if (session.attendance_method === 'QR') {
    return checkInQrAttendanceSession(req, res, user, session);
  }
  const now = Date.now();
  if (!session.is_active || now < Date.parse(session.start_time) || now > Date.parse(session.expires_at)) {
    return res.status(403).json({ detail: 'Attendance session is not open.' });
  }

  if (session && body.qr_token && session.qr_token && body.qr_token.toUpperCase() !== session.qr_token.toUpperCase()) {
    return res.status(400).json({ detail: 'Invalid check-in code' });
  }

  const existingRecord = attendanceRecords.find(
    (r) => r.session_id === sessionId && r.student_id === user.id
  );
  if (existingRecord) {
    return res.json(existingRecord);
  }

  const newRecord: AttendanceRecordItem = {
    id: attendanceRecords.reduce((maxId, record) => Math.max(maxId, record.id), 0) + 1,
    session_id: sessionId,
    student_id: user.id,
    student_code: user.student_code || '',
    student_name: user.full_name,
    check_in_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    attendance_time: new Date().toISOString(),
    attendance_method: 'MANUAL',
    status: 'present',
    is_anomaly: false,
    anomaly_flag: false,
    anomaly_score: 0.02,
  };
  attendanceRecords.push(newRecord);
  syncStudentClassAttendanceGrade(session.class_id, user.id, user.student_code);
  res.status(201).json(newRecord);
});

app.post('/api/attendance/sessions/:id/qr-check-in', (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  const user = getCurrentUser(req);
  if (user.role !== 'STUDENT') return res.status(403).json({ detail: 'Student access required.' });
  const session = attendanceSessions.find((item) => item.id === sessionId);
  if (!session || session.attendance_method !== 'QR') {
    return res.status(404).json({ detail: 'QR attendance session not found.' });
  }
  if (!isApprovedClassStudent(session.class_id, user)) {
    return res.status(403).json({ detail: 'You are not enrolled in this class.' });
  }
  return checkInQrAttendanceSession(req, res, user, session);
});

app.get('/api/attendance/sessions/:id/records', (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  const session = attendanceSessions.find((item) => item.id === sessionId);
  if (!session) return res.status(404).json({ detail: 'Attendance session not found.' });
  const user = getCurrentUser(req);
  if (user.role === 'STUDENT') {
    if (!isApprovedClassStudent(session.class_id, user)) {
      return res.status(403).json({ detail: 'You are not enrolled in this class.' });
    }
    return res.json(attendanceRecords.filter(
      (record) => record.session_id === sessionId && record.student_id === user.id
    ));
  }
  if (!canManageClassAttendance(session.class_id, user)) {
    return res.status(403).json({ detail: 'You are not authorized to view this attendance roster.' });
  }
  const records = attendanceRecords.filter((r) => r.session_id === sessionId);
  res.json(records);
});

app.put('/api/attendance/sessions/:id/records/:studentRef', (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  const studentRef = req.params.studentRef;
  const status = req.body.status || 'present';
  const session = attendanceSessions.find((item) => item.id === sessionId);
  if (!session) return res.status(404).json({ detail: 'Attendance session not found.' });
  const user = getCurrentUser(req);
  if (!canManageClassAttendance(session.class_id, user)) {
    return res.status(403).json({ detail: 'You are not authorized to update this attendance roster.' });
  }
  if (!['present', 'late', 'absent', 'excused'].includes(status)) {
    return res.status(400).json({ detail: 'Invalid attendance status.' });
  }

  let record = attendanceRecords.find(
    (r) => r.session_id === sessionId && (String(r.student_id) === studentRef || r.student_code === studentRef)
  );

  if (!record) {
    const studentUser = users.find((u) => String(u.id) === studentRef || u.student_code === studentRef);
    if (!studentUser) return res.status(404).json({ detail: 'Student not found' });
    record = {
      id: attendanceRecords.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1,
      session_id: sessionId,
      student_id: studentUser.id,
      student_code: studentUser.student_code || studentRef,
      student_name: studentUser.full_name,
      check_in_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status,
      attendance_method: 'MANUAL',
      is_anomaly: false,
      anomaly_flag: false,
      anomaly_score: 0,
    };
    attendanceRecords.push(record);
  } else {
    record.status = status;
  }

  const sess = attendanceSessions.find((s) => s.id === sessionId);
  if (sess) {
    syncStudentClassAttendanceGrade(sess.class_id, record.student_id, record.student_code);
  }

  res.json(record);
});

app.post('/api/attendance/sessions/:id/mark-all-present', (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  const session = attendanceSessions.find((s) => s.id === sessionId);
  if (!session) return res.status(404).json({ detail: 'Session not found' });
  const user = getCurrentUser(req);
  if (!canManageClassAttendance(session.class_id, user)) {
    return res.status(403).json({ detail: 'You are not authorized to update this attendance roster.' });
  }

  const classEnrollments = enrollments.filter((e) => e.class_id === session.class_id && e.status === 'APPROVED');
  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  classEnrollments.forEach((enr) => {
    let rec = attendanceRecords.find((r) => r.session_id === sessionId && (r.student_id === enr.student_id || r.student_code === enr.student_code));
    if (!rec) {
      rec = {
        id: attendanceRecords.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1,
        session_id: sessionId,
        student_id: enr.student_id,
        student_code: enr.student_code || String(enr.student_id),
        student_name: enr.student_name || 'Student',
        check_in_time: nowTime,
        status: 'present',
        attendance_method: 'MANUAL',
        is_anomaly: false,
        anomaly_flag: false,
        anomaly_score: 0,
      };
      attendanceRecords.push(rec);
    } else {
      rec.status = 'present';
      if (!rec.check_in_time) rec.check_in_time = nowTime;
    }
    syncStudentClassAttendanceGrade(session.class_id, enr.student_id, enr.student_code);
  });

  const updatedRecords = attendanceRecords.filter((r) => r.session_id === sessionId);
  res.json(updatedRecords);
});

app.delete('/api/attendance/sessions/:id', (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  const session = attendanceSessions.find((s) => s.id === sessionId);
  if (!session) return res.status(404).json({ detail: 'Session not found' });
  const user = getCurrentUser(req);
  if (!canManageClassAttendance(session.class_id, user)) {
    return res.status(403).json({ detail: 'You are not authorized to delete this attendance session.' });
  }

  attendanceSessions = attendanceSessions.filter((s) => s.id !== sessionId);
  attendanceRecords = attendanceRecords.filter((r) => r.session_id !== sessionId);

  // Recalculate grades for enrolled students of this class
  const classEnrollments = enrollments.filter((e) => e.class_id === session.class_id && e.status === 'APPROVED');
  classEnrollments.forEach((enr) => {
    syncStudentClassAttendanceGrade(session.class_id, enr.student_id, enr.student_code);
  });

  res.status(204).send();
});

app.get('/api/classes/:id/attendance', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const user = getCurrentUser(req);
  if (!canManageClassAttendance(classId, user) && !(user.role === 'STUDENT' && isApprovedClassStudent(classId, user))) {
    return res.status(403).json({ detail: 'You are not authorized to view this class attendance.' });
  }
  const classSessionIds = attendanceSessions.filter((s) => s.class_id === classId).map((s) => s.id);
  const records = attendanceRecords.filter((r) =>
    classSessionIds.includes(r.session_id) &&
    (user.role !== 'STUDENT' || r.student_id === user.id)
  );
  res.json(records);
});

app.get('/api/attendance/my', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const records = attendanceRecords.filter(
    (r) =>
      r.student_id === user.id ||
      (user.student_code && (r.student_code === user.student_code || String(r.student_id) === user.student_code))
  );
  res.json(records);
});

// ==================== Assignments ====================
const syncStudentAssignmentGrade = (classId: number, studentId: number) => {
  const classAssignments = assignments.filter((item) => item.class_id === classId);
  const assignmentIds = new Set(classAssignments.map((item) => item.id));
  const gradedSubmissions = submissions
    .filter((item) => item.student_id === studentId && assignmentIds.has(item.assignment_id) && item.status === 'GRADED')
    .map((item) => {
      const gradedAssignment = classAssignments.find((candidate) => candidate.id === item.assignment_id);
      return {
        score: Number(item.score),
        maxScore: Number(gradedAssignment?.max_score),
        weight: Number(gradedAssignment?.weight ?? 0),
      };
    });
  const assignmentScore = calculateAssignmentAverage(gradedSubmissions);
  if (assignmentScore === null) return;

  const student = users.find((item) => item.id === studentId);
  const existingAssignmentGrade = gradeRecords.find(
    (grade) =>
      grade.class_id === classId &&
      grade.student_id === studentId &&
      grade.component.trim().toLowerCase() === 'assignment'
  );
  if (existingAssignmentGrade) {
    existingAssignmentGrade.score = assignmentScore;
    existingAssignmentGrade.updated_at = new Date().toISOString();
  } else {
    gradeRecords.push({
      id: gradeRecords.length + 1,
      class_id: classId,
      student_id: studentId,
      student_code: student?.student_code || String(studentId),
      student_name: student?.full_name || 'Student',
      component: 'Assignment',
      score: assignmentScore,
      weight: DEFAULT_GRADE_WEIGHTS.assignment,
      created_at: new Date().toISOString(),
    });
  }
};

const syncClassAssignmentGrades = (classId: number) => {
  const classAssignmentIds = new Set(
    assignments.filter((item) => item.class_id === classId).map((item) => item.id)
  );
  const studentIds = new Set(
    submissions
      .filter((item) => classAssignmentIds.has(item.assignment_id) && item.status === 'GRADED')
      .map((item) => item.student_id)
  );
  studentIds.forEach((studentId) => syncStudentAssignmentGrade(classId, studentId));
};

app.get('/api/classes/:id/assignments', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const list = assignments.filter((a) => a.class_id === classId);
  res.json(list);
});

app.post('/api/classes/:id/assignments', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const cls = classes.find((c) => c.id === classId);
  const body = req.body || {};
  const newAsg: AssignmentItem = {
    id: assignments.length + 1,
    class_id: classId,
    class_code: cls?.class_code,
    class_name: cls?.name,
    title: body.title || 'New Assignment',
    description: body.description || '',
    deadline: body.deadline || new Date(Date.now() + 7 * 86400000).toISOString(),
    max_score: Number(body.max_score || 10),
    weight: body.weight === undefined ? 20 : Number(body.weight),
    status: 'published',
  };
  assignments.push(newAsg);
  res.status(201).json(newAsg);
});

app.get('/api/assignments/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const asg = assignments.find((a) => a.id === id);
  if (!asg) return res.status(404).json({ detail: 'Assignment not found' });
  res.json(asg);
});

app.put('/api/assignments/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = assignments.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ detail: 'Assignment not found' });
  assignments[idx] = { ...assignments[idx], ...req.body, id };
  new Set(submissions.filter((item) => item.assignment_id === id && item.status === 'GRADED').map((item) => item.student_id))
    .forEach((studentId) => syncStudentAssignmentGrade(assignments[idx].class_id, studentId));
  res.json(assignments[idx]);
});

app.patch('/api/assignments/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = assignments.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ detail: 'Assignment not found' });
  assignments[idx] = { ...assignments[idx], ...req.body, id };
  new Set(submissions.filter((item) => item.assignment_id === id && item.status === 'GRADED').map((item) => item.student_id))
    .forEach((studentId) => syncStudentAssignmentGrade(assignments[idx].class_id, studentId));
  res.json(assignments[idx]);
});

app.delete('/api/assignments/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  assignments = assignments.filter((a) => a.id !== id);
  res.status(204).send();
});

app.post('/api/assignments/:id/submit', (req: Request, res: Response) => {
  const assignmentId = Number(req.params.id);
  const user = getCurrentUser(req);
  const body = req.body || {};

  let sub = submissions.find((s) => s.assignment_id === assignmentId && s.student_id === user.id);
  if (sub) {
    sub.content = body.content || sub.content;
    sub.submitted_at = new Date().toISOString();
    sub.status = 'SUBMITTED';
  } else {
    sub = {
      id: submissions.length + 1,
      assignment_id: assignmentId,
      student_id: user.id,
      student_code: user.student_code || '',
      student_name: user.full_name,
      content: body.content || '',
      submitted_at: new Date().toISOString(),
      status: 'SUBMITTED',
    };
    submissions.push(sub);
  }
  res.status(201).json(sub);
});

app.get('/api/assignments/:id/my-submission', (req: Request, res: Response) => {
  const assignmentId = Number(req.params.id);
  const user = getCurrentUser(req);
  const sub = submissions.find((s) => s.assignment_id === assignmentId && s.student_id === user.id);
  if (!sub) return res.status(404).json({ detail: 'No submission found' });
  res.json(sub);
});

app.get('/api/assignments/:id/submissions', (req: Request, res: Response) => {
  const assignmentId = Number(req.params.id);
  const list = submissions.filter((s) => s.assignment_id === assignmentId);
  res.json(list);
});

app.patch('/api/submissions/:id/grade', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const sub = submissions.find((s) => s.id === id);
  if (!sub) return res.status(404).json({ detail: 'Submission not found' });
  const assignment = assignments.find((item) => item.id === sub.assignment_id);
  if (!assignment) return res.status(404).json({ detail: 'Assignment not found for submission' });
  const score = Number(req.body.score);
  const maxScore = Number(assignment.max_score);
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
    return res.status(400).json({ detail: `Score must be between 0 and ${maxScore}.` });
  }

  sub.score = score;
  sub.status = 'GRADED';
  sub.feedback = req.body.feedback === undefined ? sub.feedback : String(req.body.feedback);
  syncStudentAssignmentGrade(assignment.class_id, sub.student_id);
  res.json(sub);
});

// ==================== Grades ====================
app.get('/api/classes/:id/grades', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  syncClassAssignmentGrades(classId);
  gradeRecords
    .filter((grade) => grade.class_id === classId && isAttendanceGrade(grade.component))
    .forEach((grade) => { grade.weight = 0; });
  const list = gradeRecords.filter((g) => g.class_id === classId);
  res.json(list);
});

app.post('/api/classes/:id/grades', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const body = req.body || {};
  const student = users.find((u) => u.id === Number(body.student_id));
  const newGrade: GradeItemRecord = {
    id: gradeRecords.length + 1,
    class_id: classId,
    student_id: Number(body.student_id),
    student_code: student?.student_code || String(body.student_id),
    student_name: student?.full_name || 'Student',
    component: body.component || 'Component',
    score: Number(body.score || 0),
    weight: isAttendanceGrade(String(body.component || ''))
      ? 0
      : body.weight === undefined ? 10 : Number(body.weight),
    created_at: new Date().toISOString(),
  };
  gradeRecords.push(newGrade);
  res.status(201).json(newGrade);
});

app.get('/api/classes/:id/grades/my', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const user = getCurrentUser(req);
  syncStudentAssignmentGrade(classId, user.id);
  const attStats = syncStudentClassAttendanceGrade(classId, user.id, user.student_code);

  let myGrades = gradeRecords
    .filter((g) => g.class_id === classId && g.student_id === user.id)
    .map((g) => {
      if (isAttendanceGrade(g.component)) {
        return { ...g, score: attStats.attendanceScore, weight: 0 };
      }
      return g;
    });

  const { overallScore: aggregateScore } = calculateWeightedGrade(myGrades);
  res.json({
    aggregate_score: aggregateScore,
    attendance_stats: attStats,
    attendance_exceeded: attStats.attendanceExceeded,
    grades: myGrades,
  });
});

app.get('/api/classes/:id/results', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  syncClassAssignmentGrades(classId);
  const enrolledStudents = enrollments.filter((e) => e.class_id === classId && e.status === 'APPROVED');

  const results = enrolledStudents.map((enr) => {
    const attStats = syncStudentClassAttendanceGrade(classId, enr.student_id, enr.student_code);
    const studentGrades = gradeRecords
      .filter((g) => g.class_id === classId && g.student_id === enr.student_id)
      .map((g) => {
        if (isAttendanceGrade(g.component)) {
          return { ...g, score: attStats.attendanceScore, weight: 0 };
        }
        return g;
      });

    const { overallScore, totalWeight } = calculateWeightedGrade(studentGrades);
    return {
      student_id: enr.student_id,
      student_code: enr.student_code,
      student_name: enr.student_name,
      attendance_stats: attStats,
      grades: studentGrades,
      total_weight: totalWeight,
      aggregate_score: overallScore,
      is_complete: totalWeight >= 100,
    };
  });

  res.json(results);
});

app.put('/api/grades/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const grade = gradeRecords.find((g) => g.id === id);
  if (!grade) return res.status(404).json({ detail: 'Grade record not found' });
  if (req.body.score !== undefined) grade.score = Number(req.body.score);
  if (isAttendanceGrade(grade.component)) grade.weight = 0;
  else if (req.body.weight !== undefined) grade.weight = Number(req.body.weight);
  grade.updated_at = new Date().toISOString();
  res.json(grade);
});

app.patch('/api/grades/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const grade = gradeRecords.find((g) => g.id === id);
  if (!grade) return res.status(404).json({ detail: 'Grade record not found' });
  if (req.body.score !== undefined) grade.score = Number(req.body.score);
  if (isAttendanceGrade(grade.component)) grade.weight = 0;
  else if (req.body.weight !== undefined) grade.weight = Number(req.body.weight);
  grade.updated_at = new Date().toISOString();
  res.json(grade);
});

app.delete('/api/grades/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  gradeRecords = gradeRecords.filter((g) => g.id !== id);
  res.status(204).send();
});

// ==================== Quizzes ====================
app.get('/api/classes/:id/quizzes', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const list = quizzes.filter((q) => q.class_id === classId);
  res.json(list);
});

app.post('/api/classes/:id/quizzes', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const body = req.body || {};
  const newQuiz: QuizItem = {
    id: quizzes.length + 1,
    class_id: classId,
    title: body.title || 'New Quiz',
    description: body.description,
    total_points: Number(body.total_points || 10),
    available_from: body.available_from || new Date().toISOString(),
    due_at: body.due_at || new Date(Date.now() + 14 * 86400000).toISOString(),
    is_active: body.is_active !== undefined ? body.is_active : true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  quizzes.push(newQuiz);
  res.status(201).json(newQuiz);
});

app.get('/api/quizzes/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const quiz = quizzes.find((q) => q.id === id);
  if (!quiz) return res.status(404).json({ detail: 'Quiz not found' });
  res.json(quiz);
});

app.put('/api/quizzes/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = quizzes.findIndex((q) => q.id === id);
  if (idx === -1) return res.status(404).json({ detail: 'Quiz not found' });
  quizzes[idx] = { ...quizzes[idx], ...req.body, id, updated_at: new Date().toISOString() };
  res.json(quizzes[idx]);
});

app.patch('/api/quizzes/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = quizzes.findIndex((q) => q.id === id);
  if (idx === -1) return res.status(404).json({ detail: 'Quiz not found' });
  quizzes[idx] = { ...quizzes[idx], ...req.body, id, updated_at: new Date().toISOString() };
  res.json(quizzes[idx]);
});

app.delete('/api/quizzes/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  quizzes = quizzes.filter((q) => q.id !== id);
  res.status(204).send();
});

app.post('/api/quizzes/:id/results', (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  const user = getCurrentUser(req);
  const quiz = quizzes.find((q) => q.id === quizId);
  const body = req.body || {};
  if (!quiz) return res.status(404).json({ detail: 'Quiz not found' });

  const score = Number(body.score);
  if (!Number.isFinite(score)) return res.status(400).json({ detail: 'A valid quiz score is required' });
  const maxScore = Number(quiz.total_points);
  if (maxScore <= 0) return res.status(400).json({ detail: 'Quiz total points must be greater than zero' });
  const percentage = Math.round((score / maxScore) * 100);

  const result: QuizResultItem = {
    id: quizResults.length + 1,
    quiz_id: quizId,
    class_id: quiz.class_id,
    student_id: user.id,
    student_code: user.student_code || '',
    student_name: user.full_name,
    topic: quiz.title,
    score,
    max_score: maxScore,
    percentage,
    attempt_number: 1,
    created_at: new Date().toISOString(),
  };
  quizResults.push(result);
  res.status(201).json(result);
});

app.get('/api/quizzes/:id/results/my', (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  const user = getCurrentUser(req);
  const result = quizResults.find((r) => r.quiz_id === quizId && r.student_id === user.id);
  if (!result) return res.status(404).json({ detail: 'No quiz result found' });
  res.json(result);
});

app.get('/api/quizzes/:id/results', (req: Request, res: Response) => {
  const quizId = Number(req.params.id);
  const list = quizResults.filter((r) => r.quiz_id === quizId);
  res.json(list);
});

app.get('/api/classes/:id/quizzes/results/my', (req: Request, res: Response) => {
  const classId = Number(req.params.id);
  const user = getCurrentUser(req);
  const list = quizResults.filter((r) => r.class_id === classId && r.student_id === user.id);
  res.json(list);
});

// ==================== Analytics ====================
const calculateClassStudentRisk = (classId: number, student: UserItem) => {
  syncStudentAssignmentGrade(classId, student.id);
  const now = Date.now();
  const attendanceStats = computeStudentClassAttendanceStats(classId, student.id, student.student_code);
  const publishedAssignments = assignments.filter((assignment) =>
    assignment.class_id === classId &&
    String(assignment.status || '').toLowerCase() === 'published'
  );
  const overdueAssignments = publishedAssignments.filter((assignment) =>
    Number.isFinite(Date.parse(assignment.deadline)) &&
    Date.parse(assignment.deadline) < now
  );
  const missingAssignmentCount = overdueAssignments.filter((assignment) => {
    const submission = submissions.find(
      (item) => item.assignment_id === assignment.id && item.student_id === student.id
    );
    return !submission || submission.status === 'MISSING';
  }).length;
  const submittedAssignmentCount = publishedAssignments.filter((assignment) => {
    const submission = submissions.find(
      (item) => item.assignment_id === assignment.id && item.student_id === student.id
    );
    return Boolean(submission && submission.status !== 'MISSING');
  }).length;
  const gradeComponents = gradeRecords.filter((grade) =>
    grade.class_id === classId &&
    grade.student_id === student.id &&
    grade.weight > 0 &&
    !isAttendanceGrade(grade.component)
  );
  const gradeSummary = calculateWeightedGrade(gradeComponents);
  const averageGrade = gradeSummary.totalWeight > 0
    ? Number((gradeSummary.overallScore / 10).toFixed(2))
    : null;

  return calculateStudentRisk({
    student_id: student.id,
    class_id: classId,
    student_code: student.student_code || null,
    student_name: student.full_name,
    attendance_rate: attendanceStats.total > 0 ? attendanceStats.attendanceRate / 100 : null,
    assignment_submission_rate: publishedAssignments.length > 0
      ? submittedAssignmentCount / publishedAssignments.length
      : null,
    average_grade: averageGrade,
    missing_assignment_count: missingAssignmentCount,
    absence_count: attendanceStats.absent,
  });
};

const createStudentLearningPath = (classId: number, student: UserItem) => {
  const risk = calculateClassStudentRisk(classId, student);
  const gradeComponents = gradeRecords.filter((grade) =>
    grade.class_id === classId &&
    grade.student_id === student.id &&
    grade.weight > 0 &&
    !isAttendanceGrade(grade.component)
  );
  const courseGradeSummary = calculateWeightedGrade(gradeComponents);
  const courseAverageOutOfTen = courseGradeSummary.totalWeight > 0
    ? courseGradeSummary.overallScore / 10
    : null;
  const recommendations: Array<Omit<LearningRecommendationRecord, 'id' | 'student_id' | 'class_id' | 'status' | 'created_at'>> = [];
  const addRecommendation = (
    recommendation_type: string,
    title: string,
    description: string,
    priority: 'HIGH' | 'MEDIUM' | 'LOW',
    reason: string,
    target_topic: string | null
  ) => recommendations.push({
    recommendation_type,
    title,
    description,
    priority,
    reason,
    target_topic,
    recommended_order: recommendations.length + 1,
  });

  const studentCurriculum = studentCurricula.find((record) => record.student_id === student.id)?.courses;
  const activeCurriculumCourses = studentCurriculum ?? curriculumCourses;
  const approvedEnrollments = enrollments.filter(
    (enrollment) => enrollment.student_id === student.id && enrollment.status === 'APPROVED'
  );
  const approvedCourseCodes = new Set(
    approvedEnrollments
      .map((enrollment) => classes.find((item) => item.id === enrollment.class_id)?.class_code.toUpperCase())
      .filter((courseCode): courseCode is string => Boolean(courseCode))
  );
  const activeCourseCodes = new Set(
    approvedEnrollments
      .filter((enrollment) => classId === 0 || enrollment.class_id === classId)
      .map((enrollment) => classes.find((item) => item.id === enrollment.class_id)?.class_code.toUpperCase())
      .filter((courseCode): courseCode is string => Boolean(courseCode))
  );
  const currentCurriculumCourses = activeCurriculumCourses.filter(
    (course) => activeCourseCodes.has(course.course_code.toUpperCase())
  );
  const relatedCourseCodes = new Set(
    currentCurriculumCourses.map((course) => course.course_code.toUpperCase())
  );
  const currentRelatedCourseCodes = new Set(
    currentCurriculumCourses.flatMap((course) => course.related_courses.map((code) => code.toUpperCase()))
  );
  const currentCourseGradeByCode = new Map<string, number>();
  const currentCourseGradeAverages = approvedEnrollments
    .filter((enrollment) => classId === 0 || enrollment.class_id === classId)
    .map((enrollment) => {
      const courseCode = classes.find((item) => item.id === enrollment.class_id)?.class_code.toUpperCase();
      const grades = gradeRecords.filter((grade) =>
        grade.class_id === enrollment.class_id &&
        grade.student_id === student.id &&
        grade.weight > 0 &&
        !isAttendanceGrade(grade.component)
      );
      const summary = calculateWeightedGrade(grades);
      if (summary.totalWeight <= 0) return null;
      const score = summary.overallScore / 10;
      if (courseCode) currentCourseGradeByCode.set(courseCode, score);
      return score;
    })
    .filter((score): score is number => score !== null);
  const recommendationAverageOutOfTen = currentCourseGradeAverages.length > 0
    ? currentCourseGradeAverages.reduce((sum, score) => sum + score, 0) / currentCourseGradeAverages.length
    : courseAverageOutOfTen;

  const courseRecommendations = activeCurriculumCourses
    .filter((course) => {
      const candidateCode = course.course_code.toUpperCase();
      const prerequisitesMet = course.prerequisites.every((code) => approvedCourseCodes.has(code.toUpperCase()));
      const isRelated = currentCurriculumCourses.length === 0 ||
        currentRelatedCourseCodes.has(candidateCode) ||
        course.related_courses.some((code) => relatedCourseCodes.has(code.toUpperCase())) ||
        course.prerequisites.some((code) => relatedCourseCodes.has(code.toUpperCase()));
      return !approvedCourseCodes.has(candidateCode) && prerequisitesMet && isRelated;
    })
    .map((course) => {
      const candidateCode = course.course_code.toUpperCase();
      const relatedCourses = currentCurriculumCourses.filter((currentCourse) =>
        course.related_courses.some((code) => code.toUpperCase() === currentCourse.course_code.toUpperCase()) ||
        currentCourse.related_courses.some((code) => code.toUpperCase() === candidateCode)
      );
      const relatedCourseGrades = relatedCourses.flatMap((relatedCourse) => {
        const score = currentCourseGradeByCode.get(relatedCourse.course_code.toUpperCase());
        return score === undefined ? [] : [{ course: relatedCourse, score }];
      });
      const relatedCourseAverage = relatedCourseGrades.length > 0
        ? relatedCourseGrades.reduce((sum, grade) => sum + grade.score, 0) / relatedCourseGrades.length
        : null;

      return {
        course,
        relatedCourseGrades,
        relatedCourseAverage,
        priority: recommendationAverageOutOfTen === null
          ? 'LOW' as const
          : recommendationAverageOutOfTen < 5
            ? 'HIGH' as const
            : recommendationAverageOutOfTen < 7
              ? 'MEDIUM' as const
              : 'LOW' as const,
      };
    })
    .sort((left, right) =>
      (right.relatedCourseAverage ?? -1) - (left.relatedCourseAverage ?? -1) ||
      (left.priority === 'HIGH' ? 0 : left.priority === 'MEDIUM' ? 1 : 2) -
        (right.priority === 'HIGH' ? 0 : right.priority === 'MEDIUM' ? 1 : 2) ||
      left.course.semester - right.course.semester ||
      left.course.course_code.localeCompare(right.course.course_code)
    )
    .slice(0, 5);

  courseRecommendations.forEach(({ course, priority, relatedCourseGrades, relatedCourseAverage }) => {
    const relatedCourse = currentCurriculumCourses.find((currentCourse) =>
      currentCourse.related_courses.some((code) => code.toUpperCase() === course.course_code.toUpperCase()) ||
      course.related_courses.some((code) => code.toUpperCase() === currentCourse.course_code.toUpperCase()) ||
      course.prerequisites.some((code) => code.toUpperCase() === currentCourse.course_code.toUpperCase())
    );
    const relation = relatedCourse
      ? `môn ${relatedCourse.course_code} là môn liên quan hoặc tiên quyết`
      : 'môn thuộc lộ trình admin gán và đủ điều kiện tiên quyết';
    addRecommendation(
      'COURSE_PATH',
      `${course.course_code} · ${course.course_name}`,
      `Học kỳ ${course.semester} · ${course.credits} tín chỉ · Nhóm ${course.course_group}.` +
        (course.prerequisites.length > 0 ? ` Môn tiên quyết: ${course.prerequisites.join(', ')}.` : ' Không yêu cầu môn tiên quyết.') +
        (course.related_courses.length > 0 ? ` Môn liên quan: ${course.related_courses.join(', ')}.` : ''),
      priority,
      `Đề xuất dựa trên ${relation}.` +
        (course.prerequisites.length > 0 ? ' Các môn tiên quyết đã có trong danh sách lớp được duyệt.' : '') +
        (recommendationAverageOutOfTen === null
          ? ' Chưa có đủ điểm để cá nhân hóa mức ưu tiên.'
            : ` Điểm trung bình lớp hiện tại là ${recommendationAverageOutOfTen.toFixed(1)}/10; mức ưu tiên được điều chỉnh theo kết quả này.`) +
          (relatedCourseAverage === null
            ? ''
            : ` Điểm trung bình các môn liên quan (${relatedCourseGrades.map(({ course: related }) => related.course_code).join(', ')}) là ${relatedCourseAverage.toFixed(1)}/10; môn có điểm liên quan cao hơn được xếp trước.`),
        course.course_code
    );
  });

  const existing = learningRecommendations.filter(
    (item) => item.student_id === student.id && item.class_id === classId
  );
  const existingByKey = new Map(
    existing.map((item) => [`${item.recommendation_type}|${item.target_topic || ''}`, item])
  );
  let nextId = learningRecommendations.reduce((maximum, item) => Math.max(maximum, item.id), 0) + 1;
  const createdAt = new Date().toISOString();
  const savedRecommendations = recommendations.map((recommendation) => {
    const previous = existingByKey.get(`${recommendation.recommendation_type}|${recommendation.target_topic || ''}`);
    return {
      ...recommendation,
      id: previous?.id ?? nextId++,
      student_id: student.id,
      class_id: classId,
      status: previous?.status ?? 'PENDING',
      created_at: previous?.created_at ?? createdAt,
    } satisfies LearningRecommendationRecord;
  });
  learningRecommendations = [
    ...learningRecommendations.filter((item) => item.student_id !== student.id || item.class_id !== classId),
    ...savedRecommendations,
  ];

  return {
    student_id: student.id,
    class_id: classId,
    student_code: student.student_code || null,
    student_name: student.full_name,
    risk_level: risk?.risk_level ?? 'INSUFFICIENT_DATA',
    risk_score: risk?.risk_score ?? null,
    total_recommendations: savedRecommendations.length,
    recommendations: savedRecommendations,
    generated_at: createdAt,
  };
};

const calculateClassRiskAssessments = (classId: number) =>
  enrollments
    .filter((enrollment) => enrollment.class_id === classId && enrollment.status === 'APPROVED')
    .flatMap((enrollment) => {
      const student = users.find((item) => item.id === enrollment.student_id);
      if (!student || student.role !== 'STUDENT') return [];
      const assessment = calculateClassStudentRisk(classId, student);
      return assessment ? [assessment] : [];
    });

app.get('/api/analytics/my-risk/:classId', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const classId = Number(req.params.classId);
  const cls = classes.find((item) => item.id === classId);
  if (!cls) return res.status(404).json({ detail: 'Class not found.' });
  if (user.role !== 'STUDENT') return res.status(403).json({ detail: 'Student risk analysis is only available to students.' });

  const enrollment = enrollments.find(
    (item) => item.class_id === classId && item.student_id === user.id && item.status === 'APPROVED'
  );
  if (!enrollment) return res.status(403).json({ detail: 'You are not enrolled in this class.' });

  const risk = calculateClassStudentRisk(classId, user);
  if (!risk) return res.status(404).json({ detail: 'No attendance, published assignments, or grades to analyze yet.' });
  res.json(risk);
});

app.get('/api/classes/:classId/analytics/risk', (_req: Request, res: Response) => {
  res.json([]);
});

app.get('/api/classes/:classId/analytics/risk/:studentId', (_req: Request, res: Response) => {
  return res.status(404).json({ detail: 'No risk analysis found for this student.' });
});

app.get('/api/admin/curriculum', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role !== 'ADMIN') return res.status(403).json({ detail: 'Admin access required.' });
  res.json({ course_count: curriculumCourses.length });
});

app.post('/api/admin/curriculum/upload', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role !== 'ADMIN') return res.status(403).json({ detail: 'Admin access required.' });
  if (typeof req.body?.csv !== 'string' || !req.body.csv.trim()) {
    return res.status(400).json({ detail: 'CSV content is required.' });
  }

  let importedCourses: CurriculumCourseRecord[];
  try {
    importedCourses = parseCurriculumCsv(req.body.csv);
  } catch (error) {
    return res.status(400).json({
      detail: error instanceof Error ? error.message : 'CSV không hợp lệ.',
    });
  }

  curriculumCourses = importedCourses;
  res.json({ course_count: importedCourses.length });
});

app.put('/api/admin/users/:studentId/learning-path', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role !== 'ADMIN') return res.status(403).json({ detail: 'Admin access required.' });

  const studentId = Number(req.params.studentId);
  if (!Number.isSafeInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ detail: 'Invalid student id.' });
  }
  const student = users.find((item) => item.id === studentId && item.role === 'STUDENT');
  if (!student) return res.status(404).json({ detail: 'Student not found.' });
  if (typeof req.body?.csv !== 'string' || !req.body.csv.trim()) {
    return res.status(400).json({ detail: 'CSV content is required.' });
  }

  let importedCourses: CurriculumCourseRecord[];
  try {
    importedCourses = parseCurriculumCsv(req.body.csv);
  } catch (error) {
    return res.status(400).json({
      detail: error instanceof Error ? error.message : 'CSV không hợp lệ.',
    });
  }

  studentCurricula = [
    ...studentCurricula.filter((record) => record.student_id !== studentId),
    { student_id: studentId, courses: importedCourses },
  ];
  learningRecommendations = learningRecommendations.filter(
    (recommendation) =>
      recommendation.student_id !== studentId ||
      recommendation.recommendation_type !== 'COURSE_PATH'
  );
  res.json({ course_count: importedCourses.length });
});

app.get('/api/analytics/my-learning-path/:classId', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const classId = Number(req.params.classId);
  const cls = classes.find((item) => item.id === classId);
  if (!cls) return res.status(404).json({ detail: 'Class not found.' });
  if (user.role !== 'STUDENT') return res.status(403).json({ detail: 'Learning paths are only available to students.' });
  const enrollment = enrollments.find(
    (item) => item.class_id === classId && item.student_id === user.id && item.status === 'APPROVED'
  );
  if (!enrollment) return res.status(403).json({ detail: 'You are not enrolled in this class.' });
  res.json(createStudentLearningPath(classId, user));
});

app.get('/api/analytics/my-learning-path', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role !== 'STUDENT') return res.status(403).json({ detail: 'Learning paths are only available to students.' });
  res.json(createStudentLearningPath(0, user));
});

app.patch('/api/analytics/my-learning-path/:classId/recommendations/:recommendationId', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const classId = Number(req.params.classId);
  const recommendationId = Number(req.params.recommendationId);
  if (user.role !== 'STUDENT') return res.status(403).json({ detail: 'Only students can update their learning path.' });
  if (classId > 0) {
    const enrollment = enrollments.find(
      (item) => item.class_id === classId && item.student_id === user.id && item.status === 'APPROVED'
    );
    if (!enrollment) return res.status(403).json({ detail: 'You are not enrolled in this class.' });
  } else if (classId !== 0) {
    return res.status(400).json({ detail: 'Invalid learning-path class id.' });
  }
  const status = String(req.body?.status || '').toUpperCase();
  if (!['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
    return res.status(400).json({ detail: 'Status must be PENDING, IN_PROGRESS, or COMPLETED.' });
  }
  const recommendation = learningRecommendations.find(
    (item) =>
      item.id === recommendationId &&
      item.class_id === classId &&
      item.student_id === user.id
  );
  if (!recommendation) return res.status(404).json({ detail: 'Learning recommendation not found.' });
  recommendation.status = status as LearningRecommendationRecord['status'];
  res.json(recommendation);
});

app.get('/api/classes/:classId/analytics/learning-path', (_req: Request, res: Response) => {
  res.json([]);
});

app.get('/api/classes/:classId/analytics/learning-path/:studentId', (_req: Request, res: Response) => {
  return res.status(404).json({ detail: 'No learning path found for this student.' });
});

// ==================== Teaching Quality Analytics ====================
app.get('/api/classes/:classId/analytics/teaching-quality', (req: Request, res: Response) => {
  const classId = Number(req.params.classId);
  const user = getCurrentUser(req);
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return res.status(404).json({ detail: 'Class not found.' });
  if (user.role !== 'LECTURER' || cls.lecturer_id !== user.id) {
    return res.status(403).json({ detail: 'Teaching analytics are only available to the class lecturer.' });
  }
  const classEnrollments = enrollments.filter((e) => e.class_id === classId && e.status === 'APPROVED');
  const riskAssessments = calculateClassRiskAssessments(classId);
  const lowRiskCount = riskAssessments.filter((assessment) => assessment.risk_level === 'LOW').length;
  const mediumRiskCount = riskAssessments.filter((assessment) => assessment.risk_level === 'MEDIUM').length;
  const highRiskCount = riskAssessments.filter((assessment) => assessment.risk_level === 'HIGH').length;
  const classAssignments = assignments.filter((a) => a.class_id === classId);
  const classSessions = attendanceSessions.filter((s) => s.class_id === classId);
  const classSessionIds = new Set(classSessions.map((session) => session.id));
  const classAttendanceRecords = attendanceRecords.filter((record) => classSessionIds.has(record.session_id));
  const classAssignmentIds = new Set(classAssignments.map((assignment) => assignment.id));
  const classSubmissions = submissions.filter((submission) => classAssignmentIds.has(submission.assignment_id));
  const classGradeRecords = gradeRecords.filter((record) => record.class_id === classId);
  const classQuizzes = quizzes.filter((quiz) => quiz.class_id === classId);
  const classQuizIds = new Set(classQuizzes.map((quiz) => quiz.id));
  const classQuizResults = quizResults.filter((result) => result.quiz_id && classQuizIds.has(result.quiz_id));
  const submissionDenominator = classAssignments.length * classEnrollments.length;
  const attendanceRate = classAttendanceRecords.length > 0
    ? (classAttendanceRecords.filter((record) => record.status === 'present' || record.status === 'late' || record.status === 'excused').length / classAttendanceRecords.length) * 100
    : 0;
  const assignmentCompletionRate = submissionDenominator > 0 ? (classSubmissions.length / submissionDenominator) * 100 : 0;
  const gradeScores = classGradeRecords.map((record) => record.score / 10);
  const averageGrade = gradeScores.length > 0 ? gradeScores.reduce((sum, score) => sum + score, 0) / gradeScores.length : 0;
  const quizAverage = classQuizResults.length > 0
    ? classQuizResults.reduce((sum, result) => sum + result.percentage, 0) / classQuizResults.length
    : 0;

  res.json({
    class_id: classId,
    class_name: cls?.name || '',
    overview: {
      total_students: classEnrollments.length,
      active_students: classEnrollments.length,
      total_assignments: classAssignments.length,
      total_quizzes: classQuizzes.length,
      total_attendance_sessions: classSessions.length,
      average_grade: averageGrade,
      attendance_rate: attendanceRate,
      assignment_completion_rate: assignmentCompletionRate,
      quiz_average: quizAverage,
    },
    assignments: {
      total_submissions: classSubmissions.length,
      assignment_completion_rate: assignmentCompletionRate,
      overdue_missing_count: classSubmissions.filter((submission) => submission.status === 'MISSING' || submission.status === 'LATE').length,
      per_assignment: classAssignments.map((a) => ({
        assignment_id: a.id,
        title: a.title,
        submitted_count: classSubmissions.filter((submission) => submission.assignment_id === a.id).length,
        missing_count: Math.max(0, classEnrollments.length - classSubmissions.filter((submission) => submission.assignment_id === a.id).length),
        completion_rate: classEnrollments.length > 0
          ? (classSubmissions.filter((submission) => submission.assignment_id === a.id).length / classEnrollments.length) * 100
          : 0,
      })),
    },
    grades: {
      average_grade: averageGrade,
      minimum_grade: gradeScores.length > 0 ? Math.min(...gradeScores) : 0,
      maximum_grade: gradeScores.length > 0 ? Math.max(...gradeScores) : 0,
      graded_student_count: new Set(classGradeRecords.map((record) => record.student_id)).size,
      grade_distribution: [],
    },
    attendance: {
      total_sessions: classSessions.length,
      total_records: classAttendanceRecords.length,
      present_count: classAttendanceRecords.filter((record) => record.status === 'present' || record.status === 'late' || record.status === 'excused').length,
      absent_count: classAttendanceRecords.filter((record) => record.status === 'absent').length,
      attendance_rate: attendanceRate,
      absence_rate: classAttendanceRecords.length > 0
        ? (classAttendanceRecords.filter((record) => record.status === 'absent').length / classAttendanceRecords.length) * 100
        : 0,
    },
    quizzes: {
      total_quizzes: classQuizzes.length,
      total_results: classQuizResults.length,
      average_percentage: quizAverage,
      per_quiz: classQuizzes.map((q) => ({
        quiz_id: q.id,
        title: q.title,
        total_attempts: classQuizResults.filter((result) => result.quiz_id === q.id).length,
        average_percentage: classQuizResults.filter((result) => result.quiz_id === q.id).length > 0
          ? classQuizResults.filter((result) => result.quiz_id === q.id).reduce((sum, result) => sum + result.percentage, 0) / classQuizResults.filter((result) => result.quiz_id === q.id).length
          : 0,
      })),
    },
    risks: {
      total_evaluated: riskAssessments.length,
      low_risk_count: lowRiskCount,
      medium_risk_count: mediumRiskCount,
      high_risk_count: highRiskCount,
      low_risk_percentage: riskAssessments.length > 0 ? (lowRiskCount / riskAssessments.length) * 100 : 0,
      medium_risk_percentage: riskAssessments.length > 0 ? (mediumRiskCount / riskAssessments.length) * 100 : 0,
      high_risk_percentage: riskAssessments.length > 0 ? (highRiskCount / riskAssessments.length) * 100 : 0,
      students: riskAssessments.map((assessment) => ({
        student_id: assessment.student_id,
        student_code: assessment.student_code,
        student_name: assessment.student_name,
        risk_score: assessment.risk_score,
        risk_level: assessment.risk_level,
        attendance_rate: assessment.attendance_rate,
        assignment_submission_rate: assessment.assignment_submission_rate,
        average_grade: assessment.average_grade,
        missing_assignment_count: assessment.missing_assignment_count,
        absence_count: assessment.absence_count,
        reasons: assessment.reasons,
      })),
    },
    recommendations: {
      total_recommendations: 0,
      high_priority_count: 0,
      medium_priority_count: 0,
      low_priority_count: 0,
    },
    insights: [],
    generated_at: new Date().toISOString(),
  });
});

app.get('/api/classes/:classId/analytics/teaching-quality/assignments', (req: Request, res: Response) => {
  const classId = Number(req.params.classId);
  const assignmentIds = new Set(assignments.filter((assignment) => assignment.class_id === classId).map((assignment) => assignment.id));
  const classSubmissions = submissions.filter((submission) => assignmentIds.has(submission.assignment_id));
  res.json({ total_submissions: classSubmissions.length, completion_rate: 0 });
});

app.get('/api/classes/:classId/analytics/teaching-quality/grades', (req: Request, res: Response) => {
  const classGrades = gradeRecords.filter((grade) => grade.class_id === Number(req.params.classId));
  res.json({
    average_grade: classGrades.length > 0 ? classGrades.reduce((sum, grade) => sum + grade.score / 10, 0) / classGrades.length : 0,
    graded_student_count: new Set(classGrades.map((grade) => grade.student_id)).size,
  });
});

app.get('/api/classes/:classId/analytics/teaching-quality/attendance', (req: Request, res: Response) => {
  const classId = Number(req.params.classId);
  const classSessionIds = new Set(attendanceSessions.filter((session) => session.class_id === classId).map((session) => session.id));
  const records = attendanceRecords.filter((record) => classSessionIds.has(record.session_id));
  const attended = records.filter((record) => record.status === 'present' || record.status === 'late' || record.status === 'excused').length;
  res.json({ attendance_rate: records.length > 0 ? (attended / records.length) * 100 : 0, total_sessions: classSessionIds.size });
});

app.get('/api/classes/:classId/analytics/teaching-quality/quizzes', (req: Request, res: Response) => {
  const classId = Number(req.params.classId);
  const quizIds = new Set(quizzes.filter((quiz) => quiz.class_id === classId).map((quiz) => quiz.id));
  const results = quizResults.filter((result) => result.quiz_id && quizIds.has(result.quiz_id));
  res.json({
    quiz_average: results.length > 0 ? results.reduce((sum, result) => sum + result.percentage, 0) / results.length : 0,
    total_quizzes: quizIds.size,
  });
});

app.get('/api/classes/:classId/analytics/teaching-quality/risks', (req: Request, res: Response) => {
  const classId = Number(req.params.classId);
  const user = getCurrentUser(req);
  const cls = classes.find((item) => item.id === classId);
  if (!cls) return res.status(404).json({ detail: 'Class not found.' });
  if (user.role !== 'LECTURER' || cls.lecturer_id !== user.id) {
    return res.status(403).json({ detail: 'Teaching analytics are only available to the class lecturer.' });
  }
  const assessments = calculateClassRiskAssessments(classId);
  const low = assessments.filter((item) => item.risk_level === 'LOW').length;
  const medium = assessments.filter((item) => item.risk_level === 'MEDIUM').length;
  const high = assessments.filter((item) => item.risk_level === 'HIGH').length;
  res.json({
    total_evaluated: assessments.length,
    low_risk_count: low,
    medium_risk_count: medium,
    high_risk_count: high,
    low_risk_percentage: assessments.length > 0 ? (low / assessments.length) * 100 : 0,
    medium_risk_percentage: assessments.length > 0 ? (medium / assessments.length) * 100 : 0,
    high_risk_percentage: assessments.length > 0 ? (high / assessments.length) * 100 : 0,
    students: assessments,
  });
});

// ==================== Notifications ====================
app.get('/api/notifications', (_req: Request, res: Response) => {
  res.json(notifications);
});

app.patch('/api/notifications/:id/approve', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const notif = notifications.find((n) => n.id === id);
  if (notif) {
    notif.status = 'approved';
    notif.responded_at = new Date().toISOString();
  }
  res.json(notif || {});
});

app.patch('/api/notifications/:id/reject', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const notif = notifications.find((n) => n.id === id);
  if (notif) {
    notif.status = 'rejected';
    notif.responded_at = new Date().toISOString();
  }
  res.json(notif || {});
});

// Alias for schedules listing
app.get('/api/schedules', (_req: Request, res: Response) => {
  res.json(schedules);
});

// Catch-all for undefined API routes to return valid JSON error instead of HTML
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ detail: `API route ${req.method} ${req.path} not found` });
});

app.use((error: Error & { status?: number }, _req: Request, res: Response, _next: (error?: unknown) => void) => {
  if (error.status === 401) {
    return res.status(401).json({ detail: 'Authentication required' });
  }
  console.error(error);
  return res.status(500).json({ detail: 'Internal server error' });
});

// ==================== Frontend Vite / Static Integration ====================
await initializeDatabase();

if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, host: HOST, port: PORT },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Smart Classroom server running at http://${HOST}:${PORT}`);
});
