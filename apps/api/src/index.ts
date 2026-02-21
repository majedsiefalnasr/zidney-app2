/**
 * Zidney API Service
 *
 * Main entry point for the API server.
 * Starts Hono server with middleware and route handlers.
 */

import app from './app'

const PORT = process.env.PORT || 3000

console.log(`🚀 Starting Zidney API on port ${PORT}`)

export default {
  port: PORT,
  fetch: app.fetch,
}
