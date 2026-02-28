/**
 * Type shim for 'uuid' package
 *
 * Provides TypeScript declarations for uuid functions
 * used in test and source files when @types/uuid is not
 * available at the root workspace level.
 *
 * Stage: STAGE_INFRA_01_TYPESCRIPT_STABILIZATION (T083)
 */
declare module 'uuid' {
  export function v1(): string
  export function v4(): string
  export function v3(
    name: string | Uint8Array,
    namespace: string | Uint8Array
  ): string
  export function v5(
    name: string | Uint8Array,
    namespace: string | Uint8Array
  ): string
  export function validate(uuid: string): boolean
  export function parse(uuid: string): Uint8Array
  export function stringify(arr: Uint8Array | number[]): string
  export function version(uuid: string): number

  export const NIL: string

  export namespace V3 {
    const DNS: string
    const URL: string
  }
  export namespace V5 {
    const DNS: string
    const URL: string
  }
}
