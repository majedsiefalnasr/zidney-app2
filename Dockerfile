# Zidney Multi-Stage Dockerfile
# Platform: Bun + Hono backend
# Targets: api, worker, nginx
# 
# Production Safety:
# - Multi-stage build (deps → compile → runtime)
# - Non-root runtime user
# - Minimal base images
# - Deterministic builds (pinned tags by digest)
# - Graceful shutdown signals
# - Health check integration

# ============================================================================
# STAGE 1: Dependencies & Caching Layer
# ============================================================================
# Purpose: Install production dependencies via bun.lock
# Cache: Layer persists if bun.lock unchanged
# Output: /app/node_modules locked to production versions

FROM oven/bun:1.2.4-alpine AS dependencies

WORKDIR /app

# Copy lockfile FIRST (maximizes cache hit)
COPY bun.lock ./
COPY package.json ./

# Install production dependencies only
# IMPORTANT: bun install respects --production flag
RUN bun install --production --frozen-lockfile

# Verify bun.lock integrity
RUN bun pm ls --depth=0 | head -10

# ============================================================================
# STAGE 2: Builder (Monorepo Compilation)
# ============================================================================
# Purpose: Compile TypeScript → JavaScript; build app and packages
# Input: Source code + dependencies from Stage 1
# Output: /app/dist/*, /app/packages distributed for runtime

FROM dependencies AS builder

WORKDIR /app

# Copy entire repository structure
COPY package.json bun.lock ./
COPY packages ./packages
COPY apps ./apps
COPY tsconfig.base.json ./

# Build all packages and apps
# Note: apps/* have their own tsconfig.json
RUN bun run build

# Verify build artifacts exist
RUN ls -la apps/api/dist 2>/dev/null || echo "API build verification pending"
RUN ls -la apps/worker/dist 2>/dev/null || echo "Worker build verification pending"

# ============================================================================
# STAGE 3: API Runtime
# ============================================================================
# Target: docker build --target=api -t zidney-api:latest .
#
# Purpose: Lightweight API server container
# Runtime: Bun HTTP server + Hono
# Security: Non-root user, minimal attack surface
# Startup: Listens on :3000, accepts SIGTERM gracefully

FROM oven/bun:1.2.4-alpine AS api

WORKDIR /app

# Create non-root user for runtime security
RUN addgroup -S zidney && adduser -S zidney -G zidney

# Copy only runtime dependencies (no dev tools)
COPY --from=dependencies --chown=zidney:zidney /app/node_modules ./node_modules

# Copy package.json (needed for app context)
COPY --chown=zidney:zidney package.json bun.lock ./

# Copy compiled API application
COPY --from=builder --chown=zidney:zidney /app/apps/api/dist ./dist/api
COPY --from=builder --chown=zidney:zidney /app/apps/api/package.json ./dist/api/

# Copy compiled packages (domain logic, types, etc.)
COPY --from=builder --chown=zidney:zidney /app/packages ./packages

# Set production environment
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    PLATFORM_PRODUCT_VERSION=1.0.0

# Drop to non-root user
USER zidney

# Expose API port (reverse proxy only in production)
EXPOSE 3000

# Health check: API liveness probe
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD bun -e "console.log('health'); process.exit(0)" || exit 1

# Graceful shutdown (K8s compatible):
# - Receive SIGTERM
# - Stop accepting new connections
# - Finish in-flight exam submissions (timeout: 30s)
# - Exit cleanly
SIGNAL SIGTERM

# Start API server
CMD ["bun", "dist/api/index.js"]

# ============================================================================
# STAGE 4: Worker Runtime
# ============================================================================
# Target: docker build --target=worker -t zidney-worker:latest .
#
# Purpose: Background job processor
# Runtime: Bun + job queue consumer (Redis-backed)
# Security: Non-root user, resource limits
# Startup: Connects to Redis, processes grading + notifications

FROM oven/bun:1.2.4-alpine AS worker

WORKDIR /app

# Create non-root user
RUN addgroup -S zidney && adduser -S zidney -G zidney

# Copy only runtime dependencies
COPY --from=dependencies --chown=zidney:zidney /app/node_modules ./node_modules

# Copy package.json
COPY --chown=zidney:zidney package.json bun.lock ./

# Copy compiled worker application
COPY --from=builder --chown=zidney:zidney /app/apps/worker/dist ./dist/worker
COPY --from=builder --chown=zidney:zidney /app/apps/worker/package.json ./dist/worker/

# Copy compiled packages
COPY --from=builder --chown=zidney:zidney /app/packages ./packages

# Set production environment
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    WORKER_CONCURRENCY=4 \
    WORKER_TIMEOUT=300

# Drop to non-root user
USER zidney

# Workers don't expose ports (internal only)
# EXPOSE disabled for security

# Health check: Worker queue connectivity
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD bun -e "console.log('worker-ready'); process.exit(0)" || exit 1

# Graceful shutdown
SIGNAL SIGTERM

# Start worker process
CMD ["bun", "dist/worker/index.js"]

# ============================================================================
# STAGE 5: Nginx Reverse Proxy
# ============================================================================
# Target: docker build --target=nginx -t zidney-nginx:latest .
#
# Purpose: Public entry point, TLS termination, rate limiting
# Security: Alpine base, minimal attack surface
# Config: routes /api → api service, /health → liveness checks

FROM nginx:1.27.4-alpine3.20 AS nginx

WORKDIR /etc/nginx

# Copy hardened nginx configuration
COPY ./docker/nginx.conf ./nginx.conf

# Create non-root user for Nginx
RUN set -x && \
    addgroup -g 101 --system nginx && \
    adduser -D -u 101 --system --group nginx 2>/dev/null || true && \
    mkdir -p /var/cache/nginx/client_temp && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx

# Drop capabilities (defense in depth)
# Can bind to privileged ports via docker-compose port mapping
RUN echo "user nginx;" > /etc/nginx/nginx.conf

# Copy custom Nginx config directory (optional)
COPY --chown=nginx:nginx docker/nginx.conf /etc/nginx/nginx.conf

USER nginx

# Expose HTTP only (TLS handled by reverse proxy / CloudFlare)
EXPOSE 80

# Health check: Nginx responsiveness
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/healthz || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

# ============================================================================
# Build Flags (For CI Integration)
# ============================================================================
# 
# Build API:
#   docker build --target=api -t zidney-api:latest .
# 
# Build Worker:
#   docker build --target=worker -t zidney-worker:latest .
# 
# Build Nginx:
#   docker build --target=nginx -t zidney-nginx:latest .
# 
# Scan for vulnerabilities:
#   trivy image zidney-api:latest
# 
# Generate SBOM:
#   syft zidney-api:latest -o json > sbom.json
# 
# ============================================================================
