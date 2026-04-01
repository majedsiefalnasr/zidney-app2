# Data Model — MCQ Exam Configuration

**Stage:** STAGE_36_MCQ_EXAM_CONFIG
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE
**Created:** 2026-04-01

---

## Entity Relationship Diagram (Text)

```
subjects
  │
  └──< mcq_exams (subject_id FK, RESTRICT)
         │
         ├── mcq_exam_settings (exam_id FK, UNIQUE, CASCADE)
         │
         ├──< mcq_exam_questions (exam_id FK, CASCADE)
         │       └── mcq_questions (question_id FK, RESTRICT)
         │
         └──< mcq_exam_auto_criteria (exam_id FK, CASCADE)
                   (lesson_ids uuid[], category_value_ids uuid[],
                    tag_ids uuid[], basket_ids uuid[])

divisions ──< mcq_exams (division_id FK, SET NULL)
```

---

## Table: mcq_exams

| Column                  | Type          | Constraints                                    | Notes                             |
| ----------------------- | ------------- | ---------------------------------------------- | --------------------------------- |
| id                      | uuid          | PK, default `gen_random_uuid()`                |                                   |
| subject_id              | uuid          | NOT NULL, FK → subjects.id ON DELETE RESTRICT  | Immutable after creation          |
| division_id             | uuid          | nullable, FK → divisions.id ON DELETE SET NULL |                                   |
| name                    | varchar(255)  | NOT NULL                                       |                                   |
| code                    | varchar(100)  | NOT NULL                                       | Unique per tenant (partial index) |
| description             | text          | nullable                                       |                                   |
| language                | varchar(10)   | NOT NULL                                       |                                   |
| total_questions         | integer       | NOT NULL                                       | CHECK > 0                         |
| duration_minutes        | integer       | nullable                                       | Required if chrono mode enabled   |
| pass_type               | varchar(20)   | NOT NULL, CHECK IN ('PERCENTAGE', 'SCORE')     |                                   |
| pass_value              | numeric(10,2) | NOT NULL                                       | CHECK > 0; ≤ 100 if PERCENTAGE    |
| allow_multiple_attempts | boolean       | NOT NULL, default false                        |                                   |
| selection_mode          | varchar(20)   | NOT NULL, CHECK IN ('MANUAL', 'AUTOMATIC')     |                                   |
| status                  | varchar(30)   | NOT NULL, default 'COMPLETED'                  | Workflow-managed                  |
| deleted_at              | timestamptz   | nullable                                       | Soft-delete marker                |
| created_at              | timestamptz   | NOT NULL, default NOW()                        |                                   |
| updated_at              | timestamptz   | NOT NULL, default NOW()                        |                                   |
| created_by              | uuid          | nullable                                       |                                   |
| updated_by              | uuid          | nullable                                       |                                   |

### Indexes

| Index Name                   | Type             | Columns          | Constraint                                             |
| ---------------------------- | ---------------- | ---------------- | ------------------------------------------------------ |
| mcq_exams_pkey               | PRIMARY KEY      | (id)             |                                                        |
| idx_mcq_exams_subject_id     | B-tree           | (subject_id)     |                                                        |
| idx_mcq_exams_division_id    | B-tree           | (division_id)    |                                                        |
| idx_mcq_exams_status         | B-tree           | (status)         |                                                        |
| idx_mcq_exams_selection_mode | B-tree           | (selection_mode) |                                                        |
| idx_mcq_exams_deleted_at     | B-tree           | (deleted_at)     |                                                        |
| mcq_exams_code_unique_active | UNIQUE (partial) | (LOWER(code))    | WHERE deleted_at IS NULL (migration-owned, CONCURRENT) |

### FK Constraints

| Constraint Name            | Column      | References    | ON DELETE |
| -------------------------- | ----------- | ------------- | --------- |
| mcq_exams_subject_id_fkey  | subject_id  | subjects(id)  | RESTRICT  |
| mcq_exams_division_id_fkey | division_id | divisions(id) | SET NULL  |

### CHECK Constraints

| Constraint Name                 | Expression                                                            |
| ------------------------------- | --------------------------------------------------------------------- |
| mcq_exams_pass_type_check       | `pass_type IN ('PERCENTAGE', 'SCORE')`                                |
| mcq_exams_selection_mode_check  | `selection_mode IN ('MANUAL', 'AUTOMATIC')`                           |
| mcq_exams_status_check          | `status IN ('DRAFT','COMPLETED','UNDER_REVIEW','APPROVED','ENABLED')` |
| mcq_exams_total_questions_check | `total_questions > 0`                                                 |
| mcq_exams_pass_value_check      | `pass_value > 0`                                                      |

---

## Table: mcq_exam_settings

| Column                    | Type        | Constraints                                   | Notes                          |
| ------------------------- | ----------- | --------------------------------------------- | ------------------------------ |
| id                        | uuid        | PK, default `gen_random_uuid()`               |                                |
| exam_id                   | uuid        | NOT NULL, FK → mcq_exams.id ON DELETE CASCADE | UNIQUE (one-to-one)            |
| allow_relax_mode          | boolean     | NOT NULL, default true                        |                                |
| allow_chrono_mode         | boolean     | NOT NULL, default false                       |                                |
| allow_rush_mode           | boolean     | NOT NULL, default false                       |                                |
| allow_review_answers      | boolean     | NOT NULL, default true                        |                                |
| allow_review_hints        | boolean     | NOT NULL, default false                       |                                |
| allow_result_effects      | boolean     | NOT NULL, default true                        |                                |
| show_results_after_submit | boolean     | NOT NULL, default true                        |                                |
| show_correct_answers      | boolean     | NOT NULL, default false                       |                                |
| show_explanations         | boolean     | NOT NULL, default false                       |                                |
| enable_certificate        | boolean     | NOT NULL, default false                       |                                |
| message_template_id       | uuid        | nullable                                      | Future FK to message_templates |
| created_at                | timestamptz | NOT NULL, default NOW()                       |                                |
| updated_at                | timestamptz | NOT NULL, default NOW()                       |                                |

### Indexes

| Index Name                    | Type   | Columns   | Constraint                |
| ----------------------------- | ------ | --------- | ------------------------- |
| mcq_exam_settings_pkey        | PK     | (id)      |                           |
| idx_mcq_exam_settings_exam_id | UNIQUE | (exam_id) | One-to-one with mcq_exams |

### FK Constraints

| Constraint Name                | Column  | References    | ON DELETE |
| ------------------------------ | ------- | ------------- | --------- |
| mcq_exam_settings_exam_id_fkey | exam_id | mcq_exams(id) | CASCADE   |

---

## Table: mcq_exam_questions

| Column      | Type        | Constraints                                        | Notes         |
| ----------- | ----------- | -------------------------------------------------- | ------------- |
| id          | uuid        | PK, default `gen_random_uuid()`                    |               |
| exam_id     | uuid        | NOT NULL, FK → mcq_exams.id ON DELETE CASCADE      |               |
| question_id | uuid        | NOT NULL, FK → mcq_questions.id ON DELETE RESTRICT |               |
| order_index | integer     | NOT NULL                                           | Display order |
| created_at  | timestamptz | NOT NULL, default NOW()                            |               |

### Indexes

| Index Name                              | Type   | Columns                | Constraint                      |
| --------------------------------------- | ------ | ---------------------- | ------------------------------- |
| mcq_exam_questions_pkey                 | PK     | (id)                   |                                 |
| mcq_exam_questions_exam_question_unique | UNIQUE | (exam_id, question_id) | No duplicate questions per exam |
| mcq_exam_questions_exam_order_unique    | UNIQUE | (exam_id, order_index) | No overlapping positions        |
| idx_mcq_exam_questions_exam_id          | B-tree | (exam_id)              |                                 |
| idx_mcq_exam_questions_question_id      | B-tree | (question_id)          |                                 |

### FK Constraints

| Constraint Name                     | Column      | References        | ON DELETE |
| ----------------------------------- | ----------- | ----------------- | --------- |
| mcq_exam_questions_exam_id_fkey     | exam_id     | mcq_exams(id)     | CASCADE   |
| mcq_exam_questions_question_id_fkey | question_id | mcq_questions(id) | RESTRICT  |

---

## Table: mcq_exam_auto_criteria

| Column             | Type        | Constraints                                            | Notes                         |
| ------------------ | ----------- | ------------------------------------------------------ | ----------------------------- |
| id                 | uuid        | PK, default `gen_random_uuid()`                        |                               |
| exam_id            | uuid        | NOT NULL, FK → mcq_exams.id ON DELETE CASCADE          |                               |
| lesson_ids         | uuid[]      | nullable                                               | Array of lesson UUIDs         |
| category_value_ids | uuid[]      | nullable                                               | Array of category value UUIDs |
| tag_ids            | uuid[]      | nullable                                               | Array of tag UUIDs            |
| basket_ids         | uuid[]      | nullable                                               | Array of basket UUIDs         |
| percentage         | integer     | NOT NULL, CHECK(percentage >= 0 AND percentage <= 100) |                               |
| created_at         | timestamptz | NOT NULL, default NOW()                                |                               |
| updated_at         | timestamptz | NOT NULL, default NOW()                                |                               |

### Indexes

| Index Name                         | Type   | Columns   |
| ---------------------------------- | ------ | --------- |
| mcq_exam_auto_criteria_pkey        | PK     | (id)      |
| idx_mcq_exam_auto_criteria_exam_id | B-tree | (exam_id) |

### FK Constraints

| Constraint Name                     | Column  | References    | ON DELETE |
| ----------------------------------- | ------- | ------------- | --------- |
| mcq_exam_auto_criteria_exam_id_fkey | exam_id | mcq_exams(id) | CASCADE   |

### CHECK Constraints

| Constraint Name                         | Expression                              |
| --------------------------------------- | --------------------------------------- |
| mcq_exam_auto_criteria_percentage_check | `percentage >= 0 AND percentage <= 100` |
