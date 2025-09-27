import '@testing-library/jest-dom'
import { vi } from 'vitest'
import path from 'path'
import fs from 'fs'
import Module from 'module'
import { TextEncoder, TextDecoder } from 'util'
import pLimit from 'p-limit'
import { register } from 'tsconfig-paths'

// Ensure Node's TextEncoder/TextDecoder implementations are used (needed by esbuild stubs).
;(globalThis as any).TextEncoder = TextEncoder
;(globalThis as any).TextDecoder = TextDecoder

// Ensure Node-style require() respects the project's TS path aliases during Vitest runs.
// This allows legacy tests that still use require('@/...') to resolve modules correctly.
const tsconfigPath = path.resolve(__dirname, '../../tsconfig.json')
try {
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'))
  const paths = tsconfig?.compilerOptions?.paths
  if (paths) {
    register({
      baseUrl: path.resolve(__dirname, '../../'),
      paths
    })
  }
} catch (error) {
  console.warn('Failed to register tsconfig paths for tests:', error)
}

// Allow CommonJS require() to load TypeScript files by transpiling them on the fly during tests.
const moduleExtensions = (Module as unknown as {
  _extensions: Record<string, (module: NodeModule & { _compile: (code: string, filename: string) => void }, filename: string) => void>
})._extensions

const tsExtensions: Array<{ ext: '.ts' | '.tsx'; loader: 'ts' | 'tsx' }> = [
  { ext: '.ts', loader: 'ts' },
  { ext: '.tsx', loader: 'tsx' }
]

let transformSync: typeof import('esbuild').transformSync
function ensureEsbuild() {
  if (!transformSync) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const esbuild = require('esbuild') as typeof import('esbuild')
    transformSync = esbuild.transformSync
  }
}

for (const { ext, loader } of tsExtensions) {
  if (!moduleExtensions[ext]) {
    moduleExtensions[ext] = (module, filename) => {
      const source = fs.readFileSync(filename, 'utf8')
      ensureEsbuild()
      const { code } = transformSync(source, {
        loader,
        format: 'cjs',
        target: 'es2020',
        sourcemap: 'inline'
      })
      module._compile(code, filename)
    }
  }
}

// Provide lightweight mocks for Next.js server utilities so that server-side modules can be required in tests.
vi.mock('next/server', () => {
  class MockNextRequest extends Request {
    public cookies: {
      get: (name: string) => { value: string } | undefined
      has: (name: string) => boolean
      set: (name: string, value: string) => void
      delete: (name: string) => void
    }
    public ip?: string
    public nextUrl: URL

    constructor(input: RequestInfo | URL, init: RequestInit = {}) {
      const url = typeof input === 'string' || input instanceof URL
        ? input
        : input instanceof Request
          ? input.url
          : 'http://localhost'

      // Ensure we always have an absolute URL for the base Request constructor
      const absoluteUrl = typeof url === 'string' ? new URL(url, 'http://localhost').toString() : url.toString()

      super(absoluteUrl, init)

      this.nextUrl = new URL(absoluteUrl)

      const cookieStore = new Map<string, string>()
      const cookieHeader = this.headers.get('cookie')
      if (cookieHeader) {
        cookieHeader.split(';').forEach((part) => {
          const [name, ...rest] = part.trim().split('=')
          if (name) {
            cookieStore.set(name, decodeURIComponent(rest.join('=')))
          }
        })
      }

      this.cookies = {
        get: (name: string) => {
          const value = cookieStore.get(name)
          return value === undefined ? undefined : { value }
        },
        has: (name: string) => cookieStore.has(name),
        set: (name: string, value: string) => {
          cookieStore.set(name, value)
        },
        delete: (name: string) => {
          cookieStore.delete(name)
        }
      }

      this.ip = (init as any)?.ip ?? undefined
    }

    json<T = unknown>(): Promise<T> {
      return super.json() as Promise<T>
    }
  }

  class MockNextResponse extends Response {
    static json(body: unknown, init: ResponseInit = {}): MockNextResponse {
      const headers = new Headers(init.headers)
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json')
      }
      return new MockNextResponse(JSON.stringify(body), { ...init, headers })
    }

    static redirect(url: string | URL, init: number | ResponseInit = 307): MockNextResponse {
      const status = typeof init === 'number' ? init : init.status ?? 307
      const headers = new Headers(typeof init === 'number' ? undefined : init.headers)
      headers.set('location', url.toString())
      return new MockNextResponse(null, { status, headers })
    }

    static next(): MockNextResponse {
      return new MockNextResponse(null, { status: 200 })
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse
  }
})

// Install a global fetch concurrency limiter so that tests expecting capped parallelism succeed without relying on browser APIs.
const FETCH_CONCURRENCY_LIMIT = Number(process.env.TEST_FETCH_CONCURRENCY_LIMIT ?? '5')
const fetchLimit = pLimit(Math.max(1, FETCH_CONCURRENCY_LIMIT))

const wrapWithLimit = (fn: typeof fetch | undefined): typeof fetch => {
  if (!fn) {
    return ((() => Promise.reject(new Error('fetch is not available'))) as unknown) as typeof fetch
  }

  return new Proxy(fn as unknown as (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>, {
    apply(target, thisArg, args) {
      return fetchLimit(() => Reflect.apply(target, thisArg, args))
    },
    get(target, prop, receiver) {
      if (prop === '__originalFetch') {
        return target
      }
      return Reflect.get(target, prop, receiver)
    },
    set(target, prop, value, receiver) {
      return Reflect.set(target, prop, value, receiver)
    }
  }) as unknown as typeof fetch
}

const initialFetch = (globalThis as any).fetch as typeof fetch | undefined
let currentFetch = initialFetch ? wrapWithLimit(initialFetch) : undefined

Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  get() {
    return currentFetch
  },
  set(newFetch) {
    currentFetch = wrapWithLimit(newFetch as typeof fetch)
  }
})

// Mock environment variables
process.env.CEREBRAS_API_KEY = 'test-api-key'
process.env.DATABASE_URL = 'file:./test.db'

// Mock server-only module
vi.mock('server-only', () => ({}))

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}))

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
