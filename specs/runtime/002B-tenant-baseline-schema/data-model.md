# Data Model: Tenant Baseline Schema

**Purpose**: Define all entities, relationships, validation rules, and state transitions for baseline schema

**Version**: 1.0.0  
**Created**: 2026-02-16

---

## Entity Definition Format

```
Entity Name:
  - Type: Business entity | System entity | Junction table
  - Purpose: What it represents
  - Attributes: List with types and constraints
  - Relationships: Links to other entities
  - Validation: Business rules
  - State Transitions: If applicable
```

---

## Identity Layer

### Entity: User

- **Type**: Business entity
- **Purpose**: System user (student, instructor, admin)
- **Attributes**:
  - id (UUID, PK): Unique user identifier
  - email (VARCHAR 255, UNIQUE, NOT NULL): User email
  - name (VARCHAR 255, NOT NULL): Display name
  - profile_picture_url (TEXT, NULLABLE): Avatar
  - created_at (TIMESTAMPTZ, DEFAULT now()): Creation time
  - updated_at (TIMESTAMPTZ, DEFAULT now()): Last modification
  - created_by (UUID, NULLABLE): Admin who created
  - updated_by (UUID, NULLABLE): Admin who modified
  - is_deleted (BOOLEAN, DEFAULT false): Soft delete flag
- **Relationships**:
  - Role: Many-to-Many via role_assignments
  - Attempts: One-to-Many (user creates attempts)
  - Notifications: One-to-Many (user receives notifications)
- **Validation**:
  - Email must be valid format
  - Email unique within workspace
  - Name non-empty
- **State Transitions**: Active → Deleted (soft delete)

### Entity: Role

- **Type**: Business entity
- **Purpose**: Permission group (Student, Instructor, Admin)
- **Attributes**:
  - id (UUID, PK)
  - code (VARCHAR 50, UNIQUE, NOT NULL): Machine name (STUDENT, INSTRUCTOR, ADMIN)
  - name (VARCHAR 255, NOT NULL): Display name
  - description (TEXT, NULLABLE): Role purpose
  - created_at (TIMESTAMPTZ, DEFAULT now())
  - updated_at (TIMESTAMPTZ, DEFAULT now())
  - is_deleted (BOOLEAN, DEFAULT false)
- **Relationships**:
  - Permissions: One-to-Many via role_permissions
  - Users: Many-to-Many via role_assignments
- **Validation**:
  - Code immutable (no updates after creation)
  - Predefined roles: STUDENT, INSTRUCTOR, ADMIN

### Entity: Role_Permissions

- **Type**: Junction table
- **Purpose**: Maps permissions to roles
- **Attributes**:
  - id (UUID, PK)
  - role_id (UUID, FK → roles, NOT NULL, ON DELETE CASCADE)
  - permission_code (VARCHAR 100, NOT NULL): e.g., "exam:submit", "exam:grade"
  - created_at (TIMESTAMPTZ, DEFAULT now())
  - is_deleted (BOOLEAN, DEFAULT false)
- **Relationships**:
  - Role: Many-to-One
- **Validation**:
  - permission_code format: `{resource}:{action}`
  - Unique constraint (role_id, permission_code)

---

## Academic Structure

### Entity: Division

- **Type**: Business entity
- **Purpose**: Academic division (Faculty of Science, Faculty of Arts)
- **Attributes**:
  - id (UUID, PK)
  - name (VARCHAR 255, NOT NULL)
  - code (VARCHAR 50, UNIQUE, NOT NULL)
  - description (TEXT, NULLABLE)
  - created_at, updated_at, created_by, updated_by, is_deleted
- **Relationships**:
  - Departments: One-to-Many
  - Hierarchy: Self-referential parent_division_id (optional)
- **Validation**:
  - Code unique, non-empty
  - Name non-empty

### Entity: Department

- **Type**: Business entity
- **Purpose**: Department within division (Mathematics, Physics)
- **Attributes**:
  - id, division_id (FK → divisions, ON DELETE RESTRICT), name, code, description, timestamps
- **Relationships**:
  - Division: Many-to-One
  - Groups: One-to-Many
  - Subjects: One-to-Many
- **Validation**:
  - Code unique within division
  - division_id must exist

### Entity: Group

- **Type**: Business entity
- **Purpose**: Student cohort (Section A, Section B, Class 2026)
- **Attributes**:
  - id, name, code, department_id (FK), academic_year (INT), max_capacity (INT), timestamps
- **Relationships**:
  - Department: Many-to-One
  - Students: Many-to-Many via group_memberships
- **Validation**:
  - max_capacity > 0
  - academic_year format: YYYY

### Entity: Semester

- **Type**: Business entity
- **Purpose**: Academic period (Fall 2026, Spring 2026)
- **Attributes**:
  - id, name, code, start_date (DATE), end_date (DATE), is_active (BOOLEAN), timestamps
- **Relationships**:
  - Scheduled_Exams: One-to-Many
- **Validation**:
  - end_date > start_date
  - Unique active semester per academic year

### Entity: Subject

- **Type**: Business entity
- **Purpose**: Course/subject (Mathematics 101, Physics 201)
- **Attributes**:
  - id, name, code, description, department_id (FK), credit_hours (DECIMAL), timestamps
- **Relationships**:
  - Department: Many-to-One
  - Lessons: One-to-Many
  - Exams: One-to-Many
- **Validation**:
  - Code unique within department
  - credit_hours >= 0

### Entity: Lesson

- **Type**: Business entity
- **Purpose**: Lesson/chapter (Chapter 1: Introduction to Calculus)
- **Attributes**:
  - id, subject_id (FK), title, description, lesson_number (INT), duration_minutes (INT), timestamps
- **Relationships**:
  - Subject: Many-to-One
  - Questions: One-to-Many (lesson questions)
- **Validation**:
  - lesson_number unique per subject
  - duration_minutes > 0

---

## Classification

### Entity: Category

- **Type**: Business entity
- **Purpose**: Question/topic category (Algebra, Trigonometry)
- **Attributes**:
  - id, name, code, description, subject_id (FK, NULLABLE), timestamps
- **Relationships**:
  - Category_Values: One-to-Many
  - Subject: Many-to-One (optional)
- **Validation**:
  - Code unique within subject (if subject_id provided)

### Entity: Category_Value

- **Type**: Business entity
- **Purpose**: Category option (Algebra → Linear Equations, Quadratic Equations)
- **Attributes**:
  - id, category_id (FK, ON DELETE CASCADE), value (VARCHAR), sequence (INT), timestamps
- **Relationships**:
  - Category: Many-to-One
- **Validation**:
  - value unique per category
  - sequence ≥ 1

### Entity: Tag

- **Type**: Business entity
- **Purpose**: Question label (difficult, high-yield, commonly-missed)
- **Attributes**:
  - id, name, code (UNIQUE), color_hex (VARCHAR 6), timestamps
- **Relationships**:
  - Questions: Many-to-Many via question_tags
- **Validation**:
  - color_hex matches pattern: [0-9A-Fa-f]{6}

### Entity: MCQ_Basket

- **Type**: Business entity
- **Purpose**: Reusable question pools (question bank)
- **Attributes**:
  - id, subject_id (FK), name, description, total_questions (INT), timestamps
- **Relationships**:
  - Subject: Many-to-One
  - Questions: Many-to-Many via basket_questions
- **Validation**:
  - total_questions read-only (calculated from basket_questions count)

---

## Exam Engine

### Entity: MCQ_Question

- **Type**: Business entity
- **Purpose**: Multiple choice question
- **Attributes**:
  - id, subject_id (FK), category_id (FK, NULLABLE), lesson_id (FK, NULLABLE)
  - question_text (TEXT, NOT NULL)
  - explanation (TEXT, NULLABLE)
  - options (JSONB): "[{text: '...', is_correct: true}, ...]"
  - difficulty (ENUM: EASY, MEDIUM, HARD)
  - bloom_level (ENUM: REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE, CREATE)
  - timestamps
- **Relationships**:
  - Subject: Many-to-One
  - Category: Many-to-One (optional)
  - Lesson: Many-to-One (optional)
  - Exams: Many-to-Many via exam_questions
- **Validation**:
  - question_text non-empty
  - options array min 2, max 5 items
  - exactly 1 option with is_correct=true
  - difficulty in enum

### Entity: Traditional_Question

- **Type**: Business entity
- **Purpose**: Essay/short answer question
- **Attributes**:
  - id, subject_id (FK), lesson_id (FK, NULLABLE)
  - question_text (TEXT, NOT NULL)
  - sample_answer (TEXT, NULLABLE): Instructional text (not grading key)
  - max_score (INT, DEFAULT 10)
  - timestamps
- **Relationships**:
  - Subject: Many-to-One
  - Exams: Many-to-Many via exam_questions
- **Validation**:
  - max_score > 0

### Entity: MCQ_Exam

- **Type**: Business entity
- **Purpose**: Exam configuration with MCQ questions
- **Attributes**:
  - id, subject_id (FK), name, description
  - total_questions (INT)
  - passing_score (INT): Minimum to pass
  - time_limit_minutes (INT)
  - grading_type (ENUM: AUTO, MANUAL, HYBRID)
  - is_published (BOOLEAN, DEFAULT false)
  - timestamps
- **Relationships**:
  - Subject: Many-to-One
  - Scheduled_Exams: One-to-Many
  - Questions: Many-to-Many via exam_questions
- **Validation**:
  - passing_score ≤ 100
  - time_limit_minutes > 0
  - total_questions consistent with exam_questions count

### Entity: Traditional_Exam

- **Type**: Business entity
- **Purpose**: Exam with essay/short answer questions
- **Attributes**:
  - id, subject_id (FK), name, description
  - total_questions (INT)
  - max_score (INT)
  - time_limit_minutes (INT)
  - grading_type (ENUM: MANUAL, RUBRIC)
  - timestamps
- **Relationships**:
  - Subject: Many-to-One
  - Questions: Many-to-Many via exam_questions
- **Validation**:
  - time_limit_minutes > 0
  - max_score > 0

### Entity: Scheduled_Exam

- **Type**: Business entity
- **Purpose**: Exam instance (when/where exam occurs)
- **Attributes**:
  - id, mcq_exam_id (FK, NULLABLE), traditional_exam_id (FK, NULLABLE)
  - semester_id (FK), group_id (FK, NULLABLE)
  - scheduled_date (DATE, NOT NULL)
  - scheduled_time (TIME, NOT NULL)
  - duration_minutes (INT)
  - location (VARCHAR, NULLABLE)
  - max_attempts (INT, DEFAULT 1)
  - show_results (BOOLEAN, DEFAULT true)
  - timestamps
- **Relationships**:
  - MCQ_Exam: Many-to-One (optional)
  - Traditional_Exam: Many-to-One (optional)
  - Semester: Many-to-One
  - Group: Many-to-One (optional)
  - Attempts: One-to-Many
- **Validation**:
  - Exactly one of mcq_exam_id or traditional_exam_id (not both, not neither)
  - scheduled_date ≥ today
  - One of exam types must be non-null
  - Check: (mcq_exam_id IS NOT NULL AND traditional_exam_id IS NULL) OR (mcq_exam_id IS NULL AND traditional_exam_id IS NOT NULL)

---

## Runtime

### Entity: Attempt

- **Type**: Business entity (lifecycle: IN_PROGRESS → SUBMITTED → GRADED)
- **Purpose**: Student exam submission
- **Attributes**:
  - id (UUID, PK)
  - exam_id (FK → scheduled_exams, ON DELETE RESTRICT)
  - user_id (FK → users, ON DELETE RESTRICT)
  - configuration_snapshot (JSONB, NOT NULL): Exam config at attempt start (immutable)
  - question_list_snapshot (JSONB, NOT NULL): Question order at start (immutable)
  - grading_config_snapshot (JSONB, NOT NULL): Grading rules at start (immutable)
  - status (ENUM: IN_PROGRESS, SUBMITTED, GRADED, ARCHIVED)
  - started_at (TIMESTAMPTZ, NOT NULL): Server time
  - submitted_at (TIMESTAMPTZ, NULLABLE): Server time when worker finalized
  - duration_seconds (INT, NULLABLE): Calculated by worker
  - submission_deadline_at (TIMESTAMPTZ, NOT NULL): Server-side deadline
  - server_time_at_submission (TIMESTAMPTZ, NULLABLE): For drift validation
  - score (DECIMAL, NULLABLE): Final score (0-100)
  - created_at, updated_at, created_by, updated_by, is_deleted
- **Relationships**:
  - ScheduledExam: Many-to-One
  - User: Many-to-One
  - Attempt_Answers: One-to-Many (ON DELETE CASCADE)
  - Attempt_Events: One-to-Many (ON DELETE CASCADE)
- **Validation**:
  - configuration_snapshot, question_list_snapshot, grading_config_snapshot IMMUTABLE (no updates)
  - submission_deadline_at > started_at
  - status transitions: IN_PROGRESS → SUBMITTED → GRADED → ARCHIVED (no backtrack)
  - Unique: (exam_id, user_id, started_at) for active attempts
- **State Transitions**:
  - IN_PROGRESS: Student answering questions
  - SUBMITTED: Student submitted, waiting for grading (worker processing)
  - GRADED: Worker completed grading, results final
  - ARCHIVED: Attempt old or manually archived

### Entity: Attempt_Answer

- **Type**: Business entity
- **Purpose**: Single question answer within attempt
- **Attributes**:
  - id, attempt_id (FK, ON DELETE CASCADE), question_id (UUID, NOT NULL)
  - submitted_answer (JSONB, NOT NULL): Answer data (format varies: MCQ → {option_index: 2}, Essay → {text: "..."})
  - submitted_at (TIMESTAMPTZ, NOT NULL): When student submitted this answer
  - submission_order (INT, NOT NULL): Chronological order within attempt
  - is_correct (BOOLEAN, NULLABLE): Set by grader post-submission
  - score (DECIMAL, NULLABLE): Points earned
  - created_at, updated_at, created_by, updated_by, is_deleted
- **Relationships**:
  - Attempt: Many-to-One
  - Question: Denormalized (not FK to respect snapshot)
- **Validation**:
  - Unique: (attempt_id, question_id) — one answer per question per attempt
  - is_correct immutable after grading complete
  - submission_order ≥ 1
- **Notes**: question_id denormalized (not foreign key) to preserve snapshot integrity; actual question details stored in attempt.question_list_snapshot

### Entity: Attempt_Event

- **Type**: System entity (append-only audit trail)
- **Purpose**: Immutable event log for attempt lifecycle
- **Attributes**:
  - id (UUID, PK)
  - attempt_id (FK → attempts, ON DELETE CASCADE)
  - event_type (ENUM: START, RESUME, PAUSE, ANSWER_SUBMIT, TIME_WARNING, SUBMIT_REQUEST, FINALIZED, GRADED, ARCHIVED)
  - event_payload (JSONB, NULLABLE): Event metadata (e.g., answer submitted, time warning at 5min)
  - occurred_at (TIMESTAMPTZ, NOT NULL): Server time when event occurred
  - created_at (TIMESTAMPTZ, DEFAULT now()): Log creation time
  - created_by (UUID, NULLABLE): Who triggered event (user or system)
  - is_deleted (BOOLEAN, DEFAULT false): Soft delete (usually false)
- **Relationships**:
  - Attempt: Many-to-One
- **Validation**:
  - NO updates allowed (immutable trigger enforces)
  - NO deletes allowed (immutable trigger enforces)
  - event_type in defined enum
  - occurred_at ≤ created_at
- **Notes**: Append-only; triggers prevent UPDATE/DELETE

---

## Commercial

### Entity: Subscription

- **Type**: Business entity
- **Purpose**: User workspace subscription (premium, basic)
- **Attributes**:
  - id, user_id (FK), plan_code (VARCHAR: BASIC, PREMIUM, ENTERPRISE)
  - status (ENUM: ACTIVE, PAUSED, CANCELLED)
  - billing_cycle_start (DATE), billing_cycle_end (DATE)
  - amount (NUMERIC 10,2): USD price (not float)
  - auto_renew (BOOLEAN, DEFAULT true)
  - created_at, updated_at, created_by, updated_by, is_deleted
- **Relationships**:
  - User: Many-to-One
  - Invoices: One-to-Many
  - SubscriptionEvents: One-to-Many
- **Validation**:
  - Unique: (user_id, status='ACTIVE') — one active subscription per user
  - billing_cycle_end > billing_cycle_start
  - amount ≥ 0

### Entity: Invoice

- **Type**: Business entity
- **Purpose**: Billing record
- **Attributes**:
  - id, subscription_id (FK), amount (NUMERIC), status (ENUM: PENDING, PAID, FAILED, REFUNDED)
  - due_date (DATE), paid_at (DATE, NULLABLE)
  - created_at, updated_at, created_by, updated_by, is_deleted
- **Relationships**:
  - Subscription: Many-to-One
- **Validation**:
  - amount > 0
  - paid_at ≥ due_date (if PAID)
  - Status transitions: PENDING → PAID/FAILED → REFUNDED (if applicable)

### Entity: Promocode

- **Type**: Business entity
- **Purpose**: Discount code
- **Attributes**:
  - id, code (VARCHAR 50, UNIQUE), discount_percent (INT), max_uses (INT), times_used (INT, DEFAULT 0)
  - expiry_date (DATE, NULLABLE)
  - is_active (BOOLEAN, DEFAULT true)
  - created_at, updated_at, is_deleted
- **Relationships**:
  - Subscriptions: Many-to-Many via subscription_promocodes
- **Validation**:
  - discount_percent: 0-100
  - times_used ≤ max_uses
  - expiry_date > today (if ACTIVE)

### Entity: Subscription_Event

- **Type**: System entity
- **Purpose**: Subscription lifecycle audit
- **Attributes**:
  - id, subscription_id (FK), event_type (ENUM: CREATED, ACTIVATED, RENEWED, PAUSED, CANCELLED, UPGRADED, DOWNGRADED)
  - details (JSONB, NULLABLE)
  - created_at, created_by, is_deleted
- **Relationships**:
  - Subscription: Many-to-One
- **Validation**:
  - Append-only (no updates/deletes)

---

## Communication

### Entity: Notification

- **Type**: Business entity
- **Purpose**: User alert (exam reminder, grade posted)
- **Attributes**:
  - id, user_id (FK), title, message, notification_type (ENUM: EXAM_REMINDER, GRADE_POSTED, ANNOUNCEMENT)
  - is_read (BOOLEAN, DEFAULT false), read_at (TIMESTAMPTZ, NULLABLE)
  - created_at, updated_at, is_deleted
- **Relationships**:
  - User: Many-to-One
- **Validation**:
  - read_at populated only if is_read=true

### Entity: Feedback

- **Type**: Business entity
- **Purpose**: User-generated feedback
- **Attributes**:
  - id, user_id (FK), feedback_type (ENUM: BUG_REPORT, FEATURE_REQUEST, GENERAL)
  - subject, message, attachments (JSONB)
  - status (ENUM: OPEN, ACKNOWLEDGED, RESOLVED)
  - created_at, updated_at, is_deleted
- **Relationships**:
  - User: Many-to-One
- **Validation**:
  - subject non-empty, message non-empty

### Entity: System_Feedback (Optional)

- **Type**: System entity
- **Purpose**: Zidney internal feedback
- **Attributes**:
  - id, workspace_id (FK), category (VARCHAR), message (TEXT), severity (ENUM: INFO, WARN, ERROR)
  - created_at, is_deleted
- **Relationships**:
  - Workspace: Many-to-One

---

## Media, Ads, Certificates, System

### Entity: Media_File

- **Type**: Business entity
- **Purpose**: Uploaded file (image, PDF, video)
- **Attributes**:
  - id, file_name (VARCHAR), mime_type (VARCHAR), file_url (TEXT), size_bytes (INT)
  - uploaded_by (UUID, FK → users)
  - created_at, updated_at, is_deleted
- **Relationships**:
  - User: Many-to-One
- **Validation**:
  - size_bytes > 0
  - MIME type in allowed list

### Entity: Ad

- **Type**: Business entity
- **Purpose**: In-app advertisement
- **Attributes**:
  - id, title, description, image_url, target_url, status (ENUM: DRAFT, ACTIVE, ARCHIVED)
  - start_date (DATE), end_date (DATE)
  - created_at, updated_at, is_deleted
- **Validation**:
  - end_date ≥ start_date

### Entity: Certificate

- **Type**: Business entity
- **Purpose**: Credential issued to user
- **Attributes**:
  - id, user_id (FK), template_id (FK), subject_id (FK, NULLABLE)
  - issue_date (DATE), expiry_date (DATE, NULLABLE)
  - unique_code (VARCHAR, UNIQUE): For verification
  - created_at, is_deleted
- **Relationships**:
  - User: Many-to-One
  - CertificateTemplate: Many-to-One
  - Subject: Many-to-One
- **Validation**:
  - issue_date ≤ expiry_date (if expiry_date provided)
  - unique_code non-empty

### Entity: Certificate_Template

- **Type**: Business entity
- **Purpose**: Certificate design template
- **Attributes**:
  - id, name, description, template_html (TEXT), created_at, updated_at, is_deleted
- **Relationships**:
  - Certificates: One-to-Many
- **Validation**:
  - template_html contains valid HTML/CSS

### Entity: Translation

- **Type**: System entity
- **Purpose**: i18n strings
- **Attributes**:
  - id, language_code (VARCHAR 5, e.g., "en_US"), key (VARCHAR), value (TEXT)
  - created_at, updated_at, is_deleted
- **Relationships**: None
- **Validation**:
  - Unique: (language_code, key)

### Entity: Schema_Version

- **Type**: System entity (single row)
- **Purpose**: Track database schema version
- **Attributes**:
  - version (VARCHAR 20, e.g., "1.0.0", PRIMARY KEY)
  - applied_at (TIMESTAMPTZ, NOT NULL)
  - checksum (VARCHAR 64, NOT NULL): SHA256 of migration file
- **Relationships**: None
- **Validation**:
  - Single row enforced (trigger)
  - version format: semantic version (X.Y.Z)
  - checksum non-empty, 64 chars (SHA256 hex)
- **Notes**: Updated only by migrations, never by application code

---

## Relationship Diagram (Text)

```
User → Roles (many-to-many via role_assignments)
User → Attempts (one-to-many)
User → Notifications (one-to-many)
User → Subscriptions (one-to-many)
User → Feedback (one-to-many)

ScheduledExam → MCQExam | TraditionalExam (one-to-one alternate)
ScheduledExam → Semester (many-to-one)
ScheduledExam → Group (many-to-one)
ScheduledExam → Attempts (one-to-many)

Attempt → User (many-to-one, ON DELETE RESTRICT)
Attempt → ScheduledExam (many-to-one, ON DELETE RESTRICT)
Attempt → AttemptAnswers (one-to-many, ON DELETE CASCADE)
Attempt → AttemptEvents (one-to-many, ON DELETE CASCADE)

AttemptAnswer → Attempt (many-to-one)
  Note: question_id denormalized (not FK) to preserve snapshot

AttemptEvent → Attempt (many-to-many from attempt perspective)
  Note: Append-only, immutable

Division → Departments (one-to-many)
Department → Groups (one-to-many)
Department → Subjects (one-to-many)
Semester → ScheduledExams (one-to-many)
Subject → Lessons (one-to-many)
Subject → MCQQuestions (one-to-many)
Subject → MCQExams (one-to-many)
Subject → TraditionalExams (one-to-many)

Category → CategoryValues (one-to-many)
MCQBasket → MCQQuestions (many-to-many via basket_questions)

Tag → MCQQuestions (many-to-many via question_tags)

Subscription → Invoices (one-to-many)
Subscription → SubscriptionEvents (one-to-many)
Subscription → Promocodes (many-to-many via subscription_promocodes)

Certificate → CertificateTemplate (many-to-one)
Certificate → User (many-to-one)
Certificate → Subject (many-to-one, optional)
```

---

## Audit Fields on All Tables

Every table (except schema_version, translation) includes:

- **id** (UUID PRIMARY KEY): Globally unique record identifier
- **created_at** (TIMESTAMPTZ DEFAULT now()): Creation timestamp (server time)
- **updated_at** (TIMESTAMPTZ DEFAULT now()): Last modification timestamp (server time)
- **created_by** (UUID NULLABLE): User who created (if applicable)
- **updated_by** (UUID NULLABLE): User who modified (if applicable)
- **is_deleted** (BOOLEAN DEFAULT false): Soft delete flag (no hard deletes)

---

## Validation Rules (Global)

1. **No composite primary keys**: All tables use single UUID id
2. **No NULL primary keys**: id always NOT NULL
3. **No hardcoded IDs**: All IDs generated as UUIDs (UUIDv7 recommended)
4. **No global IDs across tenants**: Each tenant has independent ID sequences
5. **No orphaned records**: Foreign keys enforce referential integrity
6. **Server time only**: All timestamps from PostgreSQL now()
7. **Soft delete only**: No hard deletes on runtime data (attempt, answers, events)
8. **Immutable snapshots**: Attempt snapshots (configuration, questions, grading) never updated
9. **Append-only audit**: Attempt_events append-only (triggers enforce)
10. **Atomic transactions**: Schema initialization, migrations, submissions all transactional

---

## State Machines

### Attempt Lifecycle

```
┌─────────────┐
│ IN_PROGRESS │  ← Started, student answering
└──────┬──────┘
       │ Student clicks Submit
       ↓
┌─────────────┐
│  SUBMITTED  │  ← Queued for grading (worker processing)
└──────┬──────┘
       │ Worker completed grading
       ↓
┌─────────────┐
│   GRADED    │  ← Final results available
└──────┬──────┘
       │ Auto-archive after retention period OR manual
       ↓
┌─────────────┐
│  ARCHIVED   │  ← Historical only
└─────────────┘

Note: No backtracking (no transitions backward)
```

### Subscription Lifecycle

```
┌─────────┐
│ ACTIVE  │  ← Actively billing
└────┬────┘
     │ pause() OR next renewal failure
     ↓
┌─────────┐
│ PAUSED  │  ← Suspended but could resume
└────┬────┘
     │ cancel()
     ↓
┌──────────┐
│CANCELLED │  ← Terminal state
└──────────┘

Alternate path:
ACTIVE → FAILED (payment expired) → CANCELLED
```

---

## Constraints Summary

| Constraint                           | Table                                      | Enforcement | Rationale                             |
| ------------------------------------ | ------------------------------------------ | ----------- | ------------------------------------- |
| UNIQUE(created_by)                   | N/A                                        | No          | users can be used as audit trail      |
| UNIQUE(email)                        | user                                       | YES         | user contact unique per workspace     |
| UNIQUE(code)                         | role, category, division, department, etc. | YES         | machine names unique per entity       |
| UNIQUE(exam_id, user_id, started_at) | attempts                                   | YES         | one essay per user per started time   |
| UNIQUE(attempt_id, question_id)      | attempt_answers                            | YES         | one answer per question               |
| CHECK(subscription status in [...])  | subscriptions                              | YES         | enum constraint                       |
| FOREIGN KEY ON DELETE RESTRICT       | user, exam in attempts                     | YES         | prevent orphaning active attempts     |
| FOREIGN KEY ON DELETE CASCADE        | attempts → attempt_answers/events          | YES         | clean up answers when attempt deleted |
| PRIMARY KEY (id)                     | All                                        | YES         | single UUID PK                        |
| DEFAULT now()                        | created_at, updated_at                     | YES         | server authoritative time             |

---

End of Data Model.
