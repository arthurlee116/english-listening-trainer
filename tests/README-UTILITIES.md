# Test Utilities Documentation

This document describes the comprehensive test utilities created for the automated testing system.

## Overview

The test utilities provide a complete mocking and testing infrastructure for the english-listening-trainer application, including:

- Custom render utilities with provider support
- Comprehensive data mocking utilities
- Storage mocking with event simulation
- API mocking using MSW (Mock Service Worker)
- Prisma database mocking with dependency injection

## Files Created

### Core Utilities

#### `tests/helpers/render-utils.tsx`
Custom render functions that wrap components with all necessary providers:

- **`renderWithProviders()`** - Full render with I18n, Theme, and storage providers
- **`renderWithoutI18n()`** - Lightweight render for components that don't need translations
- **`renderWithI18n()`** - Specialized render for testing I18n components with additional utilities
- **`mockLocalStorage()`** - Helper to initialize localStorage with test data
- **`createStorageEvent()`** - Helper to create storage events for cross-tab testing

#### `tests/helpers/mock-utils.ts`
Comprehensive data mocking utilities:

- **Exercise Mocking**: `createMockExercise()`, `createMockQuestion()`, `createMockGradingResult()`
- **Practice Session Mocking**: `createMockPracticeSession()`
- **Achievement System Mocking**: `createMockAchievement()`, `createMockProgressMetrics()`, `createMockGoalSettings()`
- **Focus Area Mocking**: `createMockFocusAreaStats()`, `createMockSpecializedPreset()`, `createMockFocusCoverage()`
- **Wrong Answer Mocking**: `createMockWrongAnswer()`, `createMockAIAnalysisResponse()`
- **Utility Functions**: `createMockExerciseSet()`, `createMockPracticeHistory()`, `createMockAchievementSet()`
- **Edge Case Testing**: `createEdgeCaseExercise()`, `createLargeExercise()`

#### `tests/helpers/storage-mock.ts`
Complete Storage interface implementation with event simulation:

- **`MockStorage` class** - Full Storage implementation with cross-tab communication simulation
- **`mockStorage()`** - Setup function to replace global storage objects
- **`mockStorageWithTestData()`** - Pre-configured storage with realistic test data
- **Event Simulation** - Support for storage events and cross-tab communication testing
- **Utility Functions** - Storage manipulation and testing helpers

#### `tests/helpers/api-mocks.ts`
MSW-based API mocking for external service calls:

- **Request Handlers** - Mock responses for all API endpoints
- **Dynamic Responses** - Context-aware responses based on request parameters
- **Error Simulation** - Utilities to simulate API failures and timeouts
- **Specialized Mocks** - Functions for specific testing scenarios
- **Server Setup** - Complete MSW server configuration for tests

### Database Mocking

#### `tests/__mocks__/prisma/client.ts`
Complete Prisma client mock with all database operations:

- **Model Operations** - Full CRUD operations for all Prisma models
- **Relationship Support** - Proper handling of model relationships and includes
- **Transaction Support** - Mock implementation of Prisma transactions
- **Aggregation Support** - Mock aggregate operations for statistics
- **Test Utilities** - Helper functions for common testing scenarios

#### `tests/helpers/database-injection.ts`
Dependency injection pattern for database operations in tests:

- **Database Context** - Abstraction layer for database operations
- **Service Factories** - Factory functions for creating database services
- **Mock Services** - Pre-built mock services for common operations
- **Test Utilities** - Helpers for testing with different database contexts
- **Error Simulation** - Utilities for testing database error scenarios

## Usage Examples

### Basic Component Testing

```typescript
import { renderWithProviders } from '@/tests/helpers/render-utils';
import { createMockExercise } from '@/tests/helpers/mock-utils';

test('should render exercise component', () => {
  const exercise = createMockExercise();
  const { getByText } = renderWithProviders(
    <ExerciseComponent exercise={exercise} />
  );
  
  expect(getByText(exercise.topic)).toBeInTheDocument();
});
```

### Storage Testing

```typescript
import { MockStorage, mockStorage } from '@/tests/helpers/storage-mock';

test('should handle storage events', () => {
  const { localStorage } = mockStorage();
  const events: StorageEvent[] = [];
  
  localStorage.addEventListener((event) => {
    events.push(event);
  });
  
  localStorage.setItem('test', 'value');
  expect(events).toHaveLength(1);
});
```

### API Testing

```typescript
import { server, mockApiEndpoint } from '@/tests/helpers/api-mocks';

test('should handle API responses', async () => {
  mockApiEndpoint('post', '/api/ai/questions', {
    success: true,
    questions: [createMockQuestion()],
  });
  
  // Test API call
});
```

### Database Testing

```typescript
import { mockPrisma } from '@/tests/__mocks__/prisma/client';
import { createMockPracticeSessionService } from '@/tests/helpers/database-injection';

test('should create practice session', async () => {
  const service = createMockPracticeSessionService();
  const session = await service.createSession({
    userId: 'test-user',
    topic: 'Test Topic',
  });
  
  expect(session.topic).toBe('Test Topic');
  expect(mockPrisma.practiceSession.create).toHaveBeenCalled();
});
```

## Key Features

### Provider Support
- Automatic wrapping with I18n, Theme, and other providers
- Configurable provider options for different test scenarios
- Support for skipping expensive provider initialization

### Realistic Mock Data
- Consistent data structures matching application types
- Configurable overrides for specific test scenarios
- Edge case and performance testing data generators

### Event Simulation
- Storage events for cross-tab communication testing
- API response simulation with MSW
- Database operation mocking with proper error handling

### Dependency Injection
- Clean separation of concerns for database operations
- Easy swapping of real and mock implementations
- Support for error scenarios and edge cases

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 2.2**: Custom render utilities with provider support ✅
- **Requirement 5.1**: MSW-based API mocking for external services ✅
- **Requirement 5.2**: Browser API mocks (localStorage, window APIs) ✅
- **Requirement 5.3**: Prisma mocking with dependency injection ✅
- **Requirement 5.4**: I18n mocks that don't break component rendering ✅

## Next Steps

These utilities are now ready to be used in:
1. Unit tests for business logic components
2. Integration tests for component workflows
3. End-to-end tests for complete user journeys

The utilities provide a solid foundation for implementing comprehensive test coverage across all application layers.