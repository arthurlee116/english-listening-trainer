# Design Document

## Overview

This design document outlines the technical approach for implementing bilingual UI internationalization in the English Listening Trainer application. The system will transform all interface text to display in a consistent "English 中文" format using a centralized internationalization framework.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                          │
├─────────────────────────────────────────────────────────────┤
│  useBilingualText Hook  │  BilingualText Component          │
├─────────────────────────────────────────────────────────────┤
│              I18n Service Layer                             │
├─────────────────────────────────────────────────────────────┤
│           Translation Resources (JSON)                      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **I18n Framework**: react-i18next
- **Translation Format**: JSON-based key-value pairs
- **Display Format**: Custom bilingual formatter
- **State Management**: React Context for i18n configuration

## Components and Interfaces

### 1. I18n Configuration

```typescript
// lib/i18n/config.ts
interface BilingualConfig {
  defaultLanguage: 'en' | 'zh'
  displayFormat: 'en-zh' | 'zh-en'
  separator: string
}

interface TranslationKey {
  en: string
  zh: string
}
```

### 2. Translation Resources Structure

```typescript
// lib/i18n/translations.ts
interface TranslationResources {
  common: {
    buttons: Record<string, TranslationKey>
    labels: Record<string, TranslationKey>
    messages: Record<string, TranslationKey>
    placeholders: Record<string, TranslationKey>
  }
  pages: {
    home: Record<string, TranslationKey>
    assessment: Record<string, TranslationKey>
    history: Record<string, TranslationKey>
    results: Record<string, TranslationKey>
  }
  components: {
    audioPlayer: Record<string, TranslationKey>
    questionInterface: Record<string, TranslationKey>
    wrongAnswersBook: Record<string, TranslationKey>
  }
}
```

### 3. Bilingual Text Hook

```typescript
// hooks/useBilingualText.ts
interface UseBilingualTextReturn {
  t: (key: string, options?: FormatOptions) => string
  formatBilingual: (en: string, zh: string, options?: FormatOptions) => string
}

interface FormatOptions {
  withUnit?: string
  withParentheses?: boolean
  separator?: string
}
```

### 4. Bilingual Text Component

```typescript
// components/ui/bilingual-text.tsx
interface BilingualTextProps {
  translationKey?: string
  en?: string
  zh?: string
  unit?: string
  className?: string
  as?: keyof JSX.IntrinsicElements
}
```

## Data Models

### Translation Key Structure

```json
{
  "buttons": {
    "generate": {
      "en": "Generate",
      "zh": "生成"
    },
    "history": {
      "en": "History",
      "zh": "历史"
    },
    "admin": {
      "en": "Admin",
      "zh": "管理"
    }
  },
  "labels": {
    "difficulty": {
      "en": "Difficulty Level",
      "zh": "难度级别"
    },
    "duration": {
      "en": "Duration",
      "zh": "时长"
    },
    "topic": {
      "en": "Topic",
      "zh": "话题"
    }
  }
}
```

### Difficulty Levels Mapping

```json
{
  "difficultyLevels": {
    "A1": {
      "en": "A1 - Beginner",
      "zh": "A1 - 初学者"
    },
    "A2": {
      "en": "A2 - Elementary", 
      "zh": "A2 - 基础级"
    },
    "B1": {
      "en": "B1 - Intermediate",
      "zh": "B1 - 中级"
    },
    "B2": {
      "en": "B2 - Upper Intermediate",
      "zh": "B2 - 中高级"
    },
    "C1": {
      "en": "C1 - Advanced",
      "zh": "C1 - 高级"
    },
    "C2": {
      "en": "C2 - Proficient",
      "zh": "C2 - 精通级"
    }
  }
}
```

### Duration Options Structure

```json
{
  "durationOptions": {
    "1min": {
      "en": "1 minute (~120 words)",
      "zh": "1分钟 (~120词)"
    },
    "2min": {
      "en": "2 minutes (~240 words)",
      "zh": "2分钟 (~240词)"
    },
    "3min": {
      "en": "3 minutes (~360 words)",
      "zh": "3分钟 (~360词)"
    },
    "5min": {
      "en": "5 minutes (~600 words)",
      "zh": "5分钟 (~600词)"
    }
  }
}
```

## Error Handling

### Translation Missing Fallback

```typescript
interface FallbackStrategy {
  showKey: boolean // Show translation key if missing
  showEnglish: boolean // Show English only if Chinese missing
  showPlaceholder: string // Default placeholder text
}
```

### Error Boundary for I18n

```typescript
// components/i18n-error-boundary.tsx
interface I18nErrorBoundaryProps {
  fallback: React.ComponentType<{error: Error}>
  children: React.ReactNode
}
```

## Testing Strategy

### Unit Tests

1. **Translation Key Coverage**
   - Verify all translation keys have both English and Chinese values
   - Test missing translation fallback behavior
   - Validate translation key naming conventions

2. **Bilingual Text Formatting**
   - Test standard "English 中文" format
   - Test unit formatting "Duration 时长 (min)"
   - Test special character handling

3. **Hook Functionality**
   - Test `useBilingualText` hook return values
   - Test formatting options
   - Test context provider integration

### Integration Tests

1. **Component Integration**
   - Test BilingualText component rendering
   - Test translation updates across components
   - Test error boundary behavior

2. **Page-Level Testing**
   - Verify all page elements display bilingually
   - Test navigation consistency
   - Test form validation messages

### E2E Tests

1. **User Journey Testing**
   - Complete exercise flow with bilingual UI
   - Assessment process with bilingual feedback
   - History and results viewing

## Implementation Phases

### Phase 1: Foundation Setup
- Install and configure react-i18next
- Create translation resource files
- Implement core bilingual text utilities
- Set up error handling and fallbacks

### Phase 2: Core Components
- Implement useBilingualText hook
- Create BilingualText component
- Update common UI components (buttons, labels)
- Implement translation context provider

### Phase 3: Page Integration
- Update main page (app/page.tsx)
- Update audio player component
- Update question interface
- Update results display

### Phase 4: Feature Components
- Update history panel
- Update wrong answers book
- Update assessment interface
- Update admin and settings

### Phase 5: Testing and Optimization
- Comprehensive testing
- Performance optimization
- Translation completeness audit
- User acceptance testing

## Performance Considerations

### Bundle Size Optimization
- Lazy load translation resources
- Tree-shake unused translations
- Compress translation files

### Runtime Performance
- Memoize translation lookups
- Cache formatted bilingual strings
- Optimize re-renders with React.memo

### Memory Management
- Efficient translation key storage
- Garbage collection for unused translations
- Memory leak prevention in context providers

## Accessibility Considerations

### Screen Reader Support
- Proper ARIA labels for bilingual content
- Language tagging for different text segments
- Semantic HTML structure preservation

### Internationalization Standards
- Follow W3C i18n guidelines
- Support RTL languages (future consideration)
- Unicode character handling

## Migration Strategy

### Backward Compatibility
- Gradual migration approach
- Fallback to existing text during transition
- Feature flag for bilingual mode

### Rollback Plan
- Version control checkpoints
- Component-level rollback capability
- Translation resource versioning

## Security Considerations

### XSS Prevention
- Sanitize translation content
- Escape special characters in translations
- Validate translation key inputs

### Content Security Policy
- Allow inline styles for bilingual formatting
- Restrict translation resource sources
- Monitor for malicious translation injections