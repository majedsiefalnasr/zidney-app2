# Architecture Drift Report

- drift: gitnexus query -> GitNexus query failed during architecture-health enrichment. | <repo><home>/node_modules/@ladybugdb/core/lbug_native.js:22
  process.dlopen(lbugNativeModule, modulePath);
  ^

Error: dlopen(<repo><home>/node_modules/@ladybugdb/core/lbugjs.node, 0x0001): tried: '<repo><home>/node_modules/@ladybugdb/core/lbugjs.node' (no such file), '<home>/node_modules/.bun<home>/node_modules/@ladybugdb/core/lbugjs.node' (no such file), '<repo><home>/node_modules/@ladybugdb/core/lbugjs.node' (no such file)
at Object.<anonymous> (<repo><home>/node_modules/@ladybugdb/core/lbug_native.js:22:11)
at Module.\_compile (node:internal/modules/cjs/loader:1734:14)
at Object..js (node:internal/modules/cjs/loader:1899:10)
at Module.load (node:internal/modules/cjs/loader:1469:32)
at Function.\_load (node:internal/modules/cjs/loader:1286:12)
at TracingChannel.traceSync (node:diagnostics_channel:322:14)
at wrapModuleLoad (node:internal/modules/cjs/loader:235:24)
at Module.require (node:internal/modules/cjs/loader:1491:12)
at require (node:internal/modules/helpers:135:16)
at Object.<anonymous> (<repo><home>/node_modules/@ladybugdb/core/connection.js:3:20) {
code: 'ERR_DLOPEN_FAILED'
}

Node.js v23.11.0

- drift: gitnexus impact -> GitNexus impact failed during architecture-health enrichment. | <repo><home>/node_modules/@ladybugdb/core/lbug_native.js:22
  process.dlopen(lbugNativeModule, modulePath);
  ^

Error: dlopen(<repo><home>/node_modules/@ladybugdb/core/lbugjs.node, 0x0001): tried: '<repo><home>/node_modules/@ladybugdb/core/lbugjs.node' (no such file), '<home>/node_modules/.bun<home>/node_modules/@ladybugdb/core/lbugjs.node' (no such file), '<repo><home>/node_modules/@ladybugdb/core/lbugjs.node' (no such file)
at Object.<anonymous> (<repo><home>/node_modules/@ladybugdb/core/lbug_native.js:22:11)
at Module.\_compile (node:internal/modules/cjs/loader:1734:14)
at Object..js (node:internal/modules/cjs/loader:1899:10)
at Module.load (node:internal/modules/cjs/loader:1469:32)
at Function.\_load (node:internal/modules/cjs/loader:1286:12)
at TracingChannel.traceSync (node:diagnostics_channel:322:14)
at wrapModuleLoad (node:internal/modules/cjs/loader:235:24)
at Module.require (node:internal/modules/cjs/loader:1491:12)
at require (node:internal/modules/helpers:135:16)
at Object.<anonymous> (<repo><home>/node_modules/@ladybugdb/core/connection.js:3:20) {
code: 'ERR_DLOPEN_FAILED'
}

Node.js v23.11.0
