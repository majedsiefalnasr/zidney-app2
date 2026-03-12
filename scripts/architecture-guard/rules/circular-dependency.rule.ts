import { existsSync, readFileSync } from 'node:fs'
import type { GuardRule, RuleContext, RuleResult, ViolationRecord } from '../types'

interface DependencyGraph {
  modules?: string[] | Record<string, unknown>
  edges?: Array<{ from: string; to: string }>
}

function loadGraph(repoRoot: string): DependencyGraph {
  const graphPath = `${repoRoot}/docs/ai/context/ai-dependency-graph.json`
  if (!existsSync(graphPath)) {
    return {}
  }

  try {
    return JSON.parse(readFileSync(graphPath, 'utf-8')) as DependencyGraph
  } catch {
    return {}
  }
}

function detectCycles(graph: DependencyGraph, scopeModules: Set<string>): string[][] {
  const adjacency = new Map<string, string[]>()
  const modules = Array.isArray(graph.modules) ? graph.modules : Object.keys(graph.modules ?? {})

  for (const module of modules) {
    if (scopeModules.size === 0 || scopeModules.has(module)) {
      adjacency.set(module, [])
    }
  }

  for (const edge of graph.edges ?? []) {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) {
      continue
    }
    adjacency.get(edge.from)?.push(edge.to)
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const stack: string[] = []
  const cycles: string[][] = []
  const seenKeys = new Set<string>()

  const dfs = (node: string): void => {
    visiting.add(node)
    stack.push(node)

    for (const neighbor of adjacency.get(node) ?? []) {
      if (!visited.has(neighbor) && visiting.has(neighbor)) {
        const index = stack.indexOf(neighbor)
        if (index >= 0) {
          const cycle = [...stack.slice(index), neighbor]
          const key = cycle.join(' -> ')
          if (!seenKeys.has(key)) {
            cycles.push(cycle)
            seenKeys.add(key)
          }
        }
      } else if (!visited.has(neighbor)) {
        dfs(neighbor)
      }
    }

    stack.pop()
    visiting.delete(node)
    visited.add(node)
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node)
    }
  }

  return cycles
}

export async function runCircularDependencyRule(context: RuleContext): Promise<RuleResult> {
  const graph = loadGraph(context.repoRoot)
  const scope = context.scopeModules.size > 0 ? context.scopeModules : new Set(context.allModules)
  const cycles = detectCycles(graph, scope)

  const violations: ViolationRecord[] = cycles.map((cycle) => ({
    rule: 'circular-dependency',
    severity: 'error',
    message: `Circular dependency detected: ${cycle.join(' -> ')}`,
    location: {
      file: 'docs/ai/context/ai-dependency-graph.json',
    },
    source_module: cycle[0] ?? 'unknown',
    target_module: cycle[1],
    remediation: '',
  }))

  return {
    rule: 'circular-dependency',
    violations,
  }
}

export const circularDependencyRule: GuardRule = {
  id: 'circular-dependency',
  order: 20,
  enabledIn: ['development', 'strict', 'changed'],
  run: runCircularDependencyRule,
}
