# Test Fixtures

This directory contains comprehensive test fixtures for the automated testing system. These fixtures provide realistic sample data for testing all aspects of the english-listening-trainer application.

## Directory Structure

```
fixtures/
├── exercises/           # Exercise and practice session data
├── achievements/        # Achievement system data
├── focus-areas/         # Focus area statistics and recommendations
├── api-responses/       # AI service response mocks
└── index.ts            # Centralized exports
```

## Usage

Import fixtures using the centralized index:

```typescript
import { 
  SAMPLE_EXERCISES, 
  SAMPLE_PRACTICE_SESSIONS,
  SAMPLE_EARNED_ACHIEVEMENTS,
  SAMPLE_FOCUS_STATS,
  SAMPLE_AI_ANALYSIS_RESPONSES
} from '../fixtures'
```

Or import specific fixture files:

```typescript
import { createMockExercise } from '../fixtures/exercises/sample-exercises'
import { createMockAchievement } from '../fixtures/achievements/sample-achievements'
```

## Exercise Fixtures (`exercises/`)

### `sample-exercises.ts`
- **SAMPLE_EXERCISES**: Complete exercise objects with various difficulty levels
- **SAMPLE_QUESTIONS**: Question sets for different complexity levels
- **SAMPLE_GRADING_RESULTS**: Corresponding grading results
- **Helper functions**: `createMockExercise()`, `createExerciseWithFocusAreas()`

Key scenarios covered:
- Beginner (A1), Intermediate (B1), Advanced (C1) exercises
- Specialized vs. general practice modes
- Perfect, partial, and poor focus area coverage
- Exercises with and without duration data (for fallback testing)

### `practice-sessions.ts`
- **SAMPLE_PRACTICE_SESSIONS**: Various session performance scenarios
- **SAMPLE_USER_PROGRESS**: User progress metrics for achievement testing
- **SAMPLE_GOAL_PROGRESS**: Goal tracking data
- **Helper functions**: `createMockPracticeSession()`, `createSessionSeries()`

Key scenarios covered:
- High-performing, average, and challenging sessions
- New users, experienced users, and high achievers
- Streak calculations and goal progress tracking
- Weekly trend data for analytics

## Achievement Fixtures (`achievements/`)

### `sample-achievements.ts`
- **ACHIEVEMENT_DEFINITIONS**: All predefined achievement types
- **SAMPLE_EARNED_ACHIEVEMENTS**: Achievement data for different user types
- **SAMPLE_ACHIEVEMENT_NOTIFICATIONS**: Notification scenarios
- **Helper functions**: `createMockAchievement()`, `checkAchievementCondition()`

Achievement types covered:
- Session-based (1, 10, 50, 100 sessions)
- Accuracy-based (80%, 90%, 95% with minimum sessions)
- Streak-based (7, 14, 30 days)
- Minutes-based (60, 600, 6000 minutes)

## Focus Area Fixtures (`focus-areas/`)

### `sample-stats.ts`
- **SAMPLE_FOCUS_STATS**: Performance statistics for all focus areas
- **SAMPLE_FOCUS_RECOMMENDATIONS**: Recommended focus areas based on performance
- **Helper functions**: `createMockFocusStats()`, `getFocusAreasNeedingImprovement()`

Scenarios covered:
- Balanced performance across all areas
- Beginner users with specific weak areas
- Advanced users with high performance
- Users with specific challenging areas (inference, speaker-attitude)
- Empty and minimal data for edge case testing

## AI Response Fixtures (`api-responses/`)

### `ai-responses.ts`
- **SAMPLE_AI_ANALYSIS_RESPONSES**: Wrong answer analysis responses
- **SAMPLE_QUESTION_GENERATION_RESPONSES**: Question generation outcomes
- **SAMPLE_TOPIC_GENERATION_RESPONSES**: Topic generation results
- **Helper functions**: `createMockAIAnalysis()`, `createMockQuestionGeneration()`

Response types covered:
- High, medium, and low confidence AI analyses
- Successful and failed generation attempts
- Perfect and partial focus area coverage
- Various degradation scenarios

## Best Practices

### Using Fixtures in Tests

1. **Use appropriate fixtures for test scenarios**:
   ```typescript
   // For testing beginner functionality
   const exercise = SAMPLE_EXERCISES.beginnerTravel
   
   // For testing achievement calculations
   const progress = SAMPLE_USER_PROGRESS.experiencedUser
   ```

2. **Create variations with helper functions**:
   ```typescript
   // Create custom exercise with specific focus areas
   const customExercise = createExerciseWithFocusAreas(['main-idea', 'inference'])
   
   // Create session series for streak testing
   const sessions = createSessionSeries(7) // 7 consecutive days
   ```

3. **Use realistic data for integration tests**:
   ```typescript
   // Test complete user journey with realistic data
   const userProgress = SAMPLE_USER_PROGRESS.highAchiever
   const achievements = SAMPLE_EARNED_ACHIEVEMENTS.highAchiever
   ```

### Extending Fixtures

When adding new fixtures:

1. Follow the existing naming conventions (`SAMPLE_*`, `createMock*()`)
2. Include comprehensive JSDoc comments
3. Provide both static data and helper functions
4. Cover edge cases and error scenarios
5. Update the centralized index.ts file
6. Add documentation to this README

### Data Consistency

All fixtures maintain consistency with:
- TypeScript type definitions in `lib/types.ts`
- Focus area definitions in `FOCUS_AREA_LIST`
- Achievement condition types
- Date formats (ISO 8601)
- Accuracy ranges (0-100)
- Duration formats (seconds)

## Testing Scenarios

These fixtures support testing of:

- **Unit Tests**: Individual function behavior with various input scenarios
- **Integration Tests**: Component interactions with realistic data flows
- **End-to-End Tests**: Complete user journeys with comprehensive data sets
- **Edge Cases**: Empty data, missing fields, boundary conditions
- **Performance Tests**: Large data sets and bulk operations
- **Error Handling**: Invalid data and failure scenarios

## Maintenance

When updating fixtures:

1. Ensure backward compatibility for existing tests
2. Update related helper functions
3. Verify TypeScript compilation
4. Run affected test suites
5. Update documentation as needed

For questions or suggestions about fixtures, refer to the main testing documentation or create an issue in the project repository.