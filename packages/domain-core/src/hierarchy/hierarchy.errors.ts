/**
 * Hierarchy Domain — Custom Errors
 */

export type HierarchyErrorCode =
  | 'HIERARCHY_NODE_NOT_FOUND'
  | 'HIERARCHY_NODE_NAME_DUPLICATE'
  | 'HIERARCHY_NODE_PARENT_NOT_FOUND'
  | 'HIERARCHY_NODE_SELF_REFERENCE'
  | 'HIERARCHY_NODE_CYCLE_DETECTED'
  | 'HIERARCHY_NODE_HAS_CHILDREN'
  | 'HIERARCHY_NODE_HAS_STAFF'
  | 'HIERARCHY_NODE_DISABLED'
  | 'HIERARCHY_NODE_DEPENDENCY_VIOLATION'
  | 'HIERARCHY_TRAVERSAL_TIMEOUT'
  | 'VALIDATION_ERROR'

export const HIERARCHY_ERROR_HTTP_STATUS: Record<HierarchyErrorCode, number> = {
  HIERARCHY_NODE_NOT_FOUND: 404,
  HIERARCHY_NODE_NAME_DUPLICATE: 409,
  HIERARCHY_NODE_PARENT_NOT_FOUND: 422,
  HIERARCHY_NODE_SELF_REFERENCE: 422,
  HIERARCHY_NODE_CYCLE_DETECTED: 422,
  HIERARCHY_NODE_HAS_CHILDREN: 422,
  HIERARCHY_NODE_HAS_STAFF: 422,
  HIERARCHY_NODE_DISABLED: 422,
  HIERARCHY_NODE_DEPENDENCY_VIOLATION: 422,
  HIERARCHY_TRAVERSAL_TIMEOUT: 503,
  VALIDATION_ERROR: 422,
}

export const HIERARCHY_ERROR_MESSAGES: Record<HierarchyErrorCode, string> = {
  HIERARCHY_NODE_NOT_FOUND: 'Hierarchy node not found.',
  HIERARCHY_NODE_NAME_DUPLICATE: 'A hierarchy node with this name already exists in this scope.',
  HIERARCHY_NODE_PARENT_NOT_FOUND: 'Parent hierarchy node not found.',
  HIERARCHY_NODE_SELF_REFERENCE: 'A hierarchy node cannot be its own parent.',
  HIERARCHY_NODE_CYCLE_DETECTED: 'Reparenting would create a circular hierarchy.',
  HIERARCHY_NODE_HAS_CHILDREN: 'Hierarchy node has child nodes and cannot be deleted.',
  HIERARCHY_NODE_HAS_STAFF: 'Hierarchy node has staff assignments and cannot be deleted.',
  HIERARCHY_NODE_DISABLED: 'Hierarchy node is disabled.',
  HIERARCHY_NODE_DEPENDENCY_VIOLATION: 'Hierarchy node is referenced by other records.',
  HIERARCHY_TRAVERSAL_TIMEOUT: 'Hierarchy traversal exceeded the allowed time budget.',
  VALIDATION_ERROR: 'Request validation failed.',
}

export class HierarchyError extends Error {
  constructor(
    public code: HierarchyErrorCode,
    public message: string = HIERARCHY_ERROR_MESSAGES[code],
    public httpStatus: number = HIERARCHY_ERROR_HTTP_STATUS[code]
  ) {
    super(message)
    this.name = 'HierarchyError'
  }
}
