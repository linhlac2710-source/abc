# Smart Classroom System

## 1. Project overview

Smart Classroom is an academic management platform with separate Student, Lecturer, and Admin experiences. It provides class and enrollment management, schedules, attendance, assignments, grades, quizzes, learning-risk analysis, personalized learning paths, and teaching-quality analytics.

The implemented application is a local full-stack system:

- React frontend with role-specific navigation
- Express REST API in `server.ts`
- PostgreSQL persistence through the `pg` driver
- JSONB-backed state stored in PostgreSQL; the state row is initialized automatically
- No seeded demo users or records

Analytics endpoints return empty/not-found responses until real records are available; the frontend does not substitute sample data.

## 2. Main features

### Basic features

- Registration and login
- JWT authentication and role-based access control
- User profiles
- Class catalog and enrollment
- Class schedules synchronized with the lecturer's class records; weekly values such as `Mon, Wed 09:00 - 10:30` create recurring timetable entries
- Attendance sessions, check-in, and records
- Assignment publishing and submissions
- Grades and weighted results
- Quiz metadata and quiz results

### Advanced features

- QR/time/location attendance support where configured by the attendance API
- Learning Risk Analysis
- Personalized Learning Path
- Teaching Quality Analytics

## Grade calculation

Grade components accept scores on either a 0-10 scale or a 0-100 scale. The system normalizes each score to 0-100, then calculates the weighted average using the component weights stored with the grade records. Attendance always has a 0% grade weight; it remains tracked for eligibility, while existing attendance grade records are normalized to weight `0`. Attendance alerts no longer override the component average or GPA. The lecturer settings keep attendance fixed at 0%, and all weight presets exclude it from the course-grade calculation. Assignment cards display the weight returned by the assignment API.

When a lecturer grades a submission, the API recalculates that student's Assignment component from all graded submissions in the class (weighted by each assignment's weight), upserts the grade record while preserving the course-level Assignment weight, and refreshes the lecturer's assignment and grade views. Existing graded submissions are also synchronized when class grades are read, and changing an assignment's score scale or weight recalculates affected student grades.

Student analytics count each assigned deliverable once, distinguish graded, submitted-for-review, pending, and late/missing work, and count a submission as completed even when it is late. Average grade and GPA are calculated only from courses with weighted graded components, using course credits; ungraded courses are excluded rather than counted as zero.

## Curriculum CSV for learning-path recommendations

The CSV must include the columns `course_code,course_name,semester,credits,prerequisites,course_group,related_courses`; separate multiple prerequisite or related course codes with semicolons.

When creating or editing a student in **Admin → Users**, the admin can attach or replace the same CSV format as that student's private learning-path curriculum. It is saved with that student and takes precedence over the shared curriculum for their recommendations. The upload is limited to 2 MB.

New accounts created by an admin receive the default password `12345678`. The password is stored as a hash and is not included in user API responses.

Student learning paths show only course recommendations from the assigned curriculum, not attendance, assignment, study-task, or grade-review cards. They remain available if the student has no approved class enrollment; in that case, eligible entry courses from the private curriculum can be suggested. When approved classes match curriculum course codes, recommendations are limited to related courses whose prerequisites are all among the student's approved classes. Courses are first sorted by the average grade of their graded related courses (excluding attendance), highest first. Ties and courses without a graded related course are then ordered by the overall weighted grade priority: below 5/10 is high, 5–under 7/10 is medium, and 7/10 or above is low. If no weighted grades are available, recommendations remain low priority.

## 3. Technology stack

### Frontend

- React
- TypeScript
- Vite

### API and Database

- Node.js and Express
- `pg` PostgreSQL driver
- PostgreSQL

### Analytics

- Existing backend analytics services and deterministic rule-based calculations
- No separate ML dependency is required by `backend/requirements.txt`

## 4. Architecture

```text
Browser
   |
React + TypeScript frontend
   |
REST API
   |
Express backend (server.ts)
   |
PostgreSQL JSONB state store
```

Analytics flow:

```text
Learning Analytics
   |
Risk Analysis
   |
Personalized Learning Path
   |
Teaching Quality Analytics
```

## 5. Project structure

```text
smart-classroom/
├── backend/
│   ├── app/
│   ├── tests/
│   ├── alembic/
│   ├── requirements.txt
│   ├── alembic.ini
│   └── .env.example
├── src/
│   ├── api/
│   ├── components/
│   ├── data/
│   └── utils/
├── public/
├── package.json
├── vite.config.ts
├── .env.example
└── README.md
```

## 6. Requirements

- Node.js and npm compatible with the installed Vite/TypeScript toolchain
- PostgreSQL 16 (or a compatible PostgreSQL server)

## 7. PostgreSQL setup (Windows PowerShell)

Create an empty database, for example:

```powershell
createdb -U postgres smart_classroom
```

Copy the environment template and set a local connection string in `.env`:

```powershell
Copy-Item .env.example .env
```

Set `DATABASE_URL` to `postgresql://USER:PASSWORD@HOST:5432/smart_classroom`. Keep real credentials only in `.env`; never commit them or paste them into chat. The API creates its empty `smart_classroom_state` table on startup.

Start the API and frontend together:

```powershell
npm install
npm run dev
```

Health check:

```text
http://localhost:3000/api/health
```

## 8. Frontend setup

From the project root:

```powershell
npm install
npm run dev
```

The Express API and Vite frontend are served together on port 3000; frontend requests use the same-origin `/api` routes.

Useful commands:

```powershell
npm run lint
npm run build
```

## 9. Running the complete system

1. Start PostgreSQL and create the database.
2. Configure `DATABASE_URL` in `.env`.
3. Run `npm run dev` and verify `/api/health` reports PostgreSQL connectivity.
4. Provision actual users through the account API/database; no accounts are pre-created.
5. Open `http://localhost:3000` and sign in with a provisioned account.

## 10. Database state

The current Express API stores its collections as JSONB in the PostgreSQL `smart_classroom_state` row. Requests are serialized and committed transactionally. This preserves the existing API contract but is not a normalized relational schema.

## 11. Testing and verified results

Checks:

```powershell
npm run lint
npm run build
```

Health:

```text
GET /api/health
```

The latest verified project results are:

- Frontend lint: PASS
- Frontend build: PASS
- PostgreSQL connection: requires a configured `DATABASE_URL`

### Student learning-risk levels

The student risk endpoint calculates a score from 0 to 1 using available class data:

- Attendance: 35%; uses the same class attendance calculation as the student's class grade/attendance summary, including half credit for late check-ins.
- Assignment submission rate: 35%; submitted or graded submissions are counted against all published assignments in the class. Overdue missing assignments are reported separately.
- Academic grade-component average: 30%; includes recorded non-attendance grade components with a positive weight, normalized to a 10-point scale.

The weights are normalized across metrics with data, so missing data is not treated as a zero. Scores below 0.30 are Low, scores from 0.30 to below 0.60 are Medium, and scores of 0.60 or higher are High. If no eligible activity exists, the API reports that there is not enough data instead of assigning a level. Attendance here is only a risk signal and does not contribute to course grades or GPA.

Lecturer Teaching Analytics calculates these assessments separately for every approved student enrollment in the selected class taught by that lecturer. It shows the class distribution and student-level metrics; students with no available inputs are excluded from the evaluated total.

### Student learning path

For an approved class enrollment, `GET /api/analytics/my-learning-path/:classId` generates and persists recommendations from that student's attendance, overdue/published assignments, and weighted grade components. Recommendations are prioritized, include an explanation and action steps, and retain their progress status when refreshed. Students can start or complete an item through `PATCH /api/analytics/my-learning-path/:classId/recommendations/:recommendationId` with `IN_PROGRESS` or `COMPLETED`. If learning data is not available yet, the path provides a data-collection recommendation rather than returning an empty path.

## 12. Roles

### Student

- Classes and class joining
- Schedule
- Attendance
- Assignments and submissions
- Grades
- Quizzes and own results
- Learning Risk
- Learning Path

### Lecturer

- Owned classes
- Enrollment management
- Schedule
- Attendance sessions and records
- Assignments and submissions
- Grades
- Quizzes and student results
- Teaching Analytics

### Admin

- Dashboard
- Class management
- Users UI
- System management UI

Admin user-management operations and telemetry/statistics are currently UI-only because matching backend APIs are not available.

## 13. API overview

The frontend uses these backend API groups:

- `/api/auth`
- `/api/classes`
- `/api/enrollments`
- `/api/schedules`
- `/api/attendance`
- `/api/assignments`
- `/api/grades`
- `/api/quizzes`
- `/api/analytics`
- `/api/health`

The backend remains authoritative for authentication and RBAC.

## 14. Known limitations

- Admin user-management backend APIs are not currently available.
- Admin telemetry/statistics backend APIs are not currently available.
- Quiz question-management and question-taking APIs are not currently available.
- Full browser automation for every authenticated flow is not implemented.
- Vite reports non-blocking warnings about `__dirname` configuration and bundle size.

## 15. Security and repository hygiene

- Use `backend/.env.example` as a template only.
- Keep `backend/.env` and all real secrets outside version control.
- Do not commit JWT secrets, database passwords, API keys, tokens, `.venv`, `node_modules`, `dist`, or test caches.
