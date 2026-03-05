import 'hono'
import 'hono/request'

declare module 'hono' {
  interface ContextVariableMap {
    [key: string]: any
    authPayload?: any
    isAuthenticated?: boolean
    correlationId?: string
    correlation_id?: string
    request_id?: string
    workspaceId?: string
    workspaceSlug?: string
    workspace_id?: string
    workspace_slug?: string
    workspace?: any
    userId?: string
    user_id?: string
    userRole?: string
    userRoles?: string[]
    user_role?: string
    tenantDb?: any
    tenant_db?: any
    masterDb?: any
    master_db?: any
    logger?: any
    runtime_version?: string
    licenseStatus?: string
    license_id?: string
    student_limit?: string | number | null
    staff_limit?: string | number | null
  }

  interface Context {
    state: Record<string, any>
    get: (key: string) => any
    set: (key: string, value: any) => any
    status: (code: number) => any
    json: (object: any, status?: any, headers?: Record<string, string>) => any
    text: (text: string, status?: any, headers?: Record<string, string>) => any
  }

  interface Hono {
    state: Record<string, any>
    req: any
    json: (object: any, status?: any, headers?: Record<string, string>) => any
    header: (name: string, value?: string) => any
    text: (text: string, status?: any, headers?: Record<string, string>) => any
    status: (code: number) => any
  }
}

declare module 'hono/request' {
  interface HonoRequest {
    context: Record<string, any>
    valid<T = any>(target: string): T
    json<T = any>(): Promise<T>
  }
}

declare global {
  interface Request {
    correlationId?: string
  }
}

export {}
