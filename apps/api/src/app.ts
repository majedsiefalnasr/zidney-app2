import { Hono } from 'hono'

// Utility
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// ============================================================================
// MIDDLEWARE IMPORTS (Strict Order: correlationId → tenant → license → schema)
// ============================================================================

// Correlation ID middleware (mandatory first)
const correlationIdMiddleware = async (c: any, next: any) => {
  const correlationId = c.req.header('x-correlation-id') || generateId()
  c.set('correlationId', correlationId)
  await next()
}

// Tenant resolver middleware (mandatory second)
import { tenantResolver } from './middleware/tenant-resolver'

// License validation middleware (mandatory third)
import licenseMiddleware from './middleware/license'

// Schema version validation middleware (mandatory fourth)
import schemaVersionMiddleware from './middleware/schema-version'

// ============================================================================
// APPLICATION SETUP
// ============================================================================

const app = new Hono()

// ============================================================================
// GLOBAL MIDDLEWARE (Applied to all routes)
// ============================================================================

// Step 1: Correlation ID (must be first - generates request tracking ID)
app.use('*', correlationIdMiddleware)

// ============================================================================
// WORKSPACE-SCOPED ROUTES (with full middleware stack)
// ============================================================================

// Step 2: Tenant Resolver (extract workspace from subdomain/path)
// Step 3: License Validation (verify ACTIVE/TRIAL status)
// Step 4: Schema Version Validation (verify schema compatibility)
app.use('/api/workspaces/*', tenantResolver)
app.use('/api/workspaces/*', licenseMiddleware)
app.use('/api/workspaces/*', schemaVersionMiddleware)

// Route handlers for workspace operations go here
// Routes registered after middleware will have full tenant context

// ============================================================================
// PUBLIC ROUTES (no tenant context required)
// ============================================================================

// Health checks, auth, etc. (no middleware dependency)
app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
