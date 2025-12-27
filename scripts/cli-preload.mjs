/**
 * CLI Preload Script
 * Mocks 'server-only' to allow running Next.js server modules in CLI environment
 */
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// Pre-cache the server-only module with an empty implementation
require.cache[require.resolve('server-only')] = {
  id: 'server-only',
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
  parent: null,
  children: [],
  path: '',
  paths: [],
}
