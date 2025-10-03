# Testing Contributor Guidelines

## Overview

This guide helps developers contribute effectively to the English Listening Trainer test suite. Whether you're adding new features, fixing bugs, or improving existing functionality, these guidelines ensure consistent, maintainable, and high-quality tests.

## Getting Started

### Prerequisites

Before contributing to tests, ensure you understand:
- TypeScript fundamentals
- React Testing Library concepts
- Vitest testing framework
- Our application's domain (listening practice, achievements, focus areas)

### Setting Up Your Environment

1. **Fork and clone the repository**
2. **Install dependencies**: `npm install`
3. **Run existing tests**: `npm test` (ensure all pass)
4. **Review the codebase**: Familiarize yourself with the application structure

## Writing New Tests

### Choosing Test Type

Use this decision tree to determine the appropriate test type:

```
Is it testing a single function/hook in isolation?
├─ Yes → Unit Test (tests/unit/)
└─ No → Is it testing component interactions or API routes?
    ├─ Yes → Integration Test (tests/integration/)
    └─ No → Is it testing a complete user workflow?
        └─ Yes → E2E Test (tests/e2e/)
```

### Unit Test Guidelines

**When to write unit tests:**
- Testing business logic functions
- Testing custom React hooks
- Testing utility functions
- Testing data transformations

**Unit test structure:**
```typescript
// tests/unit/lib/example-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ExampleService } from '@/lib/example-service'
import { mockLocalStorage } from '@/tests/helpers/storage-mock'

describe('ExampleService', () => {
  beforeEach(() => {
    mockLocalStorage()
    vi.clearAllMocks()
  })

  describe('methodName', () => {
    it('should handle normal case correctly', () => {
      // Arrange
      const input = { /* test data */ }
      
      // Act
      const result = ExampleService.methodName(input)
      
      // Assert
      expect(result).toEqual(expectedOutput)
    })

    it('should handle edge case gracefully', () => {
      // Test edge cases, error conditions, etc.
    })
  })
})
```

**Best practices for unit tests:**
- Test one behavior per test case
- Use descriptive test names that explain the expected behavior
- Include both positive and negative test cases
- Mock external dependencies
- Test error handling and edge cases

### Integration Test Guidelines

**When to write integration tests:**
- Testing React components with user interactions
- Testing API routes with request/response handling
- Testing multi-component workflows
- Testing database operations

**Integration test structure:**
```typescript
// tests/integration/components/example-component.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/tests/helpers/render-utils'
import { ExampleComponent } from '@/components/example-component'
import { createMockExercise } from '@/tests/helpers/mock-utils'

describe('ExampleComponent Integration', () => {
  const mockProps = {
    exercise: createMockExercise(),
    onComplete: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle user interaction correctly', async () => {
    renderWithProviders(<ExampleComponent {...mockProps} />)
    
    const button = screen.getByRole('button', { name: /submit/i })
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(mockProps.onComplete).toHaveBeenCalledWith(expectedData)
    })
  })
})
```

**Best practices for integration tests:**
- Use `renderWithProviders` for components that need context
- Test user interactions, not implementation details
- Use `screen.getByRole` for better accessibility testing
- Test error boundaries and fallback scenarios
- Mock external API calls with MSW

### E2E Test Guidelines

**When to write E2E tests:**
- Testing complete user journeys
- Testing critical application flows
- Testing cross-component interactions
- Validating business requirements end-to-end

**E2E test structure:**
```typescript
// tests/e2e/scenarios/practice-flow.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { server } from '@/tests/helpers/api-mocks'
import { MainApp } from '@/app/page'

describe('Practice Flow E2E', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  it('should complete full practice session', async () => {
    render(<MainApp />)
    
    // Step 1: Start practice
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }))
    
    // Step 2: Answer questions
    await waitFor(() => {
      expect(screen.getByText(/question 1/i)).toBeInTheDocument()
    })
    
    // Continue testing the complete flow...
  })
})
```

**Best practices for E2E tests:**
- Keep tests focused on critical user paths
- Use realistic test data
- Mock external services to avoid flakiness
- Test error recovery scenarios
- Keep execution time under 30 seconds per test

## Using Test Utilities

### Render Utilities

```typescript
import { renderWithProviders } from '@/tests/helpers/render-utils'

// Basic usage
renderWithProviders(<Component />)

// With custom options
renderWithProviders(<Component />, {
  initialI18nLanguage: 'es',
  theme: 'dark',
  mockStorage: { 'key': 'value' }
})
```

### Mock Utilities

```typescript
import { 
  createMockExercise,
  createMockPracticeSession,
  createMockAchievement,
  mockLocalStorage
} from '@/tests/helpers/mock-utils'

// Create test data
const exercise = createMockExercise({
  difficulty: 'advanced',
  focusAreas: ['main-idea']
})

// Mock browser APIs
mockLocalStorage({ 'existing-key': 'value' })
```

### Fixture Data

```typescript
import { SAMPLE_EXERCISE } from '@/tests/fixtures/exercises/sample-exercises'
import { SAMPLE_ACHIEVEMENTS } from '@/tests/fixtures/achievements/sample-achievements'

// Use predefined fixtures when appropriate
const testExercise = { ...SAMPLE_EXERCISE, id: 'test-specific-id' }
```

## Testing Patterns and Examples

### Testing Async Operations

```typescript
it('should handle async operations', async () => {
  const promise = asyncFunction()
  
  // Test loading state
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
  
  // Wait for completion
  await waitFor(() => {
    expect(screen.getByText(/success/i)).toBeInTheDocument()
  })
})
```

### Testing Error Scenarios

```typescript
it('should handle errors gracefully', async () => {
  // Mock error response
  vi.mocked(apiCall).mockRejectedValue(new Error('Network error'))
  
  render(<Component />)
  
  await waitFor(() => {
    expect(screen.getByText(/error occurred/i)).toBeInTheDocument()
  })
})
```

### Testing Form Interactions

```typescript
it('should handle form submission', async () => {
  const mockSubmit = vi.fn()
  render(<Form onSubmit={mockSubmit} />)
  
  // Fill form
  fireEvent.change(screen.getByLabelText(/name/i), {
    target: { value: 'Test Name' }
  })
  
  // Submit
  fireEvent.click(screen.getByRole('button', { name: /submit/i }))
  
  await waitFor(() => {
    expect(mockSubmit).toHaveBeenCalledWith({ name: 'Test Name' })
  })
})
```

### Testing Custom Hooks

```typescript
import { renderHook, act } from '@testing-library/react'

it('should manage state correctly', () => {
  const { result } = renderHook(() => useCustomHook())
  
  expect(result.current.value).toBe(initialValue)
  
  act(() => {
    result.current.setValue(newValue)
  })
  
  expect(result.current.value).toBe(newValue)
})
```

## Mocking Strategies

### External APIs

Use MSW for consistent API mocking:

```typescript
// tests/helpers/api-mocks.ts
import { rest } from 'msw'

export const handlers = [
  rest.post('/api/ai/questions', (req, res, ctx) => {
    return res(ctx.json({ questions: mockQuestions }))
  }),
  
  rest.post('/api/practice/save', (req, res, ctx) => {
    return res(ctx.json({ success: true }))
  })
]
```

### Database Operations

Mock Prisma operations:

```typescript
// tests/__mocks__/prisma/client.ts
export const mockPrisma = {
  practiceSession: {
    create: vi.fn().mockResolvedValue(mockSession),
    findMany: vi.fn().mockResolvedValue([mockSession]),
    update: vi.fn().mockResolvedValue(mockSession)
  }
}
```

### Browser APIs

**重要：必须使用 mockStorage() 辅助方法**

```typescript
import { mockStorage } from '@/tests/helpers/storage-mock'

describe('Your Test Suite', () => {
  beforeEach(() => {
    // 必须调用 mockStorage() 以确保数据持久化
    mockStorage()
  })
  
  it('should persist data across operations', () => {
    // 现在 localStorage 有实际的存储逻辑
    localStorage.setItem('key', 'value')
    expect(localStorage.getItem('key')).toBe('value')
  })
})
```

**为什么必须使用 mockStorage()？**
- 全局 mock 只提供 vi.fn() 函数，不包含实际存储逻辑
- 如果忘记调用 mockStorage()，数据会在操作间丢失
- mockStorage() 提供完整的 Storage 接口实现和事件模拟

**错误示例（数据会丢失）：**
```typescript
// ❌ 错误：直接使用全局 mock
it('test without mockStorage', () => {
  localStorage.setItem('key', 'value')
  // 数据可能丢失，因为只是 vi.fn() 调用
})
```

## Code Quality Standards

### ESLint Rules for Tests

Our test files follow specific ESLint rules:
- No disabled rules without justification
- Consistent naming conventions
- Proper async/await usage
- No console.log statements (use proper debugging)

### TypeScript Standards

- Use strict type checking
- Avoid `any` types
- Properly type mock functions
- Use type assertions sparingly

### Test Naming

**Good test names:**
```typescript
it('should save exercise to history with proper ordering')
it('should calculate streak days accurately')
it('should handle network errors gracefully')
```

**Poor test names:**
```typescript
it('works correctly')
it('test function')
it('should work')
```

## Performance Guidelines

### Test Execution Speed

- Unit tests should complete in milliseconds
- Integration tests should complete within seconds
- E2E tests should complete within 30 seconds
- Use `vi.useFakeTimers()` for time-dependent tests

### Memory Management

```typescript
describe('Component Tests', () => {
  afterEach(() => {
    // Clean up mocks
    vi.clearAllMocks()
    
    // Clean up timers
    vi.useRealTimers()
    
    // Clean up DOM
    cleanup()
  })
})
```

## Migration from Legacy Tests

### Common Migration Tasks

1. **Update imports:**
   ```typescript
   // Old
   import { jest } from '@jest/globals'
   
   // New
   import { vi } from 'vitest'
   ```

2. **Update mock syntax:**
   ```typescript
   // Old
   jest.fn()
   jest.spyOn()
   
   // New
   vi.fn()
   vi.spyOn()
   ```

3. **Update test structure:**
   ```typescript
   // Old: tests alongside source files
   src/components/Button.test.tsx
   
   // New: centralized test directory
   tests/integration/components/button.spec.ts
   ```

### Breaking Changes to Watch For

- Mock implementations may need updates
- Async test patterns might change
- Coverage thresholds are now enforced
- New directory structure requirements

## Common Pitfalls and Solutions

### Flaky Tests

**Problem**: Tests pass sometimes, fail other times
**Solutions**:
- Use `vi.useFakeTimers()` for time-dependent code
- Properly await async operations
- Clean up state between tests
- Mock external dependencies consistently

### Slow Tests

**Problem**: Tests take too long to execute
**Solutions**:
- Mock expensive operations
- Use minimal test data
- Avoid real network calls
- Optimize DOM queries

### Hard-to-Debug Tests

**Problem**: Test failures are difficult to understand
**Solutions**:
- Use descriptive test names
- Add helpful error messages
- Use `screen.debug()` to inspect DOM
- Break complex tests into smaller ones

## Review Checklist

Before submitting test code, ensure:

- [ ] Tests follow naming conventions
- [ ] Appropriate test type chosen (unit/integration/e2e)
- [ ] Tests are focused and test one behavior each
- [ ] Mocks are properly set up and cleaned up
- [ ] Error cases are tested
- [ ] Tests pass consistently
- [ ] Coverage thresholds are met
- [ ] No console.log statements remain
- [ ] TypeScript types are correct
- [ ] ESLint rules pass

## Getting Help

### Resources

- **Testing Strategy**: `tests/TESTING-STRATEGY.md`
- **Advanced Examples**: `tests/ADVANCED-EXAMPLES.md`
- **API Documentation**: Vitest and Testing Library docs
- **Team Slack**: #testing-help channel

### Code Review Process

1. Create feature branch with descriptive name
2. Write tests following these guidelines
3. Ensure all tests pass locally
4. Submit pull request with test description
5. Address review feedback promptly
6. Merge after approval and CI success

### Common Questions

**Q: Should I test private methods?**
A: No, test the public interface and behavior, not implementation details.

**Q: How much mocking is too much?**
A: Mock external dependencies and side effects, but prefer real objects when possible.

**Q: When should I write E2E tests?**
A: For critical user journeys and when integration tests aren't sufficient.

**Q: How do I test accessibility?**
A: Use `screen.getByRole()` and test with screen readers in mind.

This guide ensures consistent, high-quality test contributions that maintain our codebase's reliability and developer experience.