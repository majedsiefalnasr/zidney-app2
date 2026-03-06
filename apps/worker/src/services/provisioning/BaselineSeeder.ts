/**
 * BaselineSeeder - Seed baseline data into newly provisioned tenant databases
 *
 * Purpose: Initialize baseline roles, permissions, languages, divisions, settings
 * Design: Idempotent seeding (INSERT ... ON CONFLICT DO NOTHING)
 *
 * Task: T011 – Implement Baseline Data Seeder
 * Phase: 01 – Platform Foundation
 * Stage: STAGE_05_TENANT_PROVISIONING_SERVICE
 */

import { logger } from '@zidney/logger'
import type { Pool, PoolClient } from 'pg'

export interface SeedResult {
  roles_seeded: number
  permissions_seeded: number
  languages_seeded: number
  divisions_seeded: number
  settings_seeded: number
  total_seeded: number
  duration_ms: number
}

/**
 * BaselineSeeder: Seeds structural baseline data
 */
export class BaselineSeeder {
  async seedAllData(pool: Pool): Promise<SeedResult> {
    const client = await pool.connect()
    const start_time = Date.now()
    let total_seeded = 0

    try {
      const roles_seeded = await this.seedRoles(client)
      const permissions_seeded = await this.seedPermissions(client)
      const languages_seeded = await this.seedLanguages(client)
      const divisions_seeded = await this.seedDivisions(client)
      const settings_seeded = await this.seedSettings(client)

      total_seeded =
        roles_seeded + permissions_seeded + languages_seeded + divisions_seeded + settings_seeded

      return {
        roles_seeded,
        permissions_seeded,
        languages_seeded,
        divisions_seeded,
        settings_seeded,
        total_seeded,
        duration_ms: Date.now() - start_time,
      }
    } finally {
      client.release()
    }
  }

  /**
   * Seed default roles
   */
  private async seedRoles(client: PoolClient): Promise<number> {
    const roles = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Admin',
        description: 'Administrator with full workspace access',
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Instructor',
        description: 'Instructor with exam creation and grading access',
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Student',
        description: 'Student with exam attempt access',
      },
    ]

    let count = 0
    for (const role of roles) {
      try {
        await client.query(
          `
          INSERT INTO roles (id, name, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (name) DO NOTHING
          `,
          [role.id, role.name, role.description]
        )
        count++
      } catch (error) {
        logger.error('baseline_seed_role_failed', { role_name: role.name, error: String(error) })
      }
    }

    return count
  }

  /**
   * Seed default permissions for roles
   */
  private async seedPermissions(client: PoolClient): Promise<number> {
    const permissions = [
      // Admin permissions
      {
        role_id: '00000000-0000-0000-0000-000000000001',
        permission_name: 'workspace:manage',
      },
      {
        role_id: '00000000-0000-0000-0000-000000000001',
        permission_name: 'users:manage',
      },
      {
        role_id: '00000000-0000-0000-0000-000000000001',
        permission_name: 'exams:manage',
      },
      {
        role_id: '00000000-0000-0000-0000-000000000001',
        permission_name: 'reports:view',
      },
      {
        role_id: '00000000-0000-0000-0000-000000000001',
        permission_name: 'settings:manage',
      },
      // Instructor permissions
      {
        role_id: '00000000-0000-0000-0000-000000000002',
        permission_name: 'exams:create',
      },
      {
        role_id: '00000000-0000-0000-0000-000000000002',
        permission_name: 'exams:edit',
      },
      {
        role_id: '00000000-0000-0000-0000-000000000002',
        permission_name: 'exams:delete',
      },
      {
        role_id: '00000000-0000-0000-0000-000000000002',
        permission_name: 'attempts:grade',
      },
      {
        role_id: '00000000-0000-0000-0000-000000000002',
        permission_name: 'attempts:view',
      },
      {
        role_id: '00000000-0000-0000-0000-000000000002',
        permission_name: 'reports:view',
      },
      // Student permissions
      {
        role_id: '00000000-0000-0000-0000-000000000003',
        permission_name: 'exams:attempt',
      },
      {
        role_id: '00000000-0000-0000-0000-000000000003',
        permission_name: 'attempts:submit',
      },
      {
        role_id: '00000000-0000-0000-0000-000000000003',
        permission_name: 'certificates:view',
      },
    ]

    let count = 0
    for (const perm of permissions) {
      try {
        await client.query(
          `
          INSERT INTO role_permissions (role_id, permission_name)
          VALUES ($1, $2)
          ON CONFLICT (role_id, permission_name) DO NOTHING
          `,
          [perm.role_id, perm.permission_name]
        )
        count++
      } catch (error) {
        logger.error('baseline_seed_permission_failed', {
          permission_name: perm.permission_name,
          error: String(error),
        })
      }
    }

    return count
  }

  /**
   * Seed supported languages
   */
  private async seedLanguages(_client: PoolClient): Promise<number> {
    // Note: Languages stored as settings/configuration, not in dedicated table
    // This is a placeholder for future language management
    return 0
  }

  /**
   * Seed default divisions
   */
  private async seedDivisions(client: PoolClient): Promise<number> {
    const divisions = [
      {
        id: '00000000-0000-0000-0000-000000000011',
        name: 'Main Division',
        description: 'Default organizational division (cannot be deleted)',
      },
    ]

    let count = 0
    for (const div of divisions) {
      try {
        await client.query(
          `
          INSERT INTO divisions (id, name, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (name) DO NOTHING
          `,
          [div.id, div.name, div.description]
        )
        count++
      } catch (error) {
        logger.error('baseline_seed_division_failed', {
          division_name: div.name,
          error: String(error),
        })
      }
    }

    return count
  }

  /**
   * Seed default settings
   */
  private async seedSettings(client: PoolClient): Promise<number> {
    const settings = [
      { key: 'timezone', value: 'UTC' },
      { key: 'date_format', value: 'YYYY-MM-DD' },
      { key: 'time_format', value: 'HH:mm:ss' },
      { key: 'language', value: 'en' },
      { key: 'exam_auto_submit_on_timeout', value: 'true' },
      { key: 'attempt_submission_lock_duration_hours', value: '24' },
    ]

    let count = 0
    for (const setting of settings) {
      try {
        await client.query(
          `
          INSERT INTO settings (key, value)
          VALUES ($1, $2)
          ON CONFLICT (key) DO NOTHING
          `,
          [setting.key, setting.value]
        )
        count++
      } catch (error) {
        logger.error('baseline_seed_setting_failed', {
          setting_key: setting.key,
          error: String(error),
        })
      }
    }

    return count
  }
}

export default BaselineSeeder
