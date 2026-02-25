/**
 * Seed Data Migration - Default Roles and Permissions
 *
 * File: apps/api/src/db/master/migrations/20260225_006_seed_roles_and_permissions.ts
 * Task: T006
 * Phase: 1 - Database Migration & Schema Setup
 *
 * Seed data migration that creates:
 * - 7 permission domains (all permissions table)
 * - 3 default roles with predefined permissions:
 *   1. Platform Administrator (full access)
 *   2. Sales Team (client/product/affiliate management)
 *   3. Support (reporting/members view)
 *
 * Properties:
 * - Transaction: YES (single atomic transaction)
 * - Idempotency: YES (IF NOT EXISTS / ON CONFLICT)
 * - Rollback: Deletes seeded roles/permissions
 * - Dependencies: roles and role_permissions tables must exist
 */

import { PoolClient } from 'pg'

export const description = 'Seed default roles and permissions for MMC'

/**
 * Execute schema migration
 */
export async function up(client: PoolClient): Promise<void> {
  // Create default roles
  const platformAdminResult = await client.query(`
    INSERT INTO roles (name, description, status)
    VALUES (
      'Platform Administrator',
      'Full platform access; can manage members, products, licenses, and reporting',
      'ACTIVE'
    )
    ON CONFLICT (name) DO NOTHING
    RETURNING id;
  `)

  const salesTeamResult = await client.query(`
    INSERT INTO roles (name, description, status)
    VALUES (
      'Sales Team',
      'Manage clients, products, and affiliate partnerships',
      'ACTIVE'
    )
    ON CONFLICT (name) DO NOTHING
    RETURNING id;
  `)

  const supportResult = await client.query(`
    INSERT INTO roles (name, description, status)
    VALUES (
      'Support',
      'View reporting, audit logs, and member information',
      'ACTIVE'
    )
    ON CONFLICT (name) DO NOTHING
    RETURNING id;
  `)

  const platformAdminId =
    platformAdminResult.rows[0]?.id ||
    (
      await client.query(
        `SELECT id FROM roles WHERE name = 'Platform Administrator'`
      )
    ).rows[0].id

  const salesTeamId =
    salesTeamResult.rows[0]?.id ||
    (await client.query(`SELECT id FROM roles WHERE name = 'Sales Team'`))
      .rows[0].id

  const supportId =
    supportResult.rows[0]?.id ||
    (await client.query(`SELECT id FROM roles WHERE name = 'Support'`)).rows[0]
      .id

  // Define permission matrix for each role
  // Platform Administrator: Full access (can_view, can_create, can_edit, can_delete = TRUE for all)
  // Sales Team: PRODUCT_MANAGEMENT, CLIENT_MANAGEMENT, AFFILIATE_MANAGEMENT (full), plus view access to others
  // Support: REPORTING, MEMBERS_MANAGEMENT (view only), plus limited access to others

  const permissions = [
    // Platform Administrator - Full access to all domains
    {
      roleId: platformAdminId,
      domain: 'ORGANIZATION_SETTINGS',
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    {
      roleId: platformAdminId,
      domain: 'PRODUCT_MANAGEMENT',
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    {
      roleId: platformAdminId,
      domain: 'LICENSE_MANAGEMENT',
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    {
      roleId: platformAdminId,
      domain: 'CLIENT_MANAGEMENT',
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    {
      roleId: platformAdminId,
      domain: 'AFFILIATE_MANAGEMENT',
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    {
      roleId: platformAdminId,
      domain: 'MEMBERS_MANAGEMENT',
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    {
      roleId: platformAdminId,
      domain: 'REPORTING',
      view: true,
      create: true,
      edit: true,
      delete: true,
    },

    // Sales Team - Manage client-facing operations
    {
      roleId: salesTeamId,
      domain: 'ORGANIZATION_SETTINGS',
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    {
      roleId: salesTeamId,
      domain: 'PRODUCT_MANAGEMENT',
      view: true,
      create: true,
      edit: true,
      delete: false,
    },
    {
      roleId: salesTeamId,
      domain: 'LICENSE_MANAGEMENT',
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    {
      roleId: salesTeamId,
      domain: 'CLIENT_MANAGEMENT',
      view: true,
      create: true,
      edit: true,
      delete: false,
    },
    {
      roleId: salesTeamId,
      domain: 'AFFILIATE_MANAGEMENT',
      view: true,
      create: true,
      edit: true,
      delete: false,
    },
    {
      roleId: salesTeamId,
      domain: 'MEMBERS_MANAGEMENT',
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    {
      roleId: salesTeamId,
      domain: 'REPORTING',
      view: true,
      create: false,
      edit: false,
      delete: false,
    },

    // Support - View-only access with limited edit for members
    {
      roleId: supportId,
      domain: 'ORGANIZATION_SETTINGS',
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    {
      roleId: supportId,
      domain: 'PRODUCT_MANAGEMENT',
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    {
      roleId: supportId,
      domain: 'LICENSE_MANAGEMENT',
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    {
      roleId: supportId,
      domain: 'CLIENT_MANAGEMENT',
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    {
      roleId: supportId,
      domain: 'AFFILIATE_MANAGEMENT',
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    {
      roleId: supportId,
      domain: 'MEMBERS_MANAGEMENT',
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    {
      roleId: supportId,
      domain: 'REPORTING',
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
  ]

  // Insert permissions
  for (const perm of permissions) {
    await client.query(
      `
      INSERT INTO role_permissions (role_id, domain, can_view, can_create, can_edit, can_delete)
      VALUES ($1, $2::permission_domain, $3, $4, $5, $6)
      ON CONFLICT (role_id, domain) DO NOTHING;
    `,
      [perm.roleId, perm.domain, perm.view, perm.create, perm.edit, perm.delete]
    )
  }

  console.log('✓ Seeded 3 default roles and 21 permission entries')
}

/**
 * Rollback: Delete seeded roles (cascade deletes permissions)
 */
export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DELETE FROM roles
    WHERE name IN ('Platform Administrator', 'Sales Team', 'Support')
    AND created_at > NOW() - INTERVAL '1 minute';
  `)
}
