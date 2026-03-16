# Architecture Drift Report

- drift: gitnexus query -> GitNexus query failed during architecture-health enrichment. | file:///opt/homebrew/lib/node_modules/gitnexus/dist/mcp/local/local-backend.js:140
  throw new Error(`Multiple repositories indexed. Specify which one with the "repo" parameter. Available: ${names.join(', ')}`);
  ^

Error: Multiple repositories indexed. Specify which one with the "repo" parameter. Available: zidney-app, zidney-app2
at LocalBackend.resolveRepo (file:///opt/homebrew/lib/node_modules/gitnexus/dist/mcp/local/local-backend.js:140:15)
at async LocalBackend.callTool (file:///opt/homebrew/lib/node_modules/gitnexus/dist/mcp/local/local-backend.js:228:22)
at async Command.queryCommand (file:///opt/homebrew/lib/node_modules/gitnexus/dist/cli/tool.js:40:20)

Node.js v23.11.0

- drift: gitnexus impact -> GitNexus impact failed during architecture-health enrichment. | file:///opt/homebrew/lib/node_modules/gitnexus/dist/mcp/local/local-backend.js:140
  throw new Error(`Multiple repositories indexed. Specify which one with the "repo" parameter. Available: ${names.join(', ')}`);
  ^

Error: Multiple repositories indexed. Specify which one with the "repo" parameter. Available: zidney-app, zidney-app2
at LocalBackend.resolveRepo (file:///opt/homebrew/lib/node_modules/gitnexus/dist/mcp/local/local-backend.js:140:15)
at async LocalBackend.callTool (file:///opt/homebrew/lib/node_modules/gitnexus/dist/mcp/local/local-backend.js:228:22)
at async Command.impactCommand (file:///opt/homebrew/lib/node_modules/gitnexus/dist/cli/tool.js:71:20)

Node.js v23.11.0
