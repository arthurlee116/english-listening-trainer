import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/helpers/test-setup.ts'],
    globals: true,
    // Enhanced timeout configuration per requirements 8.1, 8.2, 8.3
    testTimeout: 5000, // Per requirement 8.1: individual test timeout
    hookTimeout: 10000,
    teardownTimeout: 5000,
    // Improved parallelization
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },
    // Enhanced test patterns for new structure
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/.next/standalone/**',
      '**/standalone/**',
      'tests/e2e/**',
      'tests/fixtures/**',
      'tests/__mocks__/**',
      'tests/helpers/**'
    ],
    // Coverage configuration per requirements 6.1
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'app/**/*.tsx',
        'components/**/*.tsx',
        'lib/focus-metrics.ts',
        'lib/storage.ts',
        'lib/together-tts-service.ts'
      ],
      exclude: [
        'node_modules/**',
        '**/*.config.*',
        '**/*.test.*',
        '**/*.spec.*',
        '**/.next/**',
        'tests/**',
        'coverage/**',
        'test-results/**',
        'dist/**',
        '**/*.d.ts',

        'generated/**',
        'prisma/**',
        'scripts/**',
        'public/**',
        '.next/**',
        'kokoro_local/**',
        'app/api/**',
        // Additional exclusions for appropriate files
        'app/layout.tsx',
        'app/globals.css',

        'lib/utils.ts',
        'tailwind.config.ts',
        'postcss.config.mjs',
        'next.config.mjs',
        'components.json',
        'eslint.config.mjs'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        },
        // Critical business logic requires higher coverage
        'lib/focus-metrics.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        },
        'lib/storage.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      },
      // Enable coverage collection from files touched by tests
      all: false,
      // Skip coverage for files with no tests
      skipFull: false
    },
    // Mock resolution optimization
    server: {
      deps: {
        inline: [
          /@testing-library\/.*/,
          /^(?!.*vitest).*$/
        ]
      }
    },
    // Retry configuration for flaky tests
    retry: 2,
    // Fail-fast strategy for critical test failures per requirement 8.3
    bail: process.env.CI ? 1 : undefined, // Fail fast in CI environment
    // Performance monitoring
    logHeapUsage: true,
    // Reporter configuration
    reporters: ['verbose', 'html'],
    outputFile: {
      html: './test-results/index.html'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/tests': path.resolve(__dirname, './tests'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/components': path.resolve(__dirname, './components'),
      '@/app': path.resolve(__dirname, './app'),
      '@/hooks': path.resolve(__dirname, './hooks'),
    },
  },
})
