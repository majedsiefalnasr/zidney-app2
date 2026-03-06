import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()

const mapPath = join(
  ROOT,
  'docs',
  'architecture',
  'intelligence',
  'ARCHITECTURE_MAP.json'
)

const moduleName = process.argv[2]

if (!moduleName) {
  console.error('Usage: bun arch:add-module <module-path>')
  process.exit(1)
}

if (!existsSync(mapPath)) {
  console.error('ARCHITECTURE_MAP.json not found')
  process.exit(1)
}

const json = JSON.parse(readFileSync(mapPath, 'utf-8'))

if (json.modules[moduleName]) {
  console.error(`Module already exists: ${moduleName}`)
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

console.log(`Module added to ARCHITECTURE_MAP.json:`)
console.log(moduleName)
