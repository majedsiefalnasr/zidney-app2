// Pinia persist plugin typings augmentation
// Provide a minimal, safe typing for the `persist` option used by pinia-plugin-persistedstate.
declare module 'pinia' {
  interface PersistOptions {
    key?: string
    paths?: string[]
    pick?: string[]
    // allow additional plugin-specific options
    [key: string]: unknown
  }

  // Extend the DefineStoreOptions to accept a `persist` property.
  // Use broad generics to match Pinia's internal signature without being fragile.
  interface DefineStoreOptions<Id extends string, S, G, A> {
    persist?: boolean | PersistOptions
  }
}

export {}
