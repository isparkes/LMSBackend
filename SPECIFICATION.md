# LMS Training Backend — Specification

## Overview

A Learning Management System backend that delivers lessons (video, text, PDF, multiple-choice quizzes) organized into Modules within Courses. Learners register, authenticate via JWT, consume content, and have their progress tracked. Quizzes support configurable pass marks and attempt limits. Admins manage all content, view user progress, and can reset quiz attempts.

Course access uses a hybrid enrollment model: courses with `requireEnrollment: false` are open to all learners; courses with `requireEnrollment: true` are visible only to explicitly enrolled learners. Admins are always exempt from enrollment checks.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | NestJS 11 (TypeScript, strict mode) |
| Database | PostgreSQL 16 via TypeORM 0.3 |
| Auth | JWT (passport-jwt, bcrypt) |
| Validation | class-validator, class-transformer |
| File uploads | Multer (local disk storage) |
| Email | nodemailer (SMTP) |
| Runtime | Node.js |

## Data Model

### Entity Relationship Diagram

```
User (1) ──< UserProgress >── (1) Lesson
User (1) ──< QuizAttempt >── (1) Lesson
User (1) ──< Enrollment >── (1) Course
User (1) ──< PasswordResetToken
Course (1) ──< CourseModule (1) ──< Lesson (1) ──< QuizQuestion
```

### User

Table: `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| email | varchar | unique, not null | |
| passwordHash | varchar | not null | bcrypt, 10 salt rounds. Never returned in responses. |
| firstName | varchar | not null | |
| lastName | varchar | not null | |
| role | enum | not null, default `learner` | `admin` or `learner` |
| lastLoginAt | timestamp | nullable | Updated on login and throttled (5-min interval) on any authenticated request |
| createdAt | timestamp | auto-generated | |
| updatedAt | timestamp | auto-updated | |

### Course

Table: `courses`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| title | varchar | not null | |
| description | text | nullable | |
| thumbnail | varchar | nullable | |
| isPublished | boolean | not null, default `false` | Learners only see published courses |
| requireEnrollment | boolean | not null, default `false` | When `true`, only explicitly enrolled learners can access this course |
| ordering | int | not null, default `0` | Sort order |
| createdAt | timestamp | auto-generated | |
| updatedAt | timestamp | auto-updated | |

**Relations:** Has many `CourseModule` (cascade delete). Has many `Enrollment` (cascade delete).

### CourseModule

Table: `modules`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| courseId | UUID | FK → courses.id, ON DELETE CASCADE | |
| title | varchar | not null | |
| description | text | nullable | |
| order | int | not null, default `0` | Sort order within course |
| createdAt | timestamp | auto-generated | |
| updatedAt | timestamp | auto-updated | |

**Relations:** Belongs to `Course`. Has many `Lesson` (cascade delete).

### Lesson

Table: `lessons`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| moduleId | UUID | FK → modules.id, ON DELETE CASCADE | |
| title | varchar | not null | |
| type | enum | not null | `video`, `text`, `quiz`, or `pdf` |
| order | int | not null, default `0` | Sort order within module |
| content | text | nullable | Required when type = `text` |
| videoFilename | varchar | nullable | Required when type = `video` |
| pdfFilename | varchar | nullable | Required when type = `pdf` |
| notes | text | nullable | Optional HTML notes, available on all lesson types. Plain URLs are auto-linked in the frontend. |
| passMarkPercentage | int | not null, default `0` | Quiz only. 0 = no pass requirement. 1–100 = minimum score to pass. |
| maxAttempts | int | not null, default `0` | Quiz only. 0 = unlimited attempts. >0 = max number of quiz submissions allowed. |
| randomizeQuestions | boolean | not null, default `false` | Quiz only. When true, questions are presented in random order for each attempt. |
| randomizeAnswers | boolean | not null, default `false` | Quiz only. When true, answer options are presented in random order for each attempt. |
| showCorrectAnswers | boolean | not null, default `true` | Quiz only. When false, learners only see their final score after submission — no per-question correct/incorrect marking. |
| createdAt | timestamp | auto-generated | |
| updatedAt | timestamp | auto-updated | |

**Relations:** Belongs to `CourseModule`. Has many `QuizQuestion` (cascade delete). Has many `QuizAttempt` (cascade delete).

### QuizQuestion

Table: `quiz_questions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| lessonId | UUID | FK → lessons.id, ON DELETE CASCADE | |
| questionText | text | not null | |
| options | jsonb | not null | Array of strings, minimum 2 |
| correctOptionIndex | int | not null | 0-based index into options (single-select) |
| multiSelect | boolean | not null, default `false` | When true, multiple correct answers |
| correctOptionIndices | jsonb | nullable | Array of correct indices (multi-select) |
| order | int | not null, default `0` | Sort order within quiz |
| createdAt | timestamp | auto-generated | |
| updatedAt | timestamp | auto-updated | |

**Invariants:**
- Single-select (`multiSelect = false`): `correctOptionIndex` must be `< options.length`.
- Multi-select (`multiSelect = true`): all values in `correctOptionIndices` must be valid indices within `options`, and at least one must be provided. All correct answers must be selected (and no incorrect ones) for the question to be marked correct.

### UserProgress

Table: `user_progress`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| userId | UUID | PK, FK → users.id, ON DELETE CASCADE | Composite PK with lessonId |
| lessonId | UUID | PK, FK → lessons.id, ON DELETE CASCADE | Composite PK with userId |
| completed | boolean | not null, default `false` | |
| score | float | nullable | 0.0–1.0 for quizzes, null for non-quiz |
| completedAt | timestamp | nullable | Set when completed |
| createdAt | timestamp | auto-generated | |

### QuizAttempt

Table: `quiz_attempts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| userId | UUID | FK → users.id, ON DELETE CASCADE | |
| lessonId | UUID | FK → lessons.id, ON DELETE CASCADE | |
| score | float | not null | 0.0–1.0 |
| passed | boolean | not null | Whether score met the pass mark |
| answers | jsonb | not null | Array of `{ questionId, selectedOptionIndex, selectedOptionIndices, correctOptionIndex, correctOptionIndices, multiSelect, isCorrect }` |
| createdAt | timestamp | auto-generated | |

**Relations:** Belongs to `User`. Belongs to `Lesson`.

**When recorded:** Attempts are only recorded when `passMarkPercentage > 0` or `maxAttempts > 0` on the lesson.

### Enrollment

Table: `enrollments`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| userId | UUID | PK, FK → users.id, ON DELETE CASCADE | Composite PK with courseId |
| courseId | UUID | PK, FK → courses.id, ON DELETE CASCADE | Composite PK with userId |
| status | enum | not null, default `active` | `active`, `completed`, or `unenrolled` |
| enrolledAt | timestamp | auto-generated | |
| completedAt | timestamp | nullable | Set when status becomes `completed` |
| unenrolledAt | timestamp | nullable | Set when status becomes `unenrolled` |

**Relations:** Belongs to `User`. Belongs to `Course`.

**Composite PK** `(userId, courseId)` prevents duplicate active enrollments.

**Unenrollment** is a soft delete — the record is retained for audit purposes with `status = unenrolled`.

### PasswordResetToken

Table: `password_reset_tokens`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| userId | UUID | FK → users.id, ON DELETE CASCADE | |
| tokenHash | varchar | not null | bcrypt hash of the plain token. Never returned in responses. |
| expiresAt | timestamp | not null | 1 hour after creation |
| used | boolean | not null, default `false` | Marked `true` immediately on use |
| usedAt | timestamp | nullable | Set when token is consumed |
| createdAt | timestamp | auto-generated | |
| updatedAt | timestamp | auto-updated | |

**Relations:** Belongs to `User`.

**Token lifecycle:** A 64-character hex token is generated via `crypto.randomBytes(32)`, hashed with bcrypt, and stored. The plain token is emailed to the user. On reset, all active tokens in the database are compared against the submitted token; the first bcrypt match is accepted, immediately marked as used, and all remaining tokens for that user are also invalidated.

---

## Authentication

### Flow

1. Client sends `POST /api/auth/register` or `POST /api/auth/login`.
2. Server returns `{ accessToken, user }`.
3. Client includes `Authorization: Bearer <accessToken>` on all subsequent requests.
4. `JwtAuthGuard` validates the token and populates `request.user` with `{ id, email, role }`.
5. `RolesGuard` checks `@Roles()` metadata; if no roles specified, any authenticated user is allowed.

### JWT Payload

```json
{ "sub": "<userId>", "email": "<email>", "role": "admin|learner" }
```

### Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| JWT_SECRET | Yes | — | Signing key |
| JWT_EXPIRATION | No | `1d` | Token lifetime (e.g. `1d`, `24h`, `1w`) |

### Password Hashing

bcrypt with 10 salt rounds. The `passwordHash` field is excluded from all serialized responses via `@Exclude()`.

---

## Authorization (Role-Based Access Control)

| Action | Admin | Learner |
|--------|-------|---------|
| Register / Login | Yes | Yes |
| Request / complete password reset | Yes | Yes |
| View profile | Yes | Yes |
| List courses | All courses | Open published + enrolled restricted |
| View course detail | All courses | Open published + enrolled restricted |
| Create / Update / Delete courses | Yes | No (403) |
| Create / Update / Delete modules | Yes | No (403) |
| Create / Update / Delete lessons | Yes | No (403) |
| Create / Update / Delete quiz questions | Yes | No (403) |
| Upload videos / PDFs | Yes | No (403) |
| Submit quiz answers | Yes | Yes |
| Mark lesson complete | Yes | Yes |
| View course progress | Yes | Yes |
| View lesson detail (quiz answers hidden) | Sees correctOptionIndex/Indices | correctOptionIndex/Indices hidden |
| Create / Delete users | Yes | No (403) |
| List all users | Yes | No (403) |
| View single user | Yes | No (403) |
| Change user password | Yes | No (403) |
| Enroll / Unenroll users | Yes | No (403) |
| List enrollments (all or filtered) | Yes | No (403) |
| View own enrolled courses | Yes | Yes |
| View admin progress overview | Yes | No (403) |
| View user detailed progress | Yes | No (403) |
| Reset user quiz attempts | Yes | No (403) |
| Reset user course/module progress | Yes | No (403) |
| View quiz attempts (admin detail) | Yes | No (403) |
| View own quiz attempts (summary only) | Yes | Yes |

---

## API Endpoints

All routes are prefixed with `/api`. All parameters named `:id`, `:courseId`, `:moduleId`, `:lessonId` are validated as UUIDs.

### Auth

| Method | Route | Auth | Body | Response |
|--------|-------|------|------|----------|
| POST | `/auth/register` | None | `RegisterDto` | `{ accessToken, user }` |
| POST | `/auth/login` | None | `LoginDto` | `{ accessToken, user }` |
| GET | `/auth/profile` | JWT | — | `{ id, email, role }` |
| POST | `/auth/forgot-password` | None | `ForgotPasswordDto` | `{ message }` |
| POST | `/auth/reset-password` | None | `ResetPasswordDto` | `{ message }` |

**RegisterDto**

| Field | Type | Validation |
|-------|------|-----------|
| email | string | Valid email |
| password | string | 8–128 characters |
| firstName | string | 1–100 characters |
| lastName | string | 1–100 characters |

**LoginDto**

| Field | Type | Validation |
|-------|------|-----------|
| email | string | Valid email |
| password | string | Required |

**ForgotPasswordDto**

| Field | Type | Validation |
|-------|------|-----------|
| email | string | Valid email |

**ResetPasswordDto**

| Field | Type | Validation |
|-------|------|-----------|
| token | string | 32–128 characters (the hex token from the reset email) |
| newPassword | string | 8–128 characters |

**Password reset flow:**
1. Client sends `POST /auth/forgot-password` with the user's email.
2. Server generates a 64-character cryptographically random hex token, stores a bcrypt hash with a 1-hour expiry, and emails the plain token to the user as a reset link (`FRONTEND_URL/reset-password?token=<token>`).
3. The response is always `{ message: "If the email exists, a password reset link has been sent" }` — email existence is never revealed.
4. Client sends `POST /auth/reset-password` with the plain token and new password.
5. Server validates the token (not used, not expired), updates the password, marks the token used, and invalidates all other outstanding tokens for that user.

**Error responses:**
- 409 Conflict — email already registered (register)
- 401 Unauthorized — invalid credentials (login)
- 400 Bad Request — invalid or expired reset token (reset-password)

---

### Courses

| Method | Route | Auth | Role | Body | Response |
|--------|-------|------|------|------|----------|
| GET | `/courses` | JWT | Any | — | `Course[]` |
| GET | `/courses/:id` | JWT | Any | — | `Course` (with modules and lessons) |
| POST | `/courses` | JWT | Admin | `CreateCourseDto` | `Course` |
| PATCH | `/courses/:id` | JWT | Admin | `UpdateCourseDto` | `Course` |
| DELETE | `/courses/:id` | JWT | Admin | — | 204 No Content |

**CreateCourseDto**

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| title | string | Yes | — |
| description | string | No | — |
| thumbnail | string | No | — |
| isPublished | boolean | No | Default `false` |
| requireEnrollment | boolean | No | Default `false`. When `true`, only enrolled learners can access this course. |
| ordering | number | No | Integer >= 0 |

**UpdateCourseDto** — all fields from CreateCourseDto, all optional.

**Ordering:** Results sorted by `ordering ASC`, then `createdAt ASC`.

**Visibility (hybrid enrollment model):**
- Admins always see all courses.
- Learners see a course only if it is published **and** one of:
  - `requireEnrollment = false` — open to all learners.
  - `requireEnrollment = true` — learner has an active enrollment record.

**GET /:id response includes:** nested `modules[]`, each with nested `lessons[]`, all sorted by their `order` field.

---

### Modules

| Method | Route | Auth | Role | Body | Response |
|--------|-------|------|------|------|----------|
| GET | `/courses/:courseId/modules` | JWT | Any | — | `CourseModule[]` |
| GET | `/courses/:courseId/modules/:id` | JWT | Any | — | `CourseModule` (with lessons) |
| POST | `/courses/:courseId/modules` | JWT | Admin | `CreateModuleDto` | `CourseModule` |
| PATCH | `/courses/:courseId/modules/:id` | JWT | Admin | `UpdateModuleDto` | `CourseModule` |
| DELETE | `/courses/:courseId/modules/:id` | JWT | Admin | — | 204 No Content |

**CreateModuleDto**

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| title | string | Yes | — |
| description | string | No | — |
| order | number | No | Integer >= 0 |

**UpdateModuleDto** — all fields optional.

---

### Lessons

| Method | Route | Auth | Role | Body | Response |
|--------|-------|------|------|------|----------|
| GET | `/modules/:moduleId/lessons` | JWT | Any | — | `Lesson[]` |
| GET | `/modules/:moduleId/lessons/:id` | JWT | Any | — | `Lesson` (with quiz questions) |
| POST | `/modules/:moduleId/lessons` | JWT | Admin | `CreateLessonDto` | `Lesson` |
| PATCH | `/modules/:moduleId/lessons/:id` | JWT | Admin | `UpdateLessonDto` | `Lesson` |
| DELETE | `/modules/:moduleId/lessons/:id` | JWT | Admin | — | 204 No Content |

**CreateLessonDto**

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| title | string | Yes | — |
| type | enum | Yes | `video`, `text`, `quiz`, or `pdf` |
| order | number | No | Integer >= 0 |
| content | string | If type=`text` | Conditionally required |
| videoFilename | string | If type=`video` | Conditionally required |
| pdfFilename | string | If type=`pdf` | Conditionally required |
| notes | string | No | Optional HTML notes for any lesson type |
| passMarkPercentage | number | No | Quiz only. Integer 0–100. Default 0. |
| maxAttempts | number | No | Quiz only. Integer >= 0. Default 0 (unlimited). |
| randomizeQuestions | boolean | No | Quiz only. Default false. |
| randomizeAnswers | boolean | No | Quiz only. Default false. |
| showCorrectAnswers | boolean | No | Quiz only. Default true. |

**UpdateLessonDto** — all fields optional.

**Security:** When a learner fetches a quiz lesson, both `correctOptionIndex` and `correctOptionIndices` are stripped from each question.

---

### Quiz Questions & Attempts

| Method | Route | Auth | Role | Body | Response |
|--------|-------|------|------|------|----------|
| POST | `/lessons/:lessonId/questions` | JWT | Admin | `CreateQuestionDto` | `QuizQuestion` |
| PATCH | `/lessons/:lessonId/questions/:id` | JWT | Admin | `UpdateQuestionDto` | `QuizQuestion` |
| DELETE | `/lessons/:lessonId/questions/:id` | JWT | Admin | — | 204 No Content |
| POST | `/lessons/:lessonId/submit` | JWT | Any | `SubmitAnswersDto` | Quiz result |
| GET | `/lessons/:lessonId/attempts` | JWT | Any | — | Attempt summaries (current user) |
| GET | `/lessons/:lessonId/attempts/admin` | JWT | Admin | — | User attempt summaries |
| POST | `/lessons/:lessonId/reset-attempts/:userId` | JWT | Admin | — | `{ message }` |

**CreateQuestionDto**

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| questionText | string | Yes | — |
| options | string[] | Yes | Minimum 2 items |
| correctOptionIndex | number | Yes | Integer >= 0, must be valid index |
| multiSelect | boolean | No | Default `false` |
| correctOptionIndices | number[] | No | Required when `multiSelect = true`. All values must be valid indices. |
| order | number | No | Integer >= 0 |

**UpdateQuestionDto** — all fields optional.

**SubmitAnswersDto**

```json
{
  "answers": [
    { "questionId": "<uuid>", "selectedOptionIndex": 0 },
    { "questionId": "<uuid>", "selectedOptionIndices": [0, 2] }
  ]
}
```

For single-select questions, use `selectedOptionIndex`. For multi-select questions, use `selectedOptionIndices` (array).

**Quiz submission response:**

```json
{
  "totalQuestions": 5,
  "correctAnswers": 3,
  "score": 0.6,
  "passed": true,
  "passMarkPercentage": 70,
  "maxAttempts": 3,
  "attemptsTaken": 2,
  "showCorrectAnswers": true,
  "results": [
    {
      "questionId": "<uuid>",
      "selectedOptionIndex": 0,
      "correctOptionIndex": 0,
      "multiSelect": false,
      "isCorrect": true
    },
    {
      "questionId": "<uuid>",
      "selectedOptionIndices": [0, 2],
      "correctOptionIndices": [0, 2],
      "multiSelect": true,
      "isCorrect": true
    }
  ]
}
```

When `showCorrectAnswers` is `false` on the lesson, the `results` array is stripped: each item only contains `questionId`, `selectedOptionIndex`/`selectedOptionIndices`, and `multiSelect` — no `correctOptionIndex`, `correctOptionIndices`, or `isCorrect`.
```

**Admin attempt summary response** (`GET /lessons/:lessonId/attempts/admin`):

```json
[
  {
    "id": "<userId>",
    "name": "John Doe",
    "email": "john@example.com",
    "attemptCount": 2,
    "bestScore": 0.8,
    "passed": true
  }
]
```

**Learner attempt response** (`GET /lessons/:lessonId/attempts`): Returns only summary fields — `id`, `score`, `passed`, `createdAt`. The detailed `answers` array (containing `correctOptionIndex`, `isCorrect`, etc.) is stripped to prevent learners from extracting correct answers.

**Reset attempts** (`POST /lessons/:lessonId/reset-attempts/:userId`): Deletes all quiz attempts for the user on this lesson and resets their progress (completed = false, score = null).

**Business rules:**
- Questions can only be added to lessons with `type = quiz`.
- `correctOptionIndex` must be a valid index within `options`.
- Submitting answers requires at least one question to exist on the quiz.
- Each submitted `questionId` must belong to the specified lesson.
- `passed` is determined by: `passMarkPercentage === 0 || scorePercentage >= passMarkPercentage`.
- If `passMarkPercentage > 0` or `maxAttempts > 0`, a `QuizAttempt` record is saved on each submission.
- `UserProgress.completed` is only set to `true` if the quiz is passed.
- If `maxAttempts > 0` and the user has reached the limit, further submissions return 400.
- Admins can reset a user's attempts, allowing them to retake the quiz.

---

### Users (Admin)

| Method | Route | Auth | Role | Body | Response |
|--------|-------|------|------|------|----------|
| GET | `/users` | JWT | Admin | — | `User[]` (passwordHash excluded) |
| GET | `/users/:userId` | JWT | Admin | — | `User` (passwordHash excluded) |
| POST | `/users` | JWT | Admin | `CreateUserDto` | `User` |
| DELETE | `/users/:userId` | JWT | Admin | — | 204 No Content |
| PATCH | `/users/:userId/password` | JWT | Admin | `ChangePasswordDto` | 204 No Content |

Returns all users ordered by `createdAt DESC`.

**CreateUserDto**

| Field | Type | Validation |
|-------|------|-----------|
| email | string | Valid email, unique |
| password | string | 8–128 characters |
| firstName | string | 1–100 characters |
| lastName | string | 1–100 characters |
| role | enum | Optional. `admin` or `learner`. Default `learner`. |

**ChangePasswordDto**

| Field | Type | Validation |
|-------|------|-----------|
| password | string | 8–128 characters |

**Delete behaviour:** Cascade-deletes all related records — `UserProgress`, `QuizAttempt`, and `Enrollment`. An admin cannot delete their own account (400 Bad Request).

**Error responses:**
- 409 Conflict — email already registered (create)
- 400 Bad Request — attempting to delete own account

---

### Enrollments

| Method | Route | Auth | Role | Body | Response |
|--------|-------|------|------|------|----------|
| POST | `/enrollments` | JWT | Admin | `CreateEnrollmentDto` | `Enrollment` |
| POST | `/enrollments/bulk` | JWT | Admin | `BulkEnrollmentDto` | `{ enrolled[], skipped[] }` |
| GET | `/enrollments` | JWT | Admin | — | `Enrollment[]` (filterable) |
| GET | `/enrollments/my-courses` | JWT | Any | — | `Enrollment[]` with course relation (current user, active only) |
| GET | `/enrollments/user/:userId` | JWT | Admin | — | `Enrollment[]` with course relation |
| GET | `/enrollments/course/:courseId` | JWT | Admin | — | `Enrollment[]` with user relation |
| DELETE | `/enrollments/:userId/:courseId` | JWT | Admin | — | 204 No Content |

**CreateEnrollmentDto**

| Field | Type | Validation |
|-------|------|-----------|
| userId | string | Valid UUID |
| courseId | string | Valid UUID |

**BulkEnrollmentDto**

| Field | Type | Validation |
|-------|------|-----------|
| userIds | string[] | Array of valid UUIDs |
| courseId | string | Valid UUID |

**Bulk enroll response:**
```json
{
  "enrolled": [ /* Enrollment records created */ ],
  "skipped": [
    { "userId": "<uuid>", "reason": "Already enrolled" },
    { "userId": "<uuid>", "reason": "User not found" }
  ]
}
```

**GET /enrollments query parameters** (all optional):

| Parameter | Type | Description |
|-----------|------|-------------|
| userId | UUID | Filter by user |
| courseId | UUID | Filter by course |
| status | enum | Filter by status: `active`, `completed`, `unenrolled` |

**Unenroll behaviour** (`DELETE /enrollments/:userId/:courseId`): Soft delete — sets `status = unenrolled` and records `unenrolledAt`. The enrollment record is retained. Only active enrollments can be unenrolled (404 if no active enrollment found).

**Business rules:**
- Enrolling a user who is already actively enrolled returns 409 Conflict.
- Bulk enroll skips (rather than erroring on) duplicates and non-existent user IDs.
- Deleting a course or user cascade-deletes all their enrollment records.

---

### Progress

| Method | Route | Auth | Role | Body | Response |
|--------|-------|------|------|------|----------|
| POST | `/progress/complete` | JWT | Any | `MarkCompleteDto` | `UserProgress` |
| GET | `/progress/courses/:courseId` | JWT | Any | — | Course progress summary |
| GET | `/progress/admin/overview` | JWT | Admin | — | All users' progress across all courses |
| GET | `/progress/admin/users/:userId` | JWT | Admin | — | Detailed per-course/module/lesson progress for a user |
| DELETE | `/progress/admin/users/:userId/courses/:courseId` | JWT | Admin | — | Reset all progress and quiz attempts for user on course |
| DELETE | `/progress/admin/users/:userId/modules/:moduleId` | JWT | Admin | — | Reset all progress and quiz attempts for user on module |

**MarkCompleteDto**

| Field | Type | Validation |
|-------|------|-----------|
| lessonId | string | Valid UUID |

**Mark-complete rules:**
- Cannot be used for `quiz` type lessons (returns 400 — use quiz submission instead).
- Idempotent: calling again on an already-completed lesson returns the existing record unchanged.

**Course progress response:**

```json
{
  "courseId": "<uuid>",
  "courseTitle": "Course Name",
  "totalLessons": 12,
  "completedLessons": 7,
  "progressPercentage": 58,
  "modules": [
    {
      "moduleId": "<uuid>",
      "moduleTitle": "Module 1",
      "totalLessons": 4,
      "completedLessons": 3,
      "lessons": [
        {
          "lessonId": "<uuid>",
          "lessonTitle": "Intro Video",
          "lessonType": "video",
          "completed": true,
          "score": null,
          "completedAt": "2026-02-15T10:30:00.000Z",
          "passMarkPercentage": 0
        }
      ]
    }
  ]
}
```

`progressPercentage` is `Math.round((completedLessons / totalLessons) * 100)`, or 0 if no lessons exist.

`passMarkPercentage` is included for each lesson (non-zero only for quiz lessons). This is used by the frontend to implement quiz gating.

**Admin overview response** (`GET /progress/admin/overview`): Returns an array of all users with their per-course progress. Each user entry includes `userId`, `email`, `firstName`, `lastName`, `role`, `createdAt`, `lastLoginAt`, and a `courses` array with `courseId`, `courseTitle`, `totalLessons`, `completedLessons`, and `progressPercentage`.

**Admin user detail response** (`GET /progress/admin/users/:userId`): Returns an array of all courses with per-module, per-lesson breakdown. Quiz lessons include enriched data: `attemptCount`, `maxAttempts`, `passMarkPercentage`, `bestScore`, `passed`.

**Reset course/module progress** (`DELETE /progress/admin/users/:userId/courses/:courseId` and `.../modules/:moduleId`): Deletes all `UserProgress` and `QuizAttempt` records for the user across all lessons in the specified course or module.

### Quiz Gating (Lesson Locking)

Quizzes with `passMarkPercentage > 0` act as gates. All lessons after an unpassed quiz gate are locked — this applies across module boundaries within a course.

**Gating logic:** Iterate through all lessons in order (modules sorted by `order`, lessons within each module sorted by `order`). When an unpassed quiz with `passMarkPercentage > 0` is encountered, all subsequent lessons in the course are locked.

**Enforcement points (frontend only):**
- **Course detail page:** Locked lessons show a lock icon and are non-clickable.
- **Lesson sidebar:** Locked lessons show a lock icon and are non-clickable.
- **Lesson prev/next navigation:** The "next" button is disabled if the current lesson is an unpassed quiz gate, or if the next lesson is locked by a prior gate.

---

### File Uploads

#### Filename Strategy

Files are stored using a sanitized form of the original filename (not a UUID). Sanitization (`sanitizeFilename` in `uploads.config.ts`): trim → lowercase → replace `[^a-z0-9._-]` with `-` → deduplicate `-` → trim leading/trailing `-` → lowercase extension → fallback stem `file` if empty. Re-uploading a file with the same sanitized name silently overwrites the existing file.

#### Upload Endpoints

| Method | Route | Auth | Role | Form Field | Response |
|--------|-------|------|------|------------|----------|
| POST | `/uploads/video` | JWT | Admin | `video` (multipart) | Upload metadata |
| POST | `/uploads/pdf` | JWT | Admin | `pdf` (multipart) | Upload metadata |

**Video upload response:**

```json
{
  "filename": "lecture-1.mp4",
  "originalName": "lecture-1.mp4",
  "size": 52428800,
  "mimetype": "video/mp4"
}
```

**Video constraints:**
- Allowed MIME types: `video/mp4`, `video/webm`, `video/ogg`, `video/quicktime`
- Max file size: 100 MB
- Storage: `./uploads/videos/`

**PDF upload response:**

```json
{
  "filename": "handbook.pdf",
  "originalName": "handbook.pdf",
  "size": 2097152,
  "mimetype": "application/pdf"
}
```

**PDF constraints:**
- Allowed MIME types: `application/pdf`
- Max file size: 50 MB
- Storage: `./uploads/pdfs/`

#### Library Management Endpoints

| Method | Route | Auth | Role | Description |
|--------|-------|------|------|-------------|
| GET | `/uploads/videos` | JWT | Admin | List all video files with usage info |
| GET | `/uploads/pdfs` | JWT | Admin | List all PDF files with usage info |
| DELETE | `/uploads/videos/:filename` | JWT | Admin | Delete video file and nullify lesson refs |
| DELETE | `/uploads/pdfs/:filename` | JWT | Admin | Delete PDF file and nullify lesson refs |
| PATCH | `/uploads/videos/:filename/rename` | JWT | Admin | Rename video file and update lesson refs |
| PATCH | `/uploads/pdfs/:filename/rename` | JWT | Admin | Rename PDF file and update lesson refs |

**List response** (both GET endpoints):

```json
[
  {
    "filename": "lecture-1.mp4",
    "sizeBytes": 52428800,
    "uploadedAt": "2026-02-15T10:30:00.000Z",
    "usedByLessons": [
      { "id": "<uuid>", "title": "Intro Video" }
    ]
  }
]
```

Results are sorted by file modification time descending (most recently uploaded first). `usedByLessons` is derived from `LessonsService.findByVideoFilename` / `findByPdfFilename`.

**Rename request body:** `{ "newDisplayName": "new-name" }` — the display name is sanitized server-side and the original extension is preserved. Returns `{ "newFilename": "new-name.mp4" }`. Throws `409 Conflict` if a file with the new name already exists. Updates all lesson `videoFilename`/`pdfFilename` references atomically (rename first, DB update second).

**Delete behaviour:** Nullifies all lesson `videoFilename`/`pdfFilename` references in the database before unlinking the file from disk, so no lesson is ever left with a dangling reference.

#### LessonsService — Filename Methods

Four methods added to support the upload management endpoints:

| Method | Description |
|--------|-------------|
| `findByVideoFilename(filename)` | Find all lessons with `videoFilename = filename` |
| `findByPdfFilename(filename)` | Find all lessons with `pdfFilename = filename` |
| `updateVideoFilename(old, new)` | Bulk-update `videoFilename` from `old` to `new` (or `null`) |
| `updatePdfFilename(old, new)` | Bulk-update `pdfFilename` from `old` to `new` (or `null`) |

### Static File Serving

Uploaded files are served at `/uploads/*` (no `/api` prefix). For example:
```
GET /uploads/videos/lecture-1.mp4
GET /uploads/pdfs/handbook.pdf
```

---

## Global Configuration

### Validation Pipe

Applied globally to all endpoints:
- `whitelist: true` — strips properties not defined in the DTO
- `forbidNonWhitelisted: true` — returns 400 if unknown properties are sent
- `transform: true` — auto-transforms request payloads to DTO class instances

### CORS

Enabled with `origin: true` (all origins) and `credentials: true`.

### Global Route Prefix

All controller routes are prefixed with `/api`.

---

## Error Responses

Standard NestJS HTTP exceptions are used throughout:

| Status | When |
|--------|------|
| 400 Bad Request | Validation failure; invalid quiz submission; wrong lesson type; invalid file type on upload; self-deletion attempt; invalid or expired reset token |
| 401 Unauthorized | Missing/invalid JWT; wrong credentials |
| 403 Forbidden | Learner accessing admin-only endpoint |
| 404 Not Found | Entity does not exist (or inaccessible course for learner); active enrollment not found |
| 409 Conflict | Duplicate email on registration; file rename conflicts with existing file; duplicate active enrollment |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DB_HOST | No | `localhost` | PostgreSQL host |
| DB_PORT | No | `5432` | PostgreSQL port |
| DB_USERNAME | Yes | — | Database user |
| DB_PASSWORD | Yes | — | Database password |
| DB_NAME | Yes | — | Database name |
| JWT_SECRET | Yes | — | JWT signing key |
| JWT_EXPIRATION | No | `1d` | Token lifetime |
| PORT | No | `3000` | Server listen port |
| SMTP_HOST | Yes | — | SMTP server hostname |
| SMTP_PORT | No | `587` | SMTP server port |
| SMTP_SECURE | No | `false` | Use TLS (`true` for port 465) |
| SMTP_USER | Yes | — | SMTP login username |
| SMTP_PASSWORD | Yes | — | SMTP login password |
| SMTP_FROM | Yes | — | Sender address for outbound email |
| FRONTEND_URL | Yes | — | Base URL of the frontend (used in password reset links) |

---

## Running the Application

```bash
# Start PostgreSQL
docker compose up -d

# Install dependencies
npm install

# Start in development mode (with hot reload)
npm run start:dev

# Seed the admin user (admin@example.com / admin123)
npm run seed:admin

# Build for production
npm run build
npm run start:prod
```

---

## Project Structure

```
src/
├── app.module.ts                    Root module
├── main.ts                          Bootstrap and global config
├── config/
│   └── database.config.ts           TypeORM configuration
├── common/
│   ├── entities/
│   │   └── base.entity.ts           Abstract base (id, createdAt, updatedAt)
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   └── guards/
│       ├── jwt-auth.guard.ts
│       └── roles.guard.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   ├── entities/
│   │   └── password-reset-token.entity.ts
│   └── dto/
│       ├── register.dto.ts
│       ├── login.dto.ts
│       ├── forgot-password.dto.ts
│       └── reset-password.dto.ts
├── email/
│   ├── email.module.ts
│   ├── email.service.ts
│   └── templates/
│       └── password-reset.template.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── entities/
│   │   └── user.entity.ts
│   └── dto/
│       └── create-user.dto.ts
├── courses/
│   ├── courses.module.ts
│   ├── courses.controller.ts
│   ├── courses.service.ts
│   ├── entities/
│   │   └── course.entity.ts
│   └── dto/
│       ├── create-course.dto.ts
│       └── update-course.dto.ts
├── modules/
│   ├── modules.module.ts
│   ├── modules.controller.ts
│   ├── modules.service.ts
│   ├── entities/
│   │   └── module.entity.ts
│   └── dto/
│       ├── create-module.dto.ts
│       └── update-module.dto.ts
├── lessons/
│   ├── lessons.module.ts
│   ├── lessons.controller.ts
│   ├── lessons.service.ts
│   ├── entities/
│   │   └── lesson.entity.ts
│   └── dto/
│       ├── create-lesson.dto.ts
│       └── update-lesson.dto.ts
├── quiz/
│   ├── quiz.module.ts
│   ├── quiz.controller.ts
│   ├── quiz.service.ts
│   ├── entities/
│   │   ├── quiz-question.entity.ts
│   │   └── quiz-attempt.entity.ts
│   └── dto/
│       ├── create-question.dto.ts
│       ├── update-question.dto.ts
│       └── submit-answers.dto.ts
├── progress/
│   ├── progress.module.ts
│   ├── progress.controller.ts
│   ├── progress.service.ts
│   ├── entities/
│   │   └── user-progress.entity.ts
│   └── dto/
│       └── mark-complete.dto.ts
├── enrollments/
│   ├── enrollments.module.ts
│   ├── enrollments.controller.ts
│   ├── enrollments.service.ts
│   ├── entities/
│   │   └── enrollment.entity.ts
│   └── dto/
│       ├── create-enrollment.dto.ts
│       ├── bulk-enrollment.dto.ts
│       └── query-enrollment.dto.ts
├── uploads/
│   ├── uploads.module.ts
│   ├── uploads.controller.ts
│   └── uploads.config.ts
└── seeds/
    └── admin.seed.ts
```
