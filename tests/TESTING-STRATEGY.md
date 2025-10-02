# Testing Strategy Documentation

## Overview

This document outlines the comprehensive testing strategy for the English Listening Trainer application. Our testing approach ensures reliability, maintainability, and confidence in the codebase through a multi-layered testing architecture.

## Test Architecture

### Directory Structure

```
tests/
├── unit/                     # Unit tests (70% of test suite)
│   ├── lib/                 # Business logic tests
│   │   ├── storage.test.ts
│   │   ├── achievement-service.test.ts
│   │   ├── focus-metrics.test.ts
│   │   └── ...
│   ├── hooks/               # React hooks tests
│   │   ├── use-hotkeys.test.ts
│   │   ├── use-auth-state.test.ts
│   │   └── ...
│   └── utils/               # Utility function tests
├── integration/             # Integration tests (25% of test suite)
│   ├── components/          # Component integration tests
│   │   ├── question-interface.spec.ts
│   │   ├── results-display.spec.ts
│   │   └── ...
│   ├── api/                 # API route tests
│   │   ├── practice-save.spec.ts
│   │   ├── ai-questions.spec.ts
│   │   └── ...
│   └── flows/               # Multi-component workflow tests
├── e2e/                     # End-to-end tests (5% of test suite)
│   └── scenarios/           # Complete user journey tests
│       ├── specialized-practice-flow.spec.ts
│       ├── achievement-flow.spec.ts
│       └── ...
├── fixtures/                # Test data and mock responses
├── helpers/                 # Test utilities and shared helpers
└── __mocks__/               # Module mocks
```

### Naming Conventions

- **Unit tests**: `*.test.ts` - Tests for individual functions, classes, or hooks
- **Integration tests**: `*.spec.ts` - Tests for component interactions and API routes
- **E2E tests**: `*.spec.ts` - Tests for complete user workflows
- **Fixtures**: `sample-*.ts` - Test data and mock objects
- **Helpers**: `*-utils.ts` or `*-mock.ts` - Shared testing utilities

## Testing Layers

### Unit Tests (70% Coverage Target)

Unit tests focus on individual functions, classes, and hooks in isolation.

**Key Areas:**
- Storage operations and data persistence
- Achievement calculations and progress tracking
- Focus metrics and recommendation algorithms
- Custom React hooks behavior
- Utility functions and data transformations

**Example Structure:**
```typescript
describe('Achievement Service', () => {
  describe('updateProgressMetrics', () => {
    it('should correctly accumulate session data', () => {
      // Test implementation
    })
    
    it('should calculate streak days accurately', () => {
      // Test implementation
    })
  })
})
```

### Integration Tests (25% Coverage Target)

Integration tests verify component interactions and data flow between different parts of the application.

**Key Areas:**
- Component rendering with providers
- API route request/response handling
- Database operations with mocked Prisma
- Multi-component workflows
- Error boundary behavior

**Example Structure:**
```typescript
describe('QuestionInterface Integration', () => {
  it('should handle answer submission with specialized tags', async () => {
    render(
      <QuestionInterface
        question={mockQuestion}
        onAnswer={mockOnAnswer}
        focusAreas={['main-idea']}
      />
    )
    
    // Test user interaction and data flow
  })
})
```

### End-to-End Tests (5% Coverage Target)

E2E tests validate complete user journeys and critical application flows.

**Key Areas:**
- Complete practice sessions from start to finish
- Achievement earning and progress tracking
- Specialized practice mode workflows
- Error handling and recovery scenarios

## Setup Instructions

### Prerequisites

Ensure you have the following installed:
- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd english-listening-trainer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with appropriate test values
   ```

### Running Tests

#### All Tests
```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
```

#### Specific Test Suites
```bash
npm run test:unit          # Run only unit tests
npm run test:integration   # Run only integration tests
npm run test:e2e          # Run only end-to-end tests
```

#### Targeted Testing
```bash
npm test -- storage        # Run tests matching "storage"
npm test -- --changed     # Run tests for changed files only
npm test -- --bail        # Stop on first failure
```

### Coverage Reports

Coverage reports are generated in multiple formats:
- **HTML**: `coverage/index.html` - Interactive coverage report
- **LCOV**: `coverage/lcov.info` - For CI/CD integration
- **JSON**: `coverage/coverage-final.json` - Machine-readable format

**Coverage Thresholds:**
- Line Coverage: 70% minimum
- Branch Coverage: 60% minimum  
- Function Coverage: 80% minimum
- Critical business logic: 90% minimum

## Development Workflow

### Writing New Tests

1. **Identify the test type** based on what you're testing:
   - Individual function/hook → Unit test
   - Component interaction → Integration test
   - Complete user flow → E2E test

2. **Choose the appropriate directory** and follow naming conventions

3. **Use existing fixtures and helpers** when possible to maintain consistency

4. **Follow the AAA pattern**:
   - **Arrange**: Set up test data and mocks
   - **Act**: Execute the code under test
   - **Assert**: Verify the expected behavior

### Test-Driven Development (TDD)

We encourage TDD for new features:

1. **Red**: Write a failing test that describes the desired behavior
2. **Green**: Write the minimal code to make the test pass
3. **Refactor**: Improve the code while keeping tests green

### Mock Strategy

#### External Services
- Use MSW (Mock Service Worker) for API calls
- Mock AI services and TTS endpoints
- Avoid real network calls in tests

#### Browser APIs
- Mock localStorage, sessionStorage
- Mock window and document APIs
- Use jsdom for DOM testing

#### Database Operations
- Mock Prisma client operations
- Use in-memory data for test scenarios
- Avoid real database connections

## Troubleshooting Guide

### Common Issues

#### Tests Failing Intermittently
**Symptoms**: Tests pass sometimes, fail other times
**Causes**: 
- Race conditions in async code
- Shared state between tests
- Time-dependent logic

**Solutions**:
- Use `vi.useFakeTimers()` for time-dependent tests
- Ensure proper cleanup in `afterEach` hooks
- Mock async operations consistently

#### Coverage Not Meeting Thresholds
**Symptoms**: Coverage reports show insufficient coverage
**Causes**:
- Missing test cases for edge conditions
- Untested error handling paths
- Dead code or unused functions

**Solutions**:
- Review coverage reports to identify gaps
- Add tests for error scenarios
- Remove or refactor unused code

#### Slow Test Execution
**Symptoms**: Tests take too long to run
**Causes**:
- Real network calls or file I/O
- Inefficient mocks or fixtures
- Too many DOM operations

**Solutions**:
- Ensure all external calls are mocked
- Optimize fixture data size
- Use `screen.getByRole` instead of complex queries

#### Mock Not Working
**Symptoms**: Mocked functions are not being called or return unexpected values
**Causes**:
- Incorrect mock setup
- Module hoisting issues
- Mock not reset between tests

**Solutions**:
- Verify mock is imported before the module under test
- Use `vi.clearAllMocks()` in `beforeEach`
- Check mock implementation matches expected interface

### Debugging Tests

#### Using Console Logs
```typescript
// Temporary debugging - remove before committing
console.log('Test state:', { variable1, variable2 })
```

#### Using Debugger
```typescript
// Set breakpoint in test
debugger
```

#### Inspecting DOM
```typescript
import { screen } from '@testing-library/react'

// Print current DOM state
screen.debug()

// Print specific element
screen.debug(screen.getByRole('button'))
```

### Performance Optimization

#### Test Execution Speed
- Keep unit tests under 10 seconds total
- Keep integration tests under 30 seconds total
- Keep E2E tests under 60 seconds total

#### Memory Management
- Clean up event listeners in tests
- Reset mocks between tests
- Avoid memory leaks in long test suites

## Best Practices

### Test Organization
- Group related tests using `describe` blocks
- Use descriptive test names that explain the expected behavior
- Keep tests focused on a single behavior
- Use `beforeEach` and `afterEach` for setup and cleanup

### Assertions
- Use specific matchers for better error messages
- Test both positive and negative cases
- Include edge cases and error conditions
- Avoid testing implementation details

### Mocking
- Mock at the boundary of your system
- Keep mocks simple and focused
- Use real objects when possible (prefer fakes over mocks)
- Reset mocks between tests

### Maintainability
- Keep tests DRY (Don't Repeat Yourself) using helpers
- Update tests when refactoring code
- Remove obsolete tests promptly
- Document complex test scenarios

## CI/CD Integration

### GitHub Actions
Tests run automatically on:
- Pull requests
- Pushes to main branch
- Scheduled nightly runs

### Quality Gates
- All tests must pass
- Coverage thresholds must be met
- No ESLint errors in test files
- TypeScript compilation must succeed

### Failure Handling
- Tests fail fast on critical errors
- Coverage reports are uploaded as artifacts
- Failed test results are available in PR comments

## Migration Notes

### From Previous Testing Setup
If migrating from an older testing setup:

1. **Update imports**: Change from old testing utilities to new helpers
2. **Restructure tests**: Move tests to appropriate directories
3. **Update mocks**: Replace old mocks with new MSW-based approach
4. **Fix assertions**: Update to use new assertion patterns

### Breaking Changes
- Removed dependency on Jest in favor of Vitest
- Changed mock strategy from manual mocks to MSW
- Updated directory structure for better organization
- New coverage thresholds and quality gates

This testing strategy ensures our application is reliable, maintainable, and provides confidence for continuous development and deployment.