# STAGE 26 – Teams & Work Team Types

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB only

---

## Stage Status

Status: DRAFT

---

## Objective

Implement Teams and Team Types as operational collaboration structures for staff.

Teams are:

- Staff-only entities
- Independent from academic visibility rules
- Not part of division isolation
- Not used for content filtering
- Used for internal coordination and reporting

Team Types categorize teams for organizational clarity.

Teams must never affect academic data isolation.

---

## Data Model

Table: team_types

Columns:

- id (UUID, primary key)
- name (varchar, required)
- description (text, nullable)
- status (enum: ENABLED | DISABLED)
- created_at (timestamp)
- updated_at (timestamp)

Constraints:

- name unique within workspace
- status required

Indexes:

- unique(name)
- index(status)

---

Table: teams

Columns:

- id (UUID, primary key)
- name (varchar, required)
- team_type_id (UUID, nullable, FK → team_types.id)
- max_members (integer, nullable)
- description (text, nullable)
- status (enum: ENABLED | DISABLED)
- created_at (timestamp)
- updated_at (timestamp)

Constraints:

- name unique within workspace
- team_type_id must reference ENABLED team_type if provided
- max_members must be positive integer if not null

Indexes:

- unique(name)
- index(team_type_id)
- index(status)

---

Table: staff_teams

Columns:

- staff_id (UUID, FK → users.id)
- team_id (UUID, FK → teams.id)
- created_at (timestamp)

Composite Primary Key:

(staff_id, team_id)

Constraints:

- staff must exist
- team must exist
- team must be ENABLED

Foreign key rules:

- ON DELETE CASCADE for team_id
- ON DELETE CASCADE for staff_id

---

## Relationship Rules

Staff:

- May belong to multiple teams
- No upper limit unless defined by business rule (future)

Team:

- May contain multiple staff
- Cannot exceed max_members if defined

Assignment must:

- Occur inside transaction
- Use SELECT FOR UPDATE on team row
- Count current members
- Reject if max_members reached

Race conditions are not allowed.

---

## Status Behavior

ENABLED:

- Visible in assignment dropdown
- Accepts new members

DISABLED:

- Cannot assign new staff
- Existing assignments remain
- Cannot be deleted unless no members assigned

Team type DISABLED:

- Teams may remain
- Cannot assign new team to disabled type

---

## Deletion Rules

Team cannot be deleted if:

- Members assigned
- Referenced in reporting configurations (future-proof check)

Deletion must be explicit and transactional.

Soft delete recommended.

Team type cannot be deleted if:

- Teams reference it

---

## Isolation Guarantees

- Teams exist per tenant DB
- No cross-tenant team references
- Teams must not be used in content filtering logic
- Teams must not override division or department boundaries

---

## Validation Criteria

Stage complete when:

- Team type CRUD works
- Team CRUD works
- Multi-team per staff supported
- max_members enforced transactionally
- Disabled teams not assignable
- Deletion restrictions enforced
- No academic filtering impact

---

## Not Allowed

- Team affecting exam visibility
- Team overriding division boundary
- Assignment without transaction safety
- Hard delete bypassing member checks
- Global teams shared across tenants

---

Next: STAGE_27_SEMESTERS
