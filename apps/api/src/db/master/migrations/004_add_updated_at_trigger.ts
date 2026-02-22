/**
 * Migration 004: Add Updated At Trigger
 *
 * File: apps/api/src/db/master/migrations/004_add_updated_at_trigger.ts
 * Task: T012
 *
 * Creates shared trigger for auto-updating updated_at field on any UPDATE.
 * This trigger is used across multiple tables and created once here.
 *
 * Schema version: 4 → 5
 */

import { Database } from 'better-sqlite3'

export const name = '004_add_updated_at_trigger'
export const version = 5

export async function up(db: Database): Promise<void> {
  db.exec(`
    -- Create or replace the update_timestamp function (shared across tables)
    CREATE OR REPLACE FUNCTION update_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create trigger for licenses table
    DROP TRIGGER IF EXISTS licenses_updated_at_trigger ON licenses;
    
    CREATE TRIGGER licenses_updated_at_trigger
    BEFORE UPDATE ON licenses
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
  `)
}

export async function down(db: Database): Promise<void> {
  db.exec(`
    DROP TRIGGER IF EXISTS licenses_updated_at_trigger ON licenses;
    DROP FUNCTION IF EXISTS update_timestamp();
  `)
}

export const checksum = 'T012_updated_at_trigger_v4'
