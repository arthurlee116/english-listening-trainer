# Test Directory Structure

This directory contains the comprehensive test suite for the english-listening-trainer application.

## Directory Organization

```
tests/
├── unit/                     # Unit tests for individual functions/classes
│   ├── lib/                 # Tests for business logic in lib/
│   ├── hooks/               # Tests for custom React hooks
│   └── utils/               # Tests for utility functions
├── integration/             # Integration tests for components and API routes
│   ├── components/          # Component integration tests
│   ├── api/                 # API route tests
│   └── flows/               # Multi-component workflow tests
├── e2e/                     # End-to-end tests
│   └── scenarios/           # Complete user journey tests
├── fixtures/                # Test data and mock responses
│   ├── exercises/           # Sample exercise data
│   ├── achievements/        # Achievement test data
│   ├── api-responses/       # Mock API responses
│   └── focus-areas/         # Focus area test data
├── helpers/                 # Test utilities and shared helpers
│   ├── render-utils.tsx     # Custom render functions with providers
│   ├── mock-utils.ts        # Mocking utilities
│   ├── storage-mock.ts      # localStorage mock implementation
│   └── test-setup.ts        # Global test setup
└── __mocks__/               # Module mocks
    ├── next/                # Next.js mocks
    ├── prisma/              # Prisma client mocks
    └── ai-services/         # AI service mocks
```

## Test Naming Conventions

- **Unit tests**: `*.test.ts` or `*.test.tsx`
- **Integration tests**: `*.spec.ts` or `*.spec.tsx`
- **E2E tests**: `*.spec.ts` or `*.spec.tsx`

## Running Tests

```bash
# Run all tests
npm run test:run

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Coverage Thresholds

- **Line Coverage**: 70% minimum
- **Branch Coverage**: 60% minimum  
- **Function Coverage**: 80% minimum
- **Critical business logic**: 90% minimum

## Performance Benchmarks

- **Unit tests**: Complete within 10 seconds
- **Integration tests**: Complete within 30 seconds
- **E2E tests**: Complete within 60 seconds
- **Individual test timeout**: 5 seconds maximum