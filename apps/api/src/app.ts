import { Hono } from 'hono'

// Utility
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Correlation ID middleware
const correlationIdMiddleware = async (c: any, next: any) => {
  const correlationId = c.req.header('x-correlation-id') || generateId()
  c.set('correlationId', correlationId)
  await next()
}

// Tenant resolver middleware
import { tenantResolver } from './middleware/tenant-resolver'

const app = new Hono()

// Apply correlation ID first
app.use('*', correlationIdMiddleware)

// Apply tenant resolver to workspace routes
app.use('/api/workspace/*', tenantResolver)

export default app
