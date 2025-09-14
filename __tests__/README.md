# Bilingual UI Internationalization Test Suite

This directory contains comprehensive tests for the bilingual UI internationalization system implemented in the English Listening Trainer application.

## Test Structure

### Unit Tests

#### `hooks/use-bilingual-text.test.ts`
Tests the core `useBilingualText` hook functionality:
- `formatBilingual` function with various options
- `getBilingualValue` function for TranslationKey objects
- `t` function for translation key lookup
- Error handling and fallback behavior
- Edge cases with special characters, unicode, and long text

#### `components/ui/bilingual-text.test.tsx`
Tests the `BilingualText` React component:
- Rendering with translation keys
- Rendering with direct English/Chinese text
- HTML element rendering (span, button, div, etc.)
- CSS class handling
- Props passing and event handling
- Fallback behavior for missing data

#### `lib/i18n/translation-coverage.test.ts`
Tests translation file completeness and structure:
- Translation file structure validation
- Translation completeness checks
- Required translation key verification
- Translation key consistency
- Utility function testing (`isValidTranslationKey`, `getFallbackText`)

#### `lib/i18n/formatting.test.ts`
Tests bilingual formatting utilities:
- Basic bilingual text formatting
- Unit formatting (with and without parentheses)
- Difficulty level formatting
- Duration formatting with word counts
- Special formatting scenarios (measurements, time units, complex expressions)

### Integration Tests

#### `integration/bilingual-system.test.tsx`
Tests the integration of bilingual components:
- Multiple component rendering consistency
- Mixed translation approaches
- HTML element consistency
- Error handling and fallbacks
- Formatting consistency
- Accessibility and screen reader compatibility
- Performance with multiple components
- Edge cases and stress testing

#### `integration/component-bilingual-display-simple.test.tsx`
Tests bilingual display across different component scenarios:
- Multiple component rendering
- Mixed translation approaches
- Error handling across components
- Formatting consistency
- Performance testing
- Accessibility integration
- Edge cases with special characters

#### `integration/error-handling.test.tsx`
Tests comprehensive error handling scenarios:
- Missing translation keys
- Malformed translation keys
- Translation system errors
- Direct text errors (missing English/Chinese)
- Empty string and null value handling
- Formatting errors
- Mixed error scenarios
- Edge cases with special characters
- Error boundary scenarios
- Performance under error conditions

## Test Coverage

The test suite covers:

### Requirements Verification
- **Requirement 1.1**: Bilingual text display in "English 中文" format ✅
- **Requirement 1.4**: Unit formatting like "Duration 时长 (min)" ✅
- **Requirement 2.2**: Centralized i18n configuration ✅
- **Requirement 2.3**: Consistent API for bilingual display ✅
- **Requirement 4.1**: Error message handling ✅
- **Requirement 4.4**: Validation message display ✅

### Core Functionality
- ✅ Translation key lookup and formatting
- ✅ Direct English/Chinese text formatting
- ✅ Unit and measurement formatting
- ✅ Custom separator handling
- ✅ HTML element rendering
- ✅ CSS class and prop handling
- ✅ Error handling and fallbacks

### Edge Cases
- ✅ Missing translations
- ✅ Empty strings and null values
- ✅ Special characters and unicode
- ✅ Very long text content
- ✅ Malformed translation keys
- ✅ System errors and exceptions

### Performance
- ✅ Multiple component rendering
- ✅ Rapid re-renders
- ✅ Large numbers of components
- ✅ Error condition performance

### Accessibility
- ✅ ARIA attribute preservation
- ✅ Keyboard navigation support
- ✅ Focus management
- ✅ Screen reader compatibility

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test:run __tests__/hooks/use-bilingual-text.test.ts

# Run tests with UI
npm run test:ui
```

## Test Configuration

Tests are configured using:
- **Vitest** as the test runner
- **@testing-library/react** for component testing
- **@testing-library/jest-dom** for DOM assertions
- **jsdom** as the test environment

Configuration files:
- `vitest.config.ts` - Main Vitest configuration
- `src/test/setup.ts` - Test setup and mocks

## Mock Strategy

The tests use strategic mocking to:
- Mock Next.js router and navigation
- Mock the bilingual text hook for component tests
- Mock console methods to test error handling
- Simulate various error conditions
- Test fallback behavior

## Coverage Goals

The test suite aims for comprehensive coverage of:
- All public API functions and components
- Error handling and edge cases
- Integration between components
- Performance under various conditions
- Accessibility requirements
- Translation completeness and consistency

This ensures the bilingual UI system is robust, reliable, and maintains consistent behavior across the entire application.