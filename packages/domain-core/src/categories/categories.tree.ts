/**
 * Categories — Tree Assembly (O(N) flat-to-tree)
 *
 * File: packages/domain-core/src/categories/categories.tree.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Accepts all categories as a flat list and assembles them into a forest
 * (list of root trees). Uses a single-pass Map approach — O(N).
 */

import type { CategoryTreeNode, ScopedCategoryRow } from './categories.types'

/**
 * Build a category forest from a flat list of scoped category rows.
 *
 * Nodes without a `parent_id`, or whose parent is not in the input set,
 * become root nodes. Children are ordered by `created_at ASC` (preserved
 * from the data layer sort order).
 */
export function buildCategoryTree(flat: ScopedCategoryRow[]): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>()

  // First pass — build all nodes with empty children arrays
  for (const row of flat) {
    map.set(row.id, { ...row, children: [] })
  }

  const roots: CategoryTreeNode[] = []

  // Second pass — attach each node to its parent or to roots
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)?.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}
