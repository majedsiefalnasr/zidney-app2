import { sql } from 'drizzle-orm'

export const up = sql`
  CREATE TABLE tenants_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_slug VARCHAR(50) UNIQUE NOT NULL,
    db_name VARCHAR(100) NOT NULL,
    db_host VARCHAR(100) NOT NULL,
    db_port INTEGER NOT NULL,
    db_user VARCHAR(50) NOT NULL,
    db_password TEXT NOT NULL,
    schema_version VARCHAR(20) NOT NULL,
    product_version VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
`

export const down = sql`
  DROP TABLE tenants_registry;
`
