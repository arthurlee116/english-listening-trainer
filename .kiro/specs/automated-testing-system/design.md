# Design Document

## Overview

The automated testing system for the english-listening-trainer project will provide comprehensive test coverage across unit, integration, and end-to-end levels. The system is designed to be fast, reliable, and maintainable, with a focus on testing critical business logic including specialized listening practice, achievements tracking, focus metrics, and AI-powered features.

## Architecture

### Directory Structure

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

### Test Configuration

The system leverages the existing Vitest configuration with enhancements for:
- TypeScript support with path aliases
- jsdom environment for DOM testing
- Coverage reporting with appropriate thresholds
- Mock resolution and dependency injection
- Performance monitoring and timeout management

## Components and Interfaces

### Test Utilities

#### Custom Render Function
```typescript
// tests/helpers/render-utils.tsx
export function renderWithProviders(
  ui: React.ReactElement,
  options?: {
    initialI18nLanguage?: string
    theme?: 'light' | 'dark'
    mockStorage?: Record<string, string>
  }
): RenderResult
```

#### Mock Utilities
```typescript
// tests/helpers/mock-utils.ts
export function createMockExercise(overrides?: Partial<Exercise>): Exercise
export function createMockPracticeSession(overrides?: Partial<PracticeSession>): PracticeSession
export function createMockAchievement(overrides?: Partial<AchievementBadge>): AchievementBadge
export function mockLocalStorage(initialData?: Record<string, string>): void
```

#### Storage Mock
```typescript
// tests/helpers/storage-mock.ts
export class MockStorage implements Storage {
  private store: Map<string, string>
  // Implements full Storage interface with event simulation
}
```

### API Mocking Strategy

#### MSW (Mock Service Worker) Setup
```typescript
// tests/helpers/api-mocks.ts
export const handlers = [
  rest.post('/api/ai/questions', (req, res, ctx) => {
    return res(ctx.json(mockAIResponse))
  }),
  rest.post('/api/practice/save', (req, res, ctx) => {
    return res(ctx.json({ success: true }))
  })
]
```

#### Prisma Mocking
```typescript
// tests/__mocks__/prisma/client.ts
export const mockPrisma = {
  practiceSession: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  wrongAnswer: {
    create: vi.fn(),
    findMany: vi.fn()
  }
}
```

## Data Models

### Test Fixtures

#### Exercise Fixtures
```typescript
// tests/fixtures/exercises/sample-exercises.ts
export const SAMPLE_EXERCISE: Exercise = {
  id: 'test-exercise-1',
  difficulty: 'intermediate',
  language: 'english',
  topic: 'technology',
  transcript: 'Sample transcript for testing...',
  questions: [/* sample questions */],
  results: [/* sample results */],
  createdAt: '2024-01-01T00:00:00Z',
  totalDurationSec: 180,
  focusAreas: ['main-idea', 'detail-comprehension']
}
```

#### Achievement Fixtures
```typescript
// tests/fixtures/achievements/sample-achievements.ts
export const SAMPLE_ACHIEVEMENTS: AchievementBadge[] = [
  {
    id: 'first-session',
    titleKey: 'achievements.firstSession.title',
    descriptionKey: 'achievements.firstSession.desc',
    conditions: { type: 'sessions', threshold: 1 },
    earnedAt: undefined
  }
]
```

#### Focus Area Fixtures
```typescript
// tests/fixtures/focus-areas/sample-stats.ts
export const SAMPLE_FOCUS_STATS: FocusAreaStats = {
  'main-idea': {
    attempts: 10,
    incorrect: 2,
    accuracy: 80,
    trend: 'improving',
    lastAttempt: '2024-01-01T00:00:00Z'
  }
}
```

## Error Handling

### Test Error Boundaries
- Mock error scenarios for component error boundaries
- Test graceful degradation when localStorage is unavailable
- Validate error handling in async operations
- Test network failure scenarios with MSW

### Assertion Strategies
- Use specific matchers for better error messages
- Implement custom matchers for domain-specific assertions
- Provide detailed failure context in test descriptions
- Use snapshot testing judiciously for complex objects

## Testing Strategy

### Unit Tests (70% of test suite)

#### Storage Service Tests
```typescript
// tests/unit/lib/storage.test.ts
describe('Storage Service', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  describe('saveToHistory', () => {
    it('should save exercise to history with proper ordering', () => {
      // Test implementation
    })
    
    it('should limit history to MAX_HISTORY_ITEMS', () => {
      // Test implementation
    })
  })

  describe('convertExerciseToSessionData', () => {
    it('should prioritize totalDurationSec when available', () => {
      // Test implementation
    })
    
    it('should fallback to estimated duration when totalDurationSec is missing', () => {
      // Test implementation
    })
  })
})
```

#### Achievement Service Tests
```typescript
// tests/unit/lib/achievement-service.test.ts
describe('Achievement Service', () => {
  describe('updateProgressMetrics', () => {
    it('should correctly accumulate session data', () => {
      // Test implementation
    })
    
    it('should calculate streak days accurately', () => {
      // Test implementation
    })
  })

  describe('checkNewAchievements', () => {
    it('should detect newly earned achievements', () => {
      // Test implementation
    })
    
    it('should not duplicate already earned achievements', () => {
      // Test implementation
    })
  })
})
```

#### Focus Metrics Tests
```typescript
// tests/unit/lib/focus-metrics.test.ts
describe('Focus Metrics', () => {
  describe('computeFocusStats', () => {
    it('should calculate accuracy correctly for each focus area', () => {
      // Test implementation
    })
    
    it('should handle missing or invalid exercise data gracefully', () => {
      // Test implementation
    })
  })

  describe('selectRecommendedFocusAreas', () => {
    it('should prioritize areas with lower accuracy', () => {
      // Test implementation
    })
    
    it('should respect maxRecommendations parameter', () => {
      // Test implementation
    })
  })
})
```

#### Hotkeys Hook Tests
```typescript
// tests/unit/hooks/use-hotkeys.test.ts
describe('useHotkeys', () => {
  it('should register keyboard event listeners when enabled', () => {
    // Test implementation
  })
  
  it('should sync with localStorage settings changes', () => {
    // Test implementation
  })
  
  it('should filter shortcuts based on current step and context', () => {
    // Test implementation
  })
})
```

### Integration Tests (25% of test suite)

#### Component Integration Tests
```typescript
// tests/integration/components/question-interface.spec.ts
describe('QuestionInterface Integration', () => {
  it('should handle answer submission with specialized tags', async () => {
    const mockOnAnswer = vi.fn()
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

#### API Route Tests
```typescript
// tests/integration/api/practice-save.spec.ts
describe('/api/practice/save', () => {
  it('should save practice session with specialized fields', async () => {
    const mockSession = createMockPracticeSession({
      focusAreas: ['main-idea', 'detail-comprehension']
    })
    
    const response = await POST(new Request('http://localhost/api/practice/save', {
      method: 'POST',
      body: JSON.stringify(mockSession)
    }))
    
    expect(response.status).toBe(200)
    expect(mockPrisma.practiceSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        exerciseData: expect.stringContaining('focusAreas')
      })
    })
  })
})
```

### End-to-End Tests (5% of test suite)

#### Complete User Journeys
```typescript
// tests/e2e/scenarios/specialized-practice-flow.spec.ts
describe('Specialized Practice Flow', () => {
  it('should complete generate → answer → results flow', async () => {
    // Mock AI services
    server.use(
      rest.post('/api/ai/questions', (req, res, ctx) => {
        return res(ctx.json(mockQuestionsResponse))
      })
    )
    
    render(<MainApp />)
    
    // Test complete user journey
    // 1. Select focus areas
    // 2. Generate questions
    // 3. Answer questions
    // 4. View results with specialized data
    // 5. Verify persistence
  })
})
```

## Performance Considerations

### Test Execution Speed
- Parallel test execution with worker threads
- Efficient mock implementations that don't perform real I/O
- Selective test running based on changed files
- Optimized fixture loading and cleanup

### Memory Management
- Proper cleanup of event listeners in hook tests
- Reset mocks and storage between tests
- Avoid memory leaks in long-running test suites
- Monitor test execution time and memory usage

### CI/CD Integration
- Headless test execution for CI environments
- Coverage reporting integration
- Test result caching for faster subsequent runs
- Fail-fast strategies for critical test failures

## Quality Gates

### Coverage Thresholds
- Line Coverage: 70% minimum
- Branch Coverage: 60% minimum
- Function Coverage: 80% minimum
- Critical business logic: 90% minimum

### Performance Benchmarks
- Unit tests: Complete within 10 seconds
- Integration tests: Complete within 30 seconds
- E2E tests: Complete within 60 seconds
- Individual test timeout: 5 seconds maximum

### Code Quality Standards
- All tests must pass ESLint rules
- TypeScript strict mode compliance
- Meaningful test descriptions and assertions
- Proper error handling and edge case coverage