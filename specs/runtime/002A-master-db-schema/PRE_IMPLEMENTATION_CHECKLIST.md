# Pre-Implementation Verification Checklist

**Feature**: 002A-master-db-schema  
**Stage**: STAGE_02A_MASTER_DATABASE_SCHEMA  
**Date**: 2026-02-16  
**Status**: ⚠️ **REQUIRES ACTION BEFORE IMPLEMENTATION**

---

## ✅ Git & Artifacts

- [x] **Branch**: `002A-master-db-schema` ✅ CORRECT

  ```
  Current branch: 002A-master-db-schema
  ```

- [x] **Repository**: zidney-app2 (develop branch default) ✅ CORRECT

### Uncommitted Artifacts (13 files)

These spec/plan/tasks files must be committed before implementation starts:

| File                                                                | Status       | Action                |
| ------------------------------------------------------------------- | ------------ | --------------------- |
| specs/runtime/002A-master-db-schema/spec.md                         | ?? (new)     | COMMIT                |
| specs/runtime/002A-master-db-schema/plan.md                         | ?? (new)     | COMMIT                |
| specs/runtime/002A-master-db-schema/tasks.md                        | ?? (new)     | COMMIT                |
| specs/runtime/002A-master-db-schema/data-model.md                   | ?? (new)     | COMMIT                |
| specs/runtime/002A-master-db-schema/quickstart.md                   | ?? (new)     | COMMIT                |
| specs/runtime/002A-master-db-schema/ANALYSIS_REPORT.md              | ?? (new)     | COMMIT                |
| specs/runtime/002A-master-db-schema/PLAN_COMPLETION_REPORT.md       | ?? (new)     | COMMIT                |
| specs/runtime/002A-master-db-schema/checklists/requirements.md      | ?? (new)     | COMMIT                |
| specs/runtime/002A-master-db-schema/contracts/schema.sql            | ?? (new)     | COMMIT                |
| specs/runtime/002A-master-db-schema/contracts/types.ts              | ?? (new)     | COMMIT                |
| specs/runtime/002A-master-db-schema/contracts/migration-protocol.md | ?? (new)     | COMMIT                |
| specs/runtime/001-master-db-schema/spec.md                          | ?? (new)     | DELETE (wrong branch) |
| .vscode/settings.json                                               | M (modified) | COMMIT or IGNORE      |

**Action Required**:

```bash
git add specs/runtime/002A-master-db-schema/
git commit -m "feat(002A-master-db-schema): Add spec, plan, tasks, and design artifacts"
```

---

## ⚠️ Docker PostgreSQL

- [ ] **Status**: ❌ **NOT RUNNING**
  ```
  Cannot connect to the Docker daemon at unix:///Users/majedsiefalnasr/.docker/run/docker.sock
  ```

**Requirements for Migration Execution**:

- Master PostgreSQL instance running
- Port 5432 accessible (default)
- Database: `master_db`
- User: `postgres` (or configured)
- Empty schema ready for migration

**Action Required Before Implementation**:

```bash
# Option 1: Start Docker daemon
open -a Docker

# Option 2: Or use docker-compose
docker-compose up -d postgres

# Verify connection
docker ps --filter "name=postgres"
docker exec <container> psql -U postgres -c "SELECT version();"
```

---

## ⚠️ Environment Variables

- [ ] **Status**: ❌ **NOT CONFIGURED**
  ```
  No DB_* or POSTGRES_* environment variables found
  ```

**Required Environment Variables**:

For Master DB connection (migration runner):

```bash
# .env file (local development)
MASTER_DB_HOST=localhost
MASTER_DB_PORT=5432
MASTER_DB_NAME=master_db
MASTER_DB_USER=postgres
MASTER_DB_PASSWORD=postgres
MASTER_DB_SSL=false

# Or connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/master_db
```

**Action Required**:

1. Create `.env` file in workspace root:

```bash
cat > .env << 'EOF'
# Master Database (Control Plane)
MASTER_DB_HOST=localhost
MASTER_DB_PORT=5432
MASTER_DB_NAME=master_db
MASTER_DB_USER=postgres
MASTER_DB_PASSWORD=postgres
MASTER_DB_SSL=false

# Or use connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/master_db
EOF
```

2. Load into environment:

```bash
export $(cat .env | xargs)
```

3. Verify:

```bash
echo "MASTER_DB_HOST=$MASTER_DB_HOST"
```

---

## ✅ Migration Directory

- [x] **Directory Exists**: `apps/api/src/db/master/migrations/` ✅ CORRECT

- [ ] **Status**: ⚠️ **NOT EMPTY (UNEXPECTED)**
  ```
  Found: 20260216_001_create_tenants_registry.ts
  ```

**Issue**: There's an existing migration file that shouldn't be here for stage 002A.

**Expected State for 002A**: Empty directory (or only 001_initial_schema.ts after implementation)

**Action Required**:

1. **Backup current file** (if needed):

```bash
mv apps/api/src/db/master/migrations/20260216_001_create_tenants_registry.ts \
   /tmp/backup_20260216_001_create_tenants_registry.ts
```

2. **Clean directory**:

```bash
rm -rf apps/api/src/db/master/migrations/*
```

3. **Verify empty**:

```bash
ls -la apps/api/src/db/master/migrations/
# Should show only . and .. entries
```

---

## Database Infrastructure

### Directory Structure

```
apps/api/src/db/
├── master/
│   ├── migrations/          ⚠️ NEEDS CLEANUP
│   ├── runner.ts            (to be created in T002)
│   ├── loader.ts            (to be created in T004)
│   ├── validator.ts         (to be created in T005)
│   └── schema-migrations.ts (to be created in T003)
└── tenant/
    └── migrations/          (for future stages)
```

✅ **Master DB directory**: Exists  
✅ **Tenant DB directory**: Exists  
⚠️ **Migrations subdir**: Needs cleanup

---

## Pre-Implementation Checklist

Before running `/speckit.implement`:

### 1. Git & Artifacts

- [ ] Commit all spec/plan/tasks files

  ```bash
  git add specs/runtime/002A-master-db-schema/
  git commit -m "feat: Add 002A master database schema specification and tasks"
  ```

- [ ] Verify branch: `002A-master-db-schema`

  ```bash
  git branch --show-current
  ```

- [ ] Verify no uncommitted changes
  ```bash
  git status
  ```

### 2. Docker PostgreSQL

- [ ] Start Docker daemon

  ```bash
  open -a Docker
  # Or: docker daemon &
  ```

- [ ] Start PostgreSQL container

  ```bash
  docker-compose up -d postgres
  # Or: docker run -d -p 5432:5432 postgres:14
  ```

- [ ] Verify connection

  ```bash
  psql postgresql://postgres:postgres@localhost:5432/postgres -c "SELECT version();"
  ```

- [ ] Create master_db
  ```bash
  createdb -h localhost -U postgres master_db
  ```

### 3. Environment Variables

- [ ] Create .env file with DB credentials

  ```bash
  cat > .env << 'EOF'
  MASTER_DB_HOST=localhost
  MASTER_DB_PORT=5432
  MASTER_DB_NAME=master_db
  MASTER_DB_USER=postgres
  MASTER_DB_PASSWORD=postgres
  MASTER_DB_SSL=false
  EOF
  ```

- [ ] Load environment

  ```bash
  export $(cat .env | xargs)
  ```

- [ ] Verify variables
  ```bash
  echo "MASTER_DB_HOST=$MASTER_DB_HOST (should be: localhost)"
  echo "MASTER_DB_NAME=$MASTER_DB_NAME (should be: master_db)"
  ```

### 4. Migration Directory

- [ ] Clean migration directory

  ```bash
  rm -rf apps/api/src/db/master/migrations/*
  ```

- [ ] Verify empty
  ```bash
  ls -la apps/api/src/db/master/migrations/
  # Should show only . and ..
  ```

### 5. Node.js Dependencies

- [ ] Install dependencies

  ```bash
  npm install
  # or: yarn
  ```

- [ ] Verify TypeScript

  ```bash
  npx tsc --version
  ```

- [ ] Verify Vitest (test runner)
  ```bash
  npx vitest --version
  ```

### 6. Final Verification

- [ ] All checks pass

  ```bash
  # Git
  git branch --show-current # Should be: 002A-master-db-schema
  git status # Should be clean

  # Docker
  docker ps | grep postgres # Should show running container

  # Environment
  echo $MASTER_DB_NAME # Should be: master_db

  # Directory
  ls apps/api/src/db/master/migrations/ # Should be empty

  # Dependencies
  npx tsc --version # Should show version
  ```

---

## Implementation Readiness

| Check                  | Status    | Action       |
| ---------------------- | --------- | ------------ |
| Branch correct         | ✅ YES    | Ready        |
| Artifacts committed    | ❌ NO     | **REQUIRED** |
| Docker running         | ❌ NO     | **REQUIRED** |
| Env vars configured    | ❌ NO     | **REQUIRED** |
| Migration dir clean    | ❌ NO     | **REQUIRED** |
| Dependencies installed | ? UNKNOWN | **VERIFY**   |

**Overall Status**: ⚠️ **NOT READY**

**Actions Required Before Proceeding**:

1. ✋ Commit spec/plan/tasks artifacts
2. ✋ Start Docker PostgreSQL
3. ✋ Configure environment variables
4. ✋ Clean migration directory
5. ✋ Verify dependencies installed

**Estimated Time**: ~10-15 minutes

---

## Next Steps (After Verification)

Once all checks pass:

```bash
/speckit.implement
```

This will:

1. Generate Phase 1 files (migration infrastructure)
2. Generate Phase 2 files (core schema migration)
3. Generate Phase 3 files (TypeScript types)
4. Generate Phase 4 files (validation/utilities)
5. Create comprehensive test suite (Phase 5)
6. Generate documentation (Phase 6)

---

## Support

If you encounter issues:

1. **Docker won't start**:

   ```bash
   # Check Docker daemon logs
   log stream --process Docker

   # Or restart Docker
   killall Docker; sleep 2; open -a Docker
   ```

2. **PostgreSQL connection fails**:

   ```bash
   # List running containers
   docker ps

   # Check logs
   docker logs <container_id>

   # Manual connection test
   psql -h localhost -U postgres -c "SELECT 1;"
   ```

3. **Environment variables not loading**:

   ```bash
   # Verify file exists
   cat .env

   # Manual export
   export MASTER_DB_HOST=localhost
   ```

---

**Created**: 2026-02-16  
**Status**: Awaiting verification actions
