# 🧪 Testing Guide — {{STAGE_NAME}}

> **Who is this for?** Any developer or tester picking up this stage for the first time.  
> No deep system knowledge required — just follow each section in order.

---

## 📋 What Was Built

{{STAGE_PLAIN_ENGLISH_SUMMARY}}

In plain terms:
- {{PLAIN_FEATURE_1}}
- {{PLAIN_FEATURE_2}}
- {{PLAIN_FEATURE_3}}

---

## ✅ Before You Start

Make sure you have these ready before running any tests:

| Requirement          | How to check                              |
|----------------------|-------------------------------------------|
| Node.js installed    | `node --version` → should be v20+         |
| Bun installed        | `bun --version` → should be v1+           |
| Docker running       | `docker ps` → should not error            |
| `.env` file exists   | Check project root for `.env` or `.env.local` |
| DB migrations run    | `bun run db:migrate` (run if unsure)      |
| Branch checked out   | `git branch` → should show `{{STAGE_DIR_NAME}}` |

If anything above is missing, ask a teammate or check the project `README.md` before continuing.

---

## 🗂️ Files Changed in This Stage

These are the files introduced or modified. You don't need to edit them — just good to know:

```
{{FILES_CHANGED_LIST}}
```

---

## 🚀 How to Run the Project Locally

```bash
# 1. Install dependencies (skip if already done)
bun install

# 2. Run database migrations
bun run db:migrate

# 3. Start the API server
bun run dev:api

# 4. Start the worker (if this stage has background jobs)
bun run dev:worker

# 5. Start the frontend (if applicable)
bun run dev:front
```

You should see the server running at: `http://localhost:3000` (or the port in your `.env`).

---

## 🔬 Running the Automated Tests

Run all tests for this stage:

```bash
# Run unit tests
bun test

# Run integration tests
bun test:integration

# Run with coverage report
bun test --coverage
```

**Expected result:** All tests pass. Coverage should be above the project threshold.

If a test fails, check the error message — it will usually tell you exactly what went wrong.

---

## 🧩 Manual Testing Scenarios

Work through these scenarios one by one. Each one has clear steps and what to expect.

---

### Scenario 1 — {{SCENARIO_1_TITLE}}

**What this tests:** {{SCENARIO_1_WHAT}}

**Steps:**

1. {{SCENARIO_1_STEP_1}}
2. {{SCENARIO_1_STEP_2}}
3. {{SCENARIO_1_STEP_3}}

**Expected result:**  
{{SCENARIO_1_EXPECTED}}

**If something goes wrong:**  
{{SCENARIO_1_TROUBLESHOOT}}

---

### Scenario 2 — {{SCENARIO_2_TITLE}}

**What this tests:** {{SCENARIO_2_WHAT}}

**Steps:**

1. {{SCENARIO_2_STEP_1}}
2. {{SCENARIO_2_STEP_2}}
3. {{SCENARIO_2_STEP_3}}

**Expected result:**  
{{SCENARIO_2_EXPECTED}}

**If something goes wrong:**  
{{SCENARIO_2_TROUBLESHOOT}}

---

### Scenario 3 — {{SCENARIO_3_TITLE}} *(Edge Case)*

**What this tests:** {{SCENARIO_3_WHAT}}

**Steps:**

1. {{SCENARIO_3_STEP_1}}
2. {{SCENARIO_3_STEP_2}}

**Expected result:**  
{{SCENARIO_3_EXPECTED}}

---

## 🔴 Error Cases to Verify

These are cases that **should fail** with a clear error. Make sure the system rejects them properly.

| Scenario                        | How to trigger                  | Expected response         |
|---------------------------------|---------------------------------|---------------------------|
| {{ERROR_CASE_1_TITLE}}          | {{ERROR_CASE_1_HOW}}            | `{{ERROR_CASE_1_RESPONSE}}` |
| {{ERROR_CASE_2_TITLE}}          | {{ERROR_CASE_2_HOW}}            | `{{ERROR_CASE_2_RESPONSE}}` |
| {{ERROR_CASE_3_TITLE}}          | {{ERROR_CASE_3_HOW}}            | `{{ERROR_CASE_3_RESPONSE}}` |

All error responses should follow this format:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

---

## 🏠 Multi-Tenant Isolation Check

> This is important — always verify that one workspace cannot see another's data.

1. Set up (or use) two test workspaces: `workspace-a` and `workspace-b`
2. Create test data under `workspace-a`
3. Make the same request using `workspace-b` credentials
4. **Expected:** `workspace-b` gets a 404 or empty result — never `workspace-a`'s data

If cross-workspace data leaks → **stop testing and report immediately.**

---

## 📊 Checking Logs

If something doesn't behave as expected, check the structured logs:

```bash
# API logs
bun run dev:api | jq .

# Worker logs (if applicable)
bun run dev:worker | jq .
```

Look for entries with:
- `"level": "error"` — something went wrong
- `"workspace_slug"` — confirms tenant context is attached
- `"correlation_id"` — use this to trace a request end-to-end

---

## 🐛 Common Issues & Fixes

| Problem                          | Likely cause                        | Fix                                      |
|----------------------------------|-------------------------------------|------------------------------------------|
| `Cannot connect to DB`           | DB not running or wrong credentials | Check `.env` DB_URL and run `docker ps`  |
| `Migration failed`               | Schema out of sync                  | Run `bun run db:migrate` again           |
| `401 Unauthorized`               | Missing or expired token            | Re-login and use the new token           |
| `423 Locked`                     | Workspace license is soft-locked    | Check workspace license status in MMC    |
| `426 Upgrade Required`           | Schema version mismatch             | Run migrations and restart server        |
| Tests fail with `port in use`    | Server already running              | Kill existing process: `lsof -ti:3000 \| xargs kill` |

---

## 📦 What to Check in the Database

If you want to verify data directly (optional but useful):

```bash
# Connect to the tenant DB (replace <workspace_slug> with your test workspace)
bun run db:console --workspace <workspace_slug>
```

Key tables touched in this stage:

| Table                    | What to check                          |
|--------------------------|----------------------------------------|
| {{DB_TABLE_1}}           | {{DB_TABLE_1_CHECK}}                   |
| {{DB_TABLE_2}}           | {{DB_TABLE_2_CHECK}}                   |

---

## ✅ Sign-Off Checklist

Before marking this stage as tested, confirm:

- [ ] All automated tests pass
- [ ] All manual scenarios completed successfully
- [ ] All error cases return correct error format
- [ ] Multi-tenant isolation verified
- [ ] No `console.log` or stack traces visible in API responses
- [ ] Logs include `workspace_slug` and `correlation_id`

---

## 📞 Who to Contact

If you're stuck or find an unexpected issue:

- Check `specs/runtime/{{STAGE_DIR_NAME}}/reports/IMPLEMENT_REPORT.md` for implementation details
- Check `specs/runtime/{{STAGE_DIR_NAME}}/reports/PLAN_REPORT.md` for architectural decisions
- Ask the engineer who worked on this stage (see git log: `git log --oneline specs/runtime/{{STAGE_DIR_NAME}}/`)

---

*Generated by Zidney Orchestrator — Hard Mode v1.2.0*  
*Stage: {{STAGE_NAME}} | Phase: {{PHASE_NAME}} | Date: {{CLOSURE_DATE}}*
