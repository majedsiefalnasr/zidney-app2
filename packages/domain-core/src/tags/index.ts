/**
 * Tags domain package barrel.
 *
 * File: packages/domain-core/src/tags/index.ts
 * Stage: STAGE_32_TAGS
 *
 * Re-exports the public API of the tags domain.
 * External callers (API routes) import from '@zidney/domain-core/tags'.
 */

export * from './tags.dependency-registry'
export * from './tags.errors'
export * from './tags.service'
// Selective type re-exports to keep the public surface explicit
export type {
  AuditContext,
  CreateTagInput,
  CreateTagRelationInput,
  DbClient,
  DeleteTagRelationResult,
  DeleteTagResult,
  ListEntityTagsInput,
  ListTagEntitiesInput,
  ListTagEntitiesResult,
  ListTagsInput,
  ListTagsResult,
  TagEntityType,
  TagRelationRow,
  TagRow,
  TagStatus,
  UpdateTagInput,
} from './tags.types'
// Value re-exports
export { VALID_ENTITY_TYPES } from './tags.types'
