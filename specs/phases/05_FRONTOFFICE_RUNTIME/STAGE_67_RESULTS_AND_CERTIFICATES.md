# STAGE 67 – Results & Certificates

Phase: 05_FRONTOFFICE_RUNTIME

---

## Objective

Implement secure, immutable result rendering and certificate issuance for Frontoffice.

This stage ensures:

- Results are derived strictly from attempt snapshot data
- Grades are never recalculated during rendering
- Certificates are immutable once issued
- Certificate validity does not depend on future exam changes
- Full tenant isolation

Results and certificates are trust artifacts.

---

## Result Rendering Model

Results must be based on:

- attempt.final_score
- attempt.percentage
- attempt.pass_status
- attempt.grading_snapshot

The system MUST NOT:

- Recalculate grading during result view
- Re-evaluate question logic
- Modify stored grading data

All displayed data must originate from the attempt snapshot.

---

## Result Visibility Rules

Visibility depends on exam configuration snapshot stored inside attempt.

Exam configuration flags may control:

- Show score
- Show percentage
- Show pass/fail only
- Show question breakdown
- Show correct answers
- Show explanations

Runtime must respect these snapshot flags.

If breakdown not allowed → question-level data must not be returned.

---

## Question Breakdown Rendering

If enabled, system may show:

- Question text (snapshot)
- Student answer (snapshot)
- Correct answer (snapshot)
- Explanation (snapshot)
- Per-question score

Rendering must use snapshot_question_data stored in attempt.

Original question table must NOT be queried.

---

## Certificate Issuance Rules

Certificate may be generated only if:

- attempt.pass_status = PASSED
- exam configuration allows certificate

Certificate generation must:

- Use certificate_template_version snapshot
- Use attempt snapshot values
- Store generated certificate record in tenant DB

Certificate record must include:

- certificate_id
- attempt_id
- student_id
- template_version
- issued_at
- verification_hash
- immutable_snapshot_data

---

## Certificate Immutability

After issuance:

- Certificate content cannot be edited
- Attempt grade changes (if any) must not affect issued certificate
- Template updates must not retroactively alter existing certificates

Certificates are permanent artifacts.

---

## PDF Generation

PDF generation must:

- Be deterministic
- Be generated server-side
- Use stored snapshot data
- Not depend on live exam configuration

PDF must include:

- Student name
- Workspace branding
- Exam name
- Final score
- Issue date
- Unique verification ID

---

## Verification Model

Each certificate must contain:

- Unique certificate_id
- Public verification endpoint

Verification endpoint must:

- Validate certificate exists
- Validate workspace
- Return minimal public confirmation

No sensitive data exposed publicly.

---

## Subscription Interaction

If subscription expired:

- User may still access past certificates
- User may download issued certificates

Subscription status must NOT invalidate already issued certificates.

---

## Multi-Tenancy Isolation

Certificates are stored inside tenant database.

Rules:

- No cross-workspace certificate lookup
- Verification endpoint must resolve workspace before validation
- certificate_id must be unique per workspace

---

## Security Rules

- No grade recalculation
- No certificate regeneration with modified data
- No manual certificate creation without pass
- No editing issued_at timestamp
- No certificate deletion without audit log

---

## Validation Criteria

Stage complete when:

- Results render from snapshot only
- Configuration flags respected
- Certificates issued only on pass
- Certificate immutable after issuance
- PDF downloadable
- Verification endpoint works
- Subscription expiration does not block certificate access
- Cross-tenant isolation verified

---

Results and certificates define institutional credibility.

They must remain immutable, deterministic, and isolated.
