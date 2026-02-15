# STAGE 61 – Content Visibility Rules

Phase: 05_FRONTOFFICE_RUNTIME  
Status: Critical  
Scope: Runtime filtering & access control for student-facing content

---

## Objective

Define strict runtime rules that determine which content a student can see and access in Frontoffice.

This stage ensures:

- Academic isolation (division-bound content)
- Organizational filtering (department/group restrictions)
- Subscription-based feature gating
- Workflow state enforcement
- Scheduled time window enforcement
- Zero cross-division leakage

Content visibility must always be enforced at API level.  
Frontend filtering alone is forbidden.

---

## Visibility Enforcement Layers

Content visibility is determined by evaluating all of the following layers:

1. Academic Scope Layer
2. Subscription & Plan Layer
3. Workflow Status Layer
4. Scheduled Window Layer
5. License State Layer

All layers must pass for content to be returned.

---

## Academic Scope Rules

Each student must belong to:

- Exactly one Division (mandatory)
- Zero or one Department
- Zero or one Group
- Zero or one Semester

Content may define restrictions for:

- Division (mandatory binding)
- Department (optional restriction)
- Group (optional restriction)
- Semester (optional restriction)

Visibility logic:

Division:

- Content.division_id MUST equal student.division_id

Department:

- If content has department restriction:
  - student.department_id must match
- If content has no department restriction:
  - ignore department

Group:

- If content has group restriction:
  - student.group_id must match
- If no group restriction:
  - ignore group

Semester:

- If content linked to specific semester:
  - student.semester_id must match
- Otherwise visible

Division mismatch always results in exclusion.

No fallback to default division allowed at runtime.

---

## Subscription & Package Layer

Student JWT contains:

- subscription_status
- enabled_modules
- plan_features

Visibility must validate:

- Subscription status is ACTIVE
- Requested module is enabled in plan
- Feature limits not exceeded

Examples:

- If MCQ module not enabled → hide MCQ entirely
- If Library module not enabled → hide Library
- If Scheduled Exams disabled → hide scheduled endpoints

Subscription enforcement must occur before DB query execution when possible.

---

## Workflow Status Enforcement

Only content in ENABLED status is visible.

Workflow states:

- COMPLETED
- UNDER_REVIEW
- APPROVED
- ENABLED

Visibility rule:

Only ENABLED content is visible to students.

Soft-deleted or disabled content must never be returned.

---

## Scheduled Content Window Enforcement

For scheduled exams:

Content visible only if:

- current_time >= start_time - tolerance
- current_time <= end_time

If before window:

- Hide or show as "upcoming" (based on design)

If after window:

- Hide or mark expired

Server time is authoritative.

Client time must not be trusted.

---

## License State Enforcement

If workspace license is:

- ACTIVE → allow
- SOFT_LOCKED → block
- ARCHIVED → block

License validation must execute before content filtering.

---

## Query Filtering Requirements

All content queries must include:

- division_id filter
- status = ENABLED
- subscription eligibility
- time window (if scheduled)

No endpoint may return raw content without applying filters.

Filtering must occur in SQL query, not in-memory post-processing.

---

## API Enforcement Standard

Every Frontoffice content endpoint must:

1. Validate authentication
2. Validate subscription
3. Validate license
4. Apply academic scope filters
5. Apply workflow filter
6. Apply scheduled window filter
7. Return filtered results only

Missing any step is a security violation.

---

## Security Guarantees

System must guarantee:

- Student cannot see another division's content
- Student cannot access hidden scheduled exam
- Student cannot bypass subscription by direct URL
- Student cannot view non-enabled content via ID guessing
- Direct ID access must revalidate full visibility logic

---

## Performance Considerations

Because filtering happens frequently:

- Proper DB indexes required on:
  - division_id
  - department_id
  - group_id
  - status
  - scheduled_start
  - scheduled_end

Query plans must be validated under scale.

---

## Validation Criteria

Stage complete when:

- Division-based filtering verified
- Department/group restrictions verified
- Subscription gating verified
- Disabled content hidden
- Scheduled time window enforced
- Direct ID access blocked if not eligible
- Cross-division data leak test fails correctly

---

## Forbidden

- Frontend-only filtering
- Returning content then filtering in memory
- Ignoring workflow status
- Ignoring division constraint
- Allowing access via ID guessing
- Mixing academic and organizational filters incorrectly

---

## Stability Principle

Content visibility defines academic trust.

If students can see content outside their academic scope,
Zidney fails institutional integrity.
