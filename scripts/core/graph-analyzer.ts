/**
 * Graph Analyzer Utility
 *
 * Purpose: Extract graph analysis and traversal functions
 * Used by: infra-audit, architecture-diff, ai-guard
 *
 * Provides:
 * - Cycle detection (DFS)
 * - Topological sort
 * - Reachability analysis
 * - Path finding
 */

export interface GraphEdge {
  from: string
  to: string
  weight?: number
  metadata?: Record<string, unknown>
}

export interface GraphNode {
  id: string
  metadata?: Record<string, unknown>
}

export interface CycleDetectionResult {
  hasCycle: boolean
  cycle?: string[]
  cycleNodes?: Set<string>
}

export interface ReachabilityResult {
  reachable: Set<string>
  distance: Map<string, number>
}

/**
 * Build adjacency list from edges
 */
export function buildAdjacencyList(edges: GraphEdge[]): Map<string, Set<string>> {
  const adjacencyList = new Map<string, Set<string>>()

  // Initialize all nodes first
  for (const edge of edges) {
    if (!adjacencyList.has(edge.from)) {
      adjacencyList.set(edge.from, new Set())
    }
    if (!adjacencyList.has(edge.to)) {
      adjacencyList.set(edge.to, new Set())
    }
  }

  // Add edges
  for (const edge of edges) {
    adjacencyList.get(edge.from)?.add(edge.to)
  }

  return adjacencyList
}

/**
 * Detect cycles using DFS (returns first cycle found)
 */
export function detectCycles(edges: GraphEdge[]): CycleDetectionResult {
  const adjacencyList = buildAdjacencyList(edges)
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const cycleNodes = new Set<string>()
  let foundCycle: string[] | undefined

  function dfs(node: string, path: string[]): boolean {
    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const neighbors = adjacencyList.get(node) || new Set()
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path])) {
          return true
        }
      } else if (recursionStack.has(neighbor)) {
        // Cycle detected
        const cycleStart = path.indexOf(neighbor)
        foundCycle = path.slice(cycleStart).concat([neighbor])
        for (const n of foundCycle) {
          cycleNodes.add(n)
        }
        return true
      }
    }

    recursionStack.delete(node)
    return false
  }

  for (const node of adjacencyList.keys()) {
    if (!visited.has(node)) {
      if (dfs(node, [])) {
        return {
          hasCycle: true,
          cycle: foundCycle,
          cycleNodes,
        }
      }
    }
  }

  return {
    hasCycle: false,
    cycle: undefined,
    cycleNodes: new Set(),
  }
}

/**
 * Topological sort using DFS
 */
export function topologicalSort(edges: GraphEdge[]): string[] {
  const adjacencyList = buildAdjacencyList(edges)
  const visited = new Set<string>()
  const stack: string[] = []

  function dfs(node: string): void {
    visited.add(node)
    const neighbors = adjacencyList.get(node) || new Set()
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor)
      }
    }
    stack.push(node)
  }

  for (const node of adjacencyList.keys()) {
    if (!visited.has(node)) {
      dfs(node)
    }
  }

  return stack.reverse()
}

/**
 * Find all nodes reachable from a starting node
 */
export function findReachable(edges: GraphEdge[], startNode: string): ReachabilityResult {
  const adjacencyList = buildAdjacencyList(edges)
  const reachable = new Set<string>()
  const distance = new Map<string, number>()
  const queue: [string, number][] = [[startNode, 0]]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const item = queue.shift()
    if (!item) break
    const [node, dist] = item

    if (visited.has(node)) {
      continue
    }

    visited.add(node)
    reachable.add(node)
    distance.set(node, dist)

    const neighbors = adjacencyList.get(node) || new Set()
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push([neighbor, dist + 1])
      }
    }
  }

  return { reachable, distance }
}

/**
 * Find shortest path between two nodes
 */
export function findShortestPath(edges: GraphEdge[], from: string, to: string): string[] | null {
  if (from === to) {
    return [from]
  }

  const adjacencyList = buildAdjacencyList(edges)
  const queue: [string, string[]][] = [[from, [from]]]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const item = queue.shift()
    if (!item) break
    const [node, path] = item

    if (visited.has(node)) {
      continue
    }

    if (node === to) {
      return path
    }

    visited.add(node)
    const neighbors = adjacencyList.get(node) || new Set()

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push([neighbor, [...path, neighbor]])
      }
    }
  }

  return null
}

/**
 * Find strongly connected components using Tarjan's algorithm
 */
export function findStronglyConnectedComponents(edges: GraphEdge[]): Set<string>[] {
  const adjacencyList = buildAdjacencyList(edges)
  const index = new Map<string, number>()
  const lowLink = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const components: Set<string>[] = []
  let indexCounter = 0

  function strongconnect(node: string): void {
    index.set(node, indexCounter)
    lowLink.set(node, indexCounter)
    indexCounter++
    stack.push(node)
    onStack.add(node)

    const neighbors = adjacencyList.get(node) || new Set()
    for (const neighbor of neighbors) {
      const neighborIndex = index.get(neighbor)

      if (neighborIndex === undefined) {
        strongconnect(neighbor)
        const neighborLowLink = lowLink.get(neighbor)
        const nodeLow = lowLink.get(node)
        if (neighborLowLink !== undefined && nodeLow !== undefined) {
          lowLink.set(node, Math.min(nodeLow, neighborLowLink))
        }
      } else if (onStack.has(neighbor)) {
        const nodeLow = lowLink.get(node)
        if (nodeLow !== undefined) {
          lowLink.set(node, Math.min(nodeLow, neighborIndex))
        }
      }
    }

    if (lowLink.get(node) === index.get(node)) {
      const component = new Set<string>()
      let w: string | undefined
      do {
        w = stack.pop()
        if (w === undefined) break
        onStack.delete(w)
        component.add(w)
      } while (w !== node)

      components.push(component)
    }
  }

  for (const node of adjacencyList.keys()) {
    if (!index.has(node)) {
      strongconnect(node)
    }
  }

  return components
}

/**
 * Get all nodes in graph
 */
export function getAllNodes(edges: GraphEdge[]): string[] {
  const nodes = new Set<string>()
  for (const edge of edges) {
    nodes.add(edge.from)
    nodes.add(edge.to)
  }
  return Array.from(nodes)
}

/**
 * Get in-degree and out-degree for all nodes
 */
export function getNodeDegrees(
  edges: GraphEdge[]
): Map<string, { inDegree: number; outDegree: number }> {
  const adjacencyList = buildAdjacencyList(edges)
  const inDegree = new Map<string, number>()
  const outDegree = new Map<string, number>()

  for (const node of adjacencyList.keys()) {
    inDegree.set(node, 0)
    outDegree.set(node, adjacencyList.get(node)?.size || 0)
  }

  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
  }

  const degrees = new Map<string, { inDegree: number; outDegree: number }>()
  for (const node of adjacencyList.keys()) {
    degrees.set(node, {
      inDegree: inDegree.get(node) || 0,
      outDegree: outDegree.get(node) || 0,
    })
  }

  return degrees
}
