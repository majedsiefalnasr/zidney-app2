// Licenses module TypeScript types stub
// Populated in subsequent feature stages

export interface License {
  id: string
  workspaceId: string
  status: 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED'
  productVersion: string
  schemaVersion: number
}
