/**
 * Vue Single File Component type declaration shim for tests
 * Allows TypeScript to understand .vue file imports
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >
  export default component
}
