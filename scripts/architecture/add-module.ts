#!/usr/bin/env bun
/**
 * @script arch:add-module
 * @domain arch
 * @category dev
 * @description Register a new module path in ARCHITECTURE_MAP.json with the
 *   default architecture metadata scaffold.
 * @usage bun run arch:add-module <module-path>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exit, hasCiFlag, log } from '../utils/logger'

const ROOT = process.cwd()

const mapPath = join(ROOT, 'docs', 'architecture', 'intelligence', 'ARCHITECTURE_MAP.json')

const args = process.argv.slice(2)
const isCi = hasCiFlag(args)
const moduleName = args.find((arg) => !arg.startsWith('--'))
const SCRIPT = 'arch:add-module'
log.setScript(SCRIPT)
log.start('Add architecture module')

if (isCi) {
  log.error('arch:add-module is a local mutation helper and cannot run with --ci')
  exit(1)
}

if (!moduleName) {
  log.error('Usage: bun run arch:add-module <module-path>')
  exit(1)
}

if (!existsSync(mapPath)) {
  log.error('ARCHITECTURE_MAP.json not found')
  exit(1)
}

const json = JSON.parse(readFileSync(mapPath, 'utf-8'))

if (json.modules[moduleName]) {
  log.error(`Module already exists: ${moduleName}`)
  exit(1)
}

json.modules[moduleName] = {
  layer: 'domain',
  description: '',
  criticality: 'core',
  allowed_dependencies: [],
  forbidden_dependencies: [],
}

writeFileSync(mapPath, JSON.stringify(json, null, 2))

log.success(`Module added to ARCHITECTURE_MAP.json: ${moduleName}`)
log.badge('MODULE ADDED', 'success')
log.progressResult({ success: 1 }, { title: `Module Added: ${moduleName}`, showPercentage: false })
exit(0)
