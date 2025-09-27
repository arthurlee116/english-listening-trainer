# Wrong Answers AI Analysis API Documentation

## Overview

The Wrong Answers AI Analysis system provides comprehensive AI-powered analysis for incorrect answers in language learning exercises. This document describes the API endpoints, data structures, and usage patterns for the system.

## Authentication

All endpoints require user authentication via JWT token stored in httpOnly cookies. Users must be logged in to access these APIs.

## API Endpoints

### 1. Import Legacy Data

**Endpoint**: `POST /api/practice/import-legacy`

**Description**: Imports historical practice data from localStorage into the database.

**Request Body**:
```json
{
  "sessions": [
    {
      "sessionId": "string",
      "topic": "string",
      "difficulty": "string",
      "language": "string", 
      "transcript": "string",
      "score": "number",
      "createdAt": "string (ISO date)",
      "questions": [
        {
          "index": "number",
          "type": "string",
          "question": "string",
          "options": ["string"] | null,
          "correctAnswer": "string",
          "explanation": "string" | null,
          "answers": [
            {
              "userAnswer": "string",
              "isCorrect": "boolean",
              "attemptedAt": "string (ISO date)"
            }
          ]
        }
      ]
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Legacy data imported successfully",
  "imported": {
    "sessions": 5,
    "questions": 25,
    "answers": 30
  }
}
```

**Error Response**:
```json
{
  "error": "Import failed",
  "details": "Validation error message"
}
```

### 2. Single Question AI Analysis

**Endpoint**: `POST /api/ai/wrong-answers/analyze`

**Description**: Generates AI analysis for a single wrong answer.

**Request Body**:
```json
{
  "questionId": "string",
  "answerId": "string",
  "questionType": "string",
  "question": "string",
  "options": ["string"] | null,
  "userAnswer": "string",
  "correctAnswer": "string",
  "transcript": "string",
  "exerciseTopic": "string",
  "exerciseDifficulty": "string",
  "language": "string",
  "attemptedAt": "string (ISO date)"
}
```

**Response**:
```json
{
  "success": true,
  "analysis": {
    "analysis": "详尽的中文解析，至少150字，包含错误原因分析、知识点解释和改进建议",
    "key_reason": "简述主要错误原因，如'细节理解缺失'或'推理判断错误'",
    "ability_tags": ["听力细节捕捉", "推理判断", "词汇理解"],
    "signal_words": ["关键提示词1", "关键提示词2", "重要信号词"],
    "strategy": "针对该题型的作答策略和技巧建议",
    "related_sentences": [
      {
        "quote": "听力材料中的原句片段",
        "comment": "该句与正确答案的关系说明"
      }
    ],
    "confidence": "high" | "medium" | "low"
  }
}
```

**Error Response**:
```json
{
  "error": "AI analysis failed",
  "code": "AI_SERVICE_ERROR",
  "details": "Specific error message"
}
```

### 3. Batch AI Analysis

**Endpoint**: `POST /api/ai/wrong-answers/analyze-batch`

**Description**: Processes multiple wrong answers for AI analysis concurrently (max 100).

**Request Body**:
```json
{
  "answerIds": ["answerId1", "answerId2", "answerId3"]
}
```

**Response**:
```json
{
  "success": true,
  "results": {
    "successful": 8,
    "failed": 2,
    "total": 10
  },
  "details": {
    "success": [
      {
        "answerId": "answerId1",
        "analysis": {
          // Same structure as single analysis
        }
      }
    ],
    "failed": [
      {
        "answerId": "answerId2",
        "error": "Rate limit exceeded"
      }
    ]
  }
}
```

### 4. List Wrong Answers

**Endpoint**: `GET /api/wrong-answers/list`

**Description**: Retrieves user's wrong answers with optional filtering and pagination.

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `difficulty` (optional): Filter by difficulty level
- `language` (optional): Filter by language
- `type` (optional): Filter by question type
- `search` (optional): Search in question content
- `needsAnalysis` (optional): Filter by analysis status (true/false)

**Response**:
```json
{
  "success": true,
  "wrongAnswers": [
    {
      "answerId": "string",
      "questionId": "string", 
      "sessionId": "string",
      "session": {
        "topic": "string",
        "difficulty": "string",
        "language": "string",
        "createdAt": "string (ISO date)"
      },
      "question": {
        "index": "number",
        "type": "string",
        "question": "string",
        "options": ["string"] | null,
        "correctAnswer": "string",
        "explanation": "string" | null,
        "transcript": "string"
      },
      "answer": {
        "userAnswer": "string",
        "isCorrect": false,
        "attemptedAt": "string (ISO date)",
        "aiAnalysis": {
          // AI analysis object or null
        },
        "aiAnalysisGeneratedAt": "string (ISO date)" | null,
        "needsAnalysis": "boolean"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

## Data Models

### AI Analysis Schema

The AI analysis is stored as JSON with the following structure:

```typescript
interface AIAnalysis {
  analysis: string;           // Detailed Chinese explanation (150+ characters)
  key_reason: string;         // Main error reason summary
  ability_tags: string[];     // Skill categories (e.g., "听力细节捕捉")
  signal_words: string[];     // Key signal words from audio
  strategy: string;           // Answering strategy and tips
  related_sentences: Array<{  // Related sentences from transcript
    quote: string;            // Original sentence fragment
    comment: string;          // Explanation of relevance
  }>;
  confidence: 'high' | 'medium' | 'low'; // AI confidence level
}
```

### Database Schema

The system uses three main tables:

```sql
-- Practice sessions
CREATE TABLE practice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  language TEXT NOT NULL,
  transcript TEXT NOT NULL,
  score INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Practice questions
CREATE TABLE practice_questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  index INTEGER NOT NULL,
  type TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSON,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  transcript_snapshot TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE
);

-- Practice answers with AI analysis
CREATE TABLE practice_answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ai_analysis JSON,
  ai_analysis_generated_at DATETIME,
  tags TEXT[] DEFAULT '{}',
  needs_analysis BOOLEAN DEFAULT true,
  FOREIGN KEY (question_id) REFERENCES practice_questions(id) ON DELETE CASCADE
);
```

## Error Handling

### Error Codes

- `UNAUTHORIZED`: User not authenticated
- `INVALID_REQUEST`: Request validation failed
- `AI_SERVICE_ERROR`: AI service unavailable or failed
- `DATABASE_ERROR`: Database operation failed
- `RATE_LIMIT_EXCEEDED`: Too many concurrent requests

### Rate Limiting

- Single analysis: 10 requests per minute per user
- Batch analysis: 1 request per minute per user
- Maximum concurrent requests: 100 per batch

### Retry Logic

- AI service failures: Automatic retry with exponential backoff (max 3 attempts)
- Network errors: Client should implement retry with user confirmation
- Rate limit errors: Client should queue requests and retry after delay

## Usage Examples

### Frontend Integration

```typescript
// Import legacy data on app startup
const importLegacyData = async (sessions: LegacySession[]) => {
  const response = await fetch('/api/practice/import-legacy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessions })
  });
  return response.json();
};

// Generate single analysis
const generateAnalysis = async (answerId: string, questionData: QuestionData) => {
  const response = await fetch('/api/ai/wrong-answers/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      answerId,
      ...questionData
    })
  });
  return response.json();
};

// Batch generate analyses
const batchGenerateAnalyses = async (answerIds: string[]) => {
  const response = await fetch('/api/ai/wrong-answers/analyze-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answerIds })
  });
  return response.json();
};

// Fetch wrong answers with filtering
const fetchWrongAnswers = async (filters: FilterOptions) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/wrong-answers/list?${params}`);
  return response.json();
};
```

### Concurrency Management

```typescript
import pLimit from 'p-limit';

// Limit concurrent AI requests
const limit = pLimit(10);

const processAnalyses = async (answerIds: string[]) => {
  const promises = answerIds.map(id => 
    limit(() => generateAnalysis(id, questionData))
  );
  
  const results = await Promise.allSettled(promises);
  return results;
};
```

## Security Considerations

### Input Validation

- All request bodies are validated against strict schemas
- User input is sanitized before AI processing
- SQL injection protection via Prisma ORM

### Data Protection

- User data isolation: All queries filtered by authenticated user ID
- AI analysis content is escaped for safe display
- No sensitive data logged in AI requests

### Rate Limiting

- Per-user rate limits prevent abuse
- Circuit breaker pattern for AI service protection
- Request queuing with timeout handling

## Performance Optimization

### Database Optimization

- Indexes on frequently queried fields (user_id, created_at, needs_analysis)
- Pagination for large result sets
- Connection pooling for concurrent requests

### AI Service Optimization

- Request batching with configurable concurrency limits
- Response caching for identical questions (future enhancement)
- Retry logic with exponential backoff
- Connection pooling for proxy requests

### Frontend Optimization

- Optimistic UI updates for better perceived performance
- Virtual scrolling for large wrong answer lists
- Debounced search and filtering
- Progressive loading of AI analysis content

## Monitoring and Logging

### Metrics to Track

- AI analysis success/failure rates
- Average response times for AI requests
- User engagement with analysis features
- Database query performance

### Log Events

- AI analysis requests and responses
- Batch processing progress and results
- Error conditions and retry attempts
- User activity patterns

## Deployment Configuration

### Environment Variables

```bash
# AI Service Configuration
CEREBRAS_API_KEY=your_api_key_here
CEREBRAS_PROXY_URL=http://127.0.0.1:7890  # Development
# CEREBRAS_PROXY_URL=http://81.71.93.183:10811  # Production

# Database Configuration
DATABASE_URL=file:./data/app.db

# Rate Limiting
AI_ANALYSIS_RATE_LIMIT=10  # requests per minute per user
BATCH_ANALYSIS_RATE_LIMIT=1  # batch requests per minute per user
MAX_CONCURRENT_REQUESTS=100  # maximum concurrent AI requests
```

### Production Considerations

- Configure appropriate proxy settings for AI service access
- Set up monitoring for AI service availability and performance
- Implement backup and recovery procedures for analysis data
- Consider caching strategies for frequently requested analyses
- Monitor disk usage for audio files and database growth