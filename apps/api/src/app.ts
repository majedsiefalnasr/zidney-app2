import { Hono } from 'hono'

// Utility
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// ============================================================================
// MIDDLEWARE IMPORTS (Strict Order: request-id → tenant → license → correlation → redaction)
// ============================================================================

// PHASE 1: Request ID middleware (mandatory first - generates unique request tracking ID)
import { requestIdMiddleware } from './middleware/request-id'

// Correlation ID middleware (legacy, for backward compatibility)
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

// PHASE 1: Correlation context middleware (mandatory after license - binds logger context)
import { correlationMiddleware } from './middleware/correlation'

// PHASE 1: Redaction middleware (optional, applied for defense-in-depth)
import { redactionMiddleware } from './middleware/redaction'

// Route registration (Phase C, Phase D)
import { registerStage06Routes } from './routes/attempts/index-stage06'
import { registerStage06PhaseDRoutes } from './routes/attempts/submit-index'

// Utility logger
import { createLogger } from '@zidney/logger'

// ============================================================================
// APPLICATION SETUP
// ============================================================================

const app = new Hono()

// ============================================================================
// GLOBAL MIDDLEWARE (Applied to all routes)
// ============================================================================

// STEP 1: Request ID middleware (MUST be first - generates unique request ID per request)
// Sets: c.get('request_id'), c.req.context.request_id, response header x-request-id
app.use('*', requestIdMiddleware())

// STEP 2: Correlation ID (legacy, for backward compatibility)
app.use('*', correlationIdMiddleware)

// ============================================================================
// WORKSPACE-SCOPED ROUTES (with full middleware stack)
// ============================================================================

// STEP 2: Tenant Resolver (extract workspace from subdomain/path)
app.use('/api/workspaces/*', tenantResolver)

// STEP 3: License Validation (verify ACTIVE/TRIAL status)
app.use('/api/workspaces/*', licenseMiddleware)

// STEP 4: Schema Version Validation (verify schema compatibility)
app.use('/api/workspaces/*', schemaVersionMiddleware)

// STEP 5: Correlation Context middleware (bind child logger with request context)
// Sets: c.get('logger'), c.req.context.logger
// Logs: request_received, request_completed
app.use('/api/workspaces/*', correlationMiddleware())

// STEP 6: Redaction middleware (sanitize sensitive data)
app.use('/api/workspaces/*', redactionMiddleware())

// Route handlers for workspace operations go here
// Routes registered after middleware will have full tenant context

// ============================================================================
// STAGE 06 ATTEMPT ENGINE ROUTES
// ============================================================================

const logger = createLogger('app')

// Register Phase C routes (create, progress, status)
registerStage06Routes(app, logger)

// Register Phase D routes (submit, result)
registerStage06PhaseDRoutes(app, logger)

// ============================================================================
// PUBLIC ROUTES (no tenant context required)
// ============================================================================

// Health checks, auth, etc. (no middleware dependency)
app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
