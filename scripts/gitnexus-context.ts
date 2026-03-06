import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BRAIN_PATH = resolve(process.cwd(), 'docs/ai/context/ai-architecture-brain.json')

function loadBrain() {
  if (!existsSync(BRAIN_PATH)) {
    console.error('❌ ai-architecture-brain.json not found.')
    console.error('Run: bun scripts/infra-audit.ts')
    process.exit(1)
  }

  const raw = readFileSync(BRAIN_PATH, 'utf-8')
  return JSON.parse(raw)
}

function printHeader(title: string) {
  console.log(`\n=== ${title} ===`)
}

function main() {
  const brain = loadBrain()

  console.log('\nZidney Architecture Context')
  console.log('============================')

  if (brain.architectureScore !== undefined) {
    console.log(`Architecture Score: ${brain.architectureScore}`)
  }

  if (brain.gitSha) {
    console.log(`Git SHA: ${brain.gitSha}`)
  }

  if (brain.modules) {
    printHeader('Modules')
    for (const m of brain.modules) {
      console.log(`- ${m}`)
    }
  }

  if (brain.hotspots?.length) {
    printHeader('Hotspot Modules')
    for (const h of brain.hotspots) {
      console.log(`- ${h.module} (score: ${h.score})`)
    }
  }

  if (brain.rules) {
    printHeader('Architecture Rules')

    if (brain.rules.layerRules) {
      console.log('Layer Rules:')
      console.log(JSON.stringify(brain.rules.layerRules, null, 2))
    }

    if (brain.rules.dependencyRules) {
      console.log('Dependency Rules:')
      console.log(JSON.stringify(brain.rules.dependencyRules, null, 2))
    }
  }

  if (brain.architectureDrift?.length) {
    printHeader('Architecture Drift')
    for (const d of brain.architectureDrift) {
      console.log(`- ${d}`)
    }
  }
}

main()
