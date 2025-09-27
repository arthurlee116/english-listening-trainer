import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Enhanced timeout configuration
    testTimeout: 30000,
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
    // Enhanced test patterns
    include: [
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    // Enhanced coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        '**/*.config.*',
        '**/*.test.*',
        '**/*.spec.*',
        '__tests__/**',
        'src/test/**',
        'coverage/**',
        'dist/**',
        '**/*.d.ts',
        '**/types.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 90,
          lines: 85,
          statements: 85
        }
      }
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
    // Reporter configuration
    reporter: ['verbose', 'html'],
    outputFile: {
      html: './test-results/index.html'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})