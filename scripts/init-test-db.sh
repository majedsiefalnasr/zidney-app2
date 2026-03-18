#!/bin/bash
# Initialize Test Databases
# Creates and provisions master and tenant test databases with baseline schema

set -e

DB_HOST="${DB_HOST:-localhost}"
# Default to CI postgres service port and CI credentials when not overridden
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-zidney_test}"
DB_PASSWORD="${DB_PASSWORD:-zidney_test}"
MASTER_DB_NAME="${MASTER_DB_NAME:-zidney_master_test}"

echo "📦 Initializing test database..."

# Function to run psql commands
run_sql() {
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"
}

# Drop and recreate master database
echo "  • Dropping existing master database..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tc "SELECT 1 FROM pg_database WHERE datname = '$MASTER_DB_NAME'" | grep -q 1 && \
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $MASTER_DB_NAME" || true

echo "  • Creating master database..."
run_sql -tc "CREATE DATABASE $MASTER_DB_NAME"

# Create master schema tables
echo "  • Applying master schema..."
run_sql -d "$MASTER_DB_NAME" << 'EOF'
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  product_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  max_students INT NOT NULL DEFAULT 1000,
  max_staff INT NOT NULL DEFAULT 100,
  schema_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  product_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(255) NOT NULL,
  resource_id UUID,
  status VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_workspace ON licenses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
EOF

# Update schema_version in master database
echo "  • Setting schema version..."
run_sql -d "$MASTER_DB_NAME" -c "
  INSERT INTO workspaces (id, slug, name) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    '_schema_version',
    'Schema Metadata'
  ) ON CONFLICT DO NOTHING;
"

echo "✅ Test database initialization complete"
exit 0
