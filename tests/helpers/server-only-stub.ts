/**
 * Vitest alias target for the `server-only` package.
 *
 * `server-only` throws when imported outside a React Server Component
 * environment. Tests run in plain node, so vitest.config.ts aliases the
 * package to this empty module. The production build keeps the real
 * package  this stub never ships.
 */
export {};
