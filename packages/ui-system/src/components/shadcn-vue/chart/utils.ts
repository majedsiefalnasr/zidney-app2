import { isClient } from '@vueuse/core'
import { useId } from 'reka-ui'
import { h, render } from 'vue'
import type { ChartConfig } from '.'

// Simple cache using a Map to store serialized object keys
const cache = new Map<string, string>()

// Convert object to a consistent string key
function serializeKey(key: Record<string, unknown>): string {
  return JSON.stringify(key, Object.keys(key).sort())
}

interface Constructor<P = unknown> {
  __isFragment?: never
  __isTeleport?: never
  __isSuspense?: never
  new (
    ...args: unknown[]
  ): {
    $props: P
  }
}

export function componentToString<P>(config: ChartConfig, component: Constructor<P>, props?: P) {
  if (!isClient) return

  // This function will be called once during mount lifecycle
  const id = useId()

  // https://unovis.dev/docs/auxiliary/Crosshair#component-props
  return (_data: unknown, x: number | Date) => {
    // _data may be the raw data or an object with `.data`
    const maybeWithData = _data as { data?: unknown } | null
    const data: unknown =
      typeof _data === 'object' && _data !== null && maybeWithData && 'data' in maybeWithData
        ? (maybeWithData.data as unknown)
        : _data
    // Ensure `data` is serializable to an object key; fallback to JSON.stringify for primitives
    let keyPart: string
    if (typeof data === 'object' && data !== null) {
      keyPart = serializeKey(data as Record<string, unknown>)
    } else {
      keyPart = JSON.stringify(data)
    }

    const serializedKey = `${id}-${keyPart}`
    const cachedContent = cache.get(serializedKey)
    if (cachedContent) return cachedContent

    const vnode = h<unknown>(component, { ...props, payload: data, config, x })
    const div = document.createElement('div')
    render(vnode, div)
    cache.set(serializedKey, div.innerHTML)
    return div.innerHTML
  }
}
