/**
 * Shared types for script-system governance validators.
 
 * @library-module
*/

/** A single script entry parsed from a package.json scripts block. */
export interface ScriptEntry {
  /** The key name, e.g. "validate:scripts:naming" */
  name: string
  /** The command value, e.g. "bun scripts/validate/script-naming.ts" */
  command: string
  /** Absolute path to the package.json file this entry came from */
  packageFile: string
  /** Workspace name (directory name), or null for the root */
  workspaceName: string | null
}

/** A single governance violation found during validation. */
export interface ViolationRecord {
  rule: string
  file: string
  line?: number
  scriptName?: string
  message: string
  hint?: string
}

/** An entry in the SCRIPT_MIGRATION_MAP describing an old→new rename. */
export interface MigrationEntry {
  oldName: string
  /** Type A: non-compliant prefix | B: wrong separator | C: redundant domain | D: old legacy name | E: alias */
  type: 'A' | 'B' | 'C' | 'D' | 'E'
  violation: string
  newName: string
}

/** A single script entry parsed from a package.json scripts block. */
export interface ScriptEntry {
  /** The key name, e.g. "validate:scripts:naming" */
  name: string
  /** The command value, e.g. "bun scripts/validate/script-naming.ts" */
  command: string
  /** Absolute path to the package.json file this entry came from */
  packageFile: string
  /** Workspace name (directory name), or null for the root */
  workspaceName: string | null
}

/** A single governance violation found during validation. */
export interface ViolationRecord {
  rule: string
  file: string
  line?: number
  scriptName?: string
  message: string
  hint?: string
}

/** An entry in the SCRIPT_MIGRATION_MAP describing an old→new rename. */
export interface MigrationEntry {
  oldName: string
  /** Type A: non-compliant prefix | B: wrong separator | C: redundant domain | D: old legacy name | E: alias */
  type: 'A' | 'B' | 'C' | 'D' | 'E'
  violation: string
  newName: string
}
