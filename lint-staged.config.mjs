/** @type {import('lint-staged').Config} */
export default {
  '*.{ts,tsx,js,jsx,mjs,vue,json}': ['bun biome check --write'],
}
