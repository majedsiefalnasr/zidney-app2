import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { flushAi, log } from '../utils/logger'

const ROOT = process.cwd()

const mapPath = join(ROOT, 'docs', 'architecture', 'intelligence', 'ARCHITECTURE_MAP.json')

const moduleName = process.argv[2]
const SCRIPT = 'arch:add-module'
log.setScript(SCRIPT)
log.start('Add architecture module')

if (!moduleName) {
  log.error('Usage: bun arch:add-module <module-path>')
  process.exit(1)
}

if (!existsSync(mapPath)) {
  log.error('ARCHITECTURE_MAP.json not found')
  process.exit(1)
}

const json = JSON.parse(readFileSync(mapPath, 'utf-8'))

if (json.modules[moduleName]) {
  log.error(`Module already exists: ${moduleName}`)
  process.exit(1)
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
flushAi()
