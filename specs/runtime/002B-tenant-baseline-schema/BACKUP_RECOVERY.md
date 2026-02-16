# Backup & Recovery Guide

**Version**: 1.0.0  
**Stage**: STAGE_02B_TENANT_BASELINE_SCHEMA  
**Date**: 2026-02-16

## Table of Contents

1. [Backup Strategy](#backup-strategy)
2. [Automated Backups](#automated-backups)
3. [Manual Backup](#manual-backup)
4. [Recovery Procedures](#recovery-procedures)
5. [RTO/RPO Targets](#rtorpo-targets)

---

## Backup Strategy

### Architecture

```
PostgreSQL Instance
  ├─ Master DB (MMC metadata)
  └─ Tenant Databases (N instances)
      ├─ zidney_acme_university
      ├─ zidney_demo_school
      └─ zidney_state_board
```

**Backup Scope**:

- ✅ ALL tenant databases (full dumps)
- ✅ Master database (MMC metadata)
- ❌ Redis (ephemeral, can be regenerated)
- ❌ Logs (archived separately)

### Backup Tiers

| Tier         | Frequency     | Retention | Use Case             |
| ------------ | ------------- | --------- | -------------------- |
| **Snapshot** | Every 4 hours | 7 days    | Quick recovery       |
| **Daily**    | 00:00 UTC     | 30 days   | Longer-term recovery |
| **Weekly**   | Sundays 02:00 | 90 days   | Compliance           |
| **Monthly**  | 1st of month  | 2 years   | Archive              |

---

## Automated Backups

### AWS RDS (Recommended)

```bash
# Enable automated backups
aws rds modify-db-instance \
  --db-instance-identifier zidney-postgres-prod \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00" \
  --apply-immediately
```

**Features**:

- Automatic snapshots every 4 hours
- Transaction-consistent point-in-time recovery
- Automated failover with Multi-AZ
- Encryption at rest

### pg_basebackup (Self-Hosted)

```bash
#!/bin/bash
# Backup all tenant databases daily

BACKUP_DIR="/backups/pg_daily"
DB_HOST="db.internal"
DB_USER="backup"

mkdir -p $BACKUP_DIR

# Backup each tenant database
for db in $(psql -h $DB_HOST -U $DB_USER -t -c "
  SELECT datname FROM pg_database
  WHERE datname LIKE 'zidney_%'
"); do
  pg_dump -h $DB_HOST -U $DB_USER -d $db | \
    gzip > ${BACKUP_DIR}/${db}_$(date +%Y%m%d).sql.gz

  echo "Backed up: $db"
done

# Verify backup size
ls -lh $BACKUP_DIR
```

### Backup Verification

```bash
# 1. Check backup exists
ls -lh /backups/pg_daily/zidney_acme_*.sql.gz

# 2. Verify backup integrity
gunzip -t /backups/pg_daily/zidney_acme_20260216.sql.gz

# 3. Test restore to staging
psql -h staging-db -d zidney_test < /backups/pg_daily/zidney_acme_20260216.sql

# 4. Verify schema version in restored DB
psql -h staging-db -d zidney_test \
  -c "SELECT version FROM schema_version;"
```

---

## Manual Backup

### Full Database Dump

```bash
# Backup single tenant database
pg_dump -h db.internal -U postgres -d zidney_acme_university \
  --format=custom \
  --compress=9 \
  > /backups/manual/zidney_acme_$(date +%Y%m%d_%H%M%S).dump

# Backup all tenant databases
for db in $(psql -h db.internal -U postgres -t -c \
  "SELECT datname FROM pg_database WHERE datname LIKE 'zidney_%'"); do
  pg_dump -h db.internal -U postgres -d $db \
    --format=plain | gzip > /backups/manual/${db}_$(date +%Y%m%d).sql.gz
done
```

### Backup Metadata

Record for each backup:

- Database name: `zidney_acme_university`
- Timestamp: `2026-02-16T10:00:00Z`
- Schema version: `1.0.0`
- Checksum: `sha256: abc123def456...`
- Size: `125 MB (compressed)`
- Status: `VERIFIED`

```bash
# Create backup manifest
cat > /backups/manual/backup_manifest.txt << EOF
Database: zidney_acme_university
BackupDate: 2026-02-16T10:00:00Z
SchemaVersion: 1.0.0
Checksum: $(sha256sum zidney_acme_20260216.sql.gz | cut -d' ' -f1)
Size: $(du -h zidney_acme_20260216.sql.gz | cut -f1)
Status: READY
EOF
```

---

## Recovery Procedures

### Scenario 1: Data Corruption (Single Workspace)

**Symptoms**:

- Checksum mismatch on migration
- Orphaned records found
- User reports missing data

**Recovery Time**: ~15 minutes

```bash
# 1. Identify last good backup
ls -ltrh /backups/pg_daily/zidney_acme_*.sql.gz | tail -1

# 2. Stop API traffic to workspace
# Update firewall or load balancer to reject requests to /api/workspaces/acme

# 3. Create pre-recovery snapshot (for investigation)
pg_dump -h db.internal -U postgres -d zidney_acme_university \
  -f /backups/corrupted_investigation/zidney_acme_$(date +%Y%m%d_%H%M%S).dump

# 4. Drop corrupted database
psql -h db.internal -U postgres \
  -c "DROP DATABASE zidney_acme_university;"

# 5. Restore from backup
gunzip < /backups/pg_daily/zidney_acme_20260216.sql.gz | \
  psql -h db.internal -U postgres -d zidney_acme_university

# 6. Verify restored schema
psql -h db.internal -d zidney_acme_university \
  -c "SELECT version FROM schema_version;"

# 7. Re-enable API traffic
# Update firewall to allow requests

# 8. Monitor for 30 minutes
tail -f /var/log/zidney/api.log | grep zidney_acme
```

### Scenario 2: Full Database Failure

**Symptoms**:

- PostgreSQL won't start
- All databases inaccessible

**Recovery Time**: ~30 minutes

```bash
# 1. Check database status
systemctl status postgresql

# 2. Review error logs
tail -100 /var/log/postgresql/postgresql.log

# 3. If corrupted, restore from snapshot
# (AWS RDS example)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier zidney-postgres-prod-restored \
  --db-snapshot-identifier zidney-postgres-prod-20260216-snapshot-01 \
  --db-instance-class db.r5.large

# 4. Wait for restore to complete
aws rds wait db-instance-available \
  --db-instance-identifier zidney-postgres-prod-restored

# 5. Verify all tenant databases exist
psql -h zidney-postgres-prod-restored.abc123.us-east-1.rds.amazonaws.com \
  -U postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'zidney_%';"

# 6. Cut over DNS to new instance
# Update Route53 / load balancer

# 7. Decommission old instance (after verification)
```

### Scenario 3: Migration Rollback

**Situation**: Migration to v1.1.0 corrupted data, need to go back to v1.0.0

```bash
# 1. Create investigation snapshot (before touching data)
pg_dump -h db.internal -d zidney_acme_university \
  -f /backups/investigation/v1.1.0_corrupted_$(date +%Y%m%d).dump

# 2. Restore from pre-migration backup
gunzip < /backups/pg_daily/zidney_acme_20260215.sql.gz | \
  psql -h db.internal -d zidney_acme_university

# 3. Verify rollback
psql -h db.internal -d zidney_acme_university \
  -c "SELECT version FROM schema_version;"
# Should return: 1.0.0

# 4. Re-enable workspace
UPDATE licenses SET status = 'ACTIVE' WHERE workspace_id = 'acme-id';

# 5. Investigate issue offline
# Don't attempt v1.1.0 again until root cause fixed
```

### Scenario 4: Point-In-Time Recovery

**Situation**: User accidentally deleted records at 10:30 AM, need to recover

**AWS RDS with automated backups**:

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier zidney-postgres-prod \
  --target-db-instance-identifier zidney-postgres-prod-pitr \
  --restore-time 2026-02-16T10:25:00.000Z \
  --db-instance-class db.r5.large

# Then follow scenario 2 (cut over) after verification
```

---

## RTO/RPO Targets

### Service Level Agreements

| Failure Scenario           | RTO (Recovery Time Obj) | RPO (Recovery Point Obj) | Method                      |
| -------------------------- | ----------------------- | ------------------------ | --------------------------- |
| **Tenant Data Corruption** | 15 min                  | 4 hours                  | Database restore            |
| **Single DB Failure**      | 30 min                  | 4 hours                  | Snapshot restore            |
| **Full DB Failure**        | 60 min                  | 1 hour                   | Failover to replica         |
| **Data Center Failure**    | 120 min                 | 1 hour                   | Cross-AZ failover           |
| **Complete Loss**          | 24 hours                | 24 hours                 | Manual restore from archive |

### Backup Schedule (Achieving RTO/RPO)

```
00:00 - Daily backup (full dump)
04:00 - Snapshot backup #1
08:00 - Snapshot backup #2
12:00 - Snapshot backup #3
16:00 - Snapshot backup #4 / Archived backup copy
20:00 - Snapshot backup #5
```

**Result**: ≤ 4-hour maximum data loss, ≤ 30-min recovery for most scenarios

---

## Testing Backups

### Monthly Restore Test

```bash
# 1. Select random tenant database
db_name=$(psql -h db.internal -U postgres -t -c \
  "SELECT datname FROM pg_database WHERE datname LIKE 'zidney_%' ORDER BY RANDOM() LIMIT 1")

# 2. Restore to staging
gunzip < /backups/monthly/$(date +%Y%m)_full.sql.gz | \
  psql -h staging-db -U postgres -d $db_name

# 3. Verify data integrity
psql -h staging-db -d $db_name << 'SQL'
SELECT COUNT(*) as users FROM users;
SELECT COUNT(*) as attempts FROM attempts;
SELECT COUNT(*) as events FROM attempt_events;
SELECT version FROM schema_version;
SQL

# 4. Run checksum validation
md5sum staging-db:$db_name > /backups/restore_tests/$(date +%Y%m%d)_checksum.txt

# 5. Document result
echo "✓ Restore test passed for $db_name on $(date)" >> /backups/restore_tests/log.txt
```

### Recovery Drill (Quarterly)

Full end-to-end recovery exercise:

1. Select non-production tenant
2. Simulate failure
3. Execute recovery procedure
4. Measure RTO/RPO
5. Document lessons learned

---

## Retention Policy

| Backup Type | Retention | Location        | Encryption |
| ----------- | --------- | --------------- | ---------- |
| Snapshot    | 7 days    | RDS/Local       | AES-256    |
| Daily       | 30 days   | Backup bucket   | AES-256    |
| Weekly      | 90 days   | Archive storage | AES-256    |
| Monthly     | 2 years   | Cold storage    | AES-256    |

**Deletion Schedule**:

```
// Daily backups
DELETE backups older than 30 days

// Weekly backups
DELETE backups older than 90 days

// Monthly backups
Never automatically delete; require manual approval for removal
```

---

## Support & Escalation

- **Data Loss Report**: Create CRITICAL ticket, assign to DBA + Engineering
- **Recovery Stuck**: Page on-call DBA immediately
- **Compliance**: Document all recoveries for audit trail
