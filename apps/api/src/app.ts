import { type Context, Hono, type Next } from 'hono'

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
const correlationIdMiddleware = async (c: Context, next: Next) => {
  const correlationId = c.req.header('x-correlation-id') || generateId()
  c.set('correlationId', correlationId)
  await next()
}

// Utility logger
import { createLogger } from '@zidney/logger'
// ============================================================================
// STAGE 17: BACKOFFICE ROUTES + MIDDLEWARE
// ============================================================================
import { validateJwtMiddleware } from './middleware/auth/validate-jwt'
// PHASE 1: Correlation context middleware (mandatory after license - binds logger context)
import { correlationMiddleware } from './middleware/correlation'
// License validation middleware (mandatory third)
import licenseMiddleware from './middleware/license'
import { licenseEnforcementMiddleware } from './middleware/license-enforcement'
import { createRateLimitMiddleware } from './middleware/rate-limit.middleware'
// PHASE 1: Redaction middleware (optional, applied for defense-in-depth)
import { redactionMiddleware } from './middleware/redaction'
// Schema version validation middleware (mandatory fourth)
import schemaVersionMiddleware from './middleware/schema-version'
// Tenant resolver middleware (mandatory second)
import { tenantResolver } from './middleware/tenant-resolver'
// Route registration (Phase C, Phase D)
import { registerStage06Routes } from './routes/attempts/index-stage06'
import { registerStage06PhaseDRoutes } from './routes/attempts/submit-index'
import { backofficeContextRouter } from './routes/backoffice/context'
import { departmentsRouter } from './routes/backoffice/departments/index'
import { divisionsRouter } from './routes/backoffice/divisions/index'
import { rolesRouter } from './routes/backoffice/roles'
import { workspaceSettingsRouter } from './routes/backoffice/settings'
import { translationRouter } from './routes/backoffice/translations/index'
import { workflowRouter } from './routes/backoffice/workflow/index'
import { createBackofficeWsRoute } from './routes/backoffice/ws'

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

// ============================================================================
// STAGE 17: BACKOFFICE MIDDLEWARE CHAIN + ROUTES
// ============================================================================
//
// REST chain: correlationId (global) → tenantResolver → licenseEnforcement → schemaVersion
//             → rateLimit(max:60) → authentication
// Note: correlationIdMiddleware is applied globally at app.use('*') above — not duplicated here.
//
app.use(
  '/api/v1/backoffice/*',
  tenantResolver,
  licenseEnforcementMiddleware,
  schemaVersionMiddleware,
  createRateLimitMiddleware({
    windowMs: 60_000,
    max: 60,
    keyPrefix: 'backoffice',
  }),
  validateJwtMiddleware()
)

// Context endpoint — available to all authenticated staff (no RBAC guard)
app.route('/api/v1', backofficeContextRouter)

// Workspace Settings endpoints — requires institution admin RBAC
app.route('/api/v1/backoffice/workspace', workspaceSettingsRouter)

// Translation endpoints — Stage 019, staff-level authentication inherited from backoffice group
app.route('/api/v1/backoffice/workspace', translationRouter)

// Workflow engine endpoints — Stage 020, staff-level authentication inherited from backoffice group
app.route('/api/v1/backoffice/workspace', workflowRouter)

// Role & Permission endpoints — Stage 021, permission guard applied per route
app.route('/api/v1/backoffice/workspace', rolesRouter)

// Divisions endpoints — Stage 022, permission guard applied per route
app.route('/api/v1/backoffice/workspace', divisionsRouter)

// Departments endpoints — Stage 023, permission guard applied per route
app.route('/api/v1/backoffice/workspace', departmentsRouter)

// WebSocket chain: correlationId (global) → tenantResolver → licenseEnforcement
//                  → rateLimit(max:10, backoffice-ws) → authentication → WS upgrade
// H-01: Rate limiting before WS upgrade prevents connection flood
// Note: correlationIdMiddleware is applied globally at app.use('*') above — not duplicated here.
app.use(
  '/ws/backoffice',
  tenantResolver,
  licenseEnforcementMiddleware,
  createRateLimitMiddleware({
    windowMs: 60_000,
    max: 10,
    keyPrefix: 'backoffice-ws',
  }),
  validateJwtMiddleware()
)

// WebSocket endpoint (no RBAC guard)
app.get('/ws/backoffice', createBackofficeWsRoute())

export default app
