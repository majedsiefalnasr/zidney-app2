/**
 * Drizzle ORM Schema — Workspace Settings (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/workspace-settings.schema.ts
 * Stage: 018_WORKSPACE_SETTINGS
 * Date: 2026-02-28
 *
 * Drizzle pgTable definitions for workspace_settings and workspace_settings_audit.
 * JSONB columns typed as jsonb() with TypeScript generics.
 * Matches migration DDL in 20260228_002_workspace_settings_jsonb.ts.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import type {
  BrandingSettings,
  GeneralSettings,
  LanguageSettings,
  PaymentSettings,
  SecuritySettings,
} from '../../../modules/workspace-settings/workspace-settings.types'

// ---------------------------------------------------------------------------
// workspace_settings
// ---------------------------------------------------------------------------

export const workspaceSettings = pgTable(
  'workspace_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    singleton_key: varchar('singleton_key', { length: 10 }).notNull().default('SETTINGS'),
    config_version: integer('config_version').notNull().default(1),

    // Existing flat columns (preserved — forward-only)
    organization_name: varchar('organization_name', { length: 255 }).notNull(),
    student_limit: integer('student_limit').notNull().default(1000),
    staff_limit: integer('staff_limit').notNull().default(50),

    // JSONB settings columns
    general_settings: jsonb('general_settings').notNull().default({}).$type<GeneralSettings>(),
    language_settings: jsonb('language_settings').notNull().default({}).$type<LanguageSettings>(),
    branding_settings: jsonb('branding_settings').notNull().default({}).$type<BrandingSettings>(),
    payment_settings: jsonb('payment_settings').notNull().default({}).$type<PaymentSettings>(),
    security_settings: jsonb('security_settings').notNull().default({}).$type<SecuritySettings>(),

    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    singletonIndex: index('idx_workspace_settings_singleton').on(table.singleton_key),
  })
)

// ---------------------------------------------------------------------------
// workspace_settings_audit
// ---------------------------------------------------------------------------

export const workspaceSettingsAudit = pgTable(
  'workspace_settings_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspace_id: uuid('workspace_id').notNull(),
    user_id: uuid('user_id').notNull(),
    settings_group: varchar('settings_group', { length: 30 }).notNull(),
    config_version: integer('config_version').notNull(),
    changes: jsonb('changes').notNull(),
    request_id: varchar('request_id', { length: 50 }).notNull(),
    ip_address: text('ip_address'), // INET stored as text for Drizzle compatibility
    user_agent: text('user_agent'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Guardian audit: composite index for cursor-based pagination
    workspaceCreatedId: index('idx_wsa_workspace_created_id').on(
      table.workspace_id,
      table.created_at,
      table.id
    ),
    settingsGroupIndex: index('idx_wsa_settings_group').on(table.settings_group),
    configVersionIndex: index('idx_wsa_config_version').on(table.config_version),
  })
)
