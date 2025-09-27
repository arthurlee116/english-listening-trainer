# Requirements Document

## Introduction

This feature implements an AI-powered analysis system for wrong answers in the language learning application. After practice sessions, users can generate detailed Chinese explanations for incorrect answers using AI analysis. The system provides comprehensive insights including error reasons, ability tags, key signal words, and answering strategies. All practice data and AI analyses are stored in the database for multi-device synchronization, with export capabilities for offline review.

## Requirements

### Requirement 1

**User Story:** As a language learner, I want AI-generated detailed analysis for my wrong answers, so that I can understand my mistakes and improve my listening comprehension skills.

#### Acceptance Criteria

1. WHEN a practice session ends THEN the system SHALL store all questions and answers in the database with needsAnalysis flag set to true
2. WHEN I view the wrong answers book THEN the system SHALL display an "AI Analysis" collapsible card for each wrong answer
3. WHEN I click "Generate Analysis" for a wrong answer THEN the system SHALL send the question data to AI service and return structured Chinese analysis
4. WHEN AI analysis is generated THEN the system SHALL display analysis content including error reason, ability tags, signal words, strategy, and related sentences
5. IF AI analysis fails THEN the system SHALL show error message with retry option

### Requirement 2

**User Story:** As a language learner, I want to batch generate AI analysis for all my wrong answers, so that I can efficiently process multiple questions at once.

#### Acceptance Criteria

1. WHEN I view the wrong answers book THEN the system SHALL display a "Batch Generate All Analysis" button in the toolbar
2. WHEN I click "Batch Generate All Analysis" THEN the system SHALL show confirmation dialog with warning about processing all unanalyzed questions
3. WHEN I confirm batch analysis THEN the system SHALL process up to 100 questions concurrently with progress indication
4. WHEN batch processing completes THEN the system SHALL refresh the wrong answers list and show success/failure summary
5. IF any questions fail during batch processing THEN the system SHALL allow individual retry for failed items

### Requirement 3

**User Story:** As a language learner, I want to export my wrong answers with AI analysis to a text file, so that I can review them offline or share with tutors.

#### Acceptance Criteria

1. WHEN I view the wrong answers book THEN the system SHALL display an "Export Analysis as TXT" button in the toolbar
2. WHEN I click export THEN the system SHALL generate a formatted text file containing all wrong answers and their AI analysis
3. WHEN exporting THEN the system SHALL include export timestamp, question details (topic/difficulty/type/date), question text, user answer, correct answer, and full AI analysis
4. WHEN export is complete THEN the system SHALL trigger file download with descriptive filename including timestamp
5. IF no AI analysis exists for questions THEN the system SHALL still export available data with "Analysis not generated" placeholder

### Requirement 4

**User Story:** As a language learner, I want my historical practice data from localStorage automatically migrated to the database, so that I don't lose my previous progress when the new system is implemented.

#### Acceptance Criteria

1. WHEN the application loads THEN the system SHALL check for existing localStorage practice history data
2. IF localStorage data exists THEN the system SHALL automatically upload it to the backend via import API
3. WHEN legacy data is imported THEN the system SHALL set needsAnalysis to true but not trigger automatic AI generation
4. WHEN import is successful THEN the system SHALL clear the localStorage data to prevent duplicate imports
5. IF import fails THEN the system SHALL retain localStorage data and show error notification with retry option

### Requirement 5

**User Story:** As a language learner, I want all my practice sessions and AI analyses stored in a database, so that I can access my learning history across multiple devices.

#### Acceptance Criteria

1. WHEN I complete a practice session THEN the system SHALL store session metadata, questions, and answers in the database
2. WHEN I generate AI analysis THEN the system SHALL store the structured analysis JSON with generation timestamp
3. WHEN I access wrong answers book from any device THEN the system SHALL load my complete practice history from the database
4. WHEN database operations occur THEN the system SHALL handle concurrent access and maintain data consistency
5. IF database operations fail THEN the system SHALL show appropriate error messages and allow retry

### Requirement 6

**User Story:** As a language learner, I want the AI analysis to provide comprehensive insights in Chinese, so that I can understand the specific reasons for my mistakes and learn effective strategies.

#### Acceptance Criteria

1. WHEN AI analysis is requested THEN the system SHALL send question context including transcript, options, correct answer, and user answer to AI service
2. WHEN AI processes the request THEN the system SHALL return structured JSON with analysis, key reason, ability tags, signal words, strategy, related sentences, and confidence level
3. WHEN displaying AI analysis THEN the system SHALL format the response into readable sections with proper Chinese text rendering
4. WHEN AI analysis contains related sentences THEN the system SHALL display original quotes with explanatory comments
5. IF AI returns invalid JSON or incomplete data THEN the system SHALL handle gracefully and show appropriate error message

### Requirement 7

**User Story:** As a system administrator, I want the AI analysis system to handle rate limiting and proxy configuration, so that the service remains stable and accessible in different deployment environments.

#### Acceptance Criteria

1. WHEN making AI API calls THEN the system SHALL respect concurrent request limits (maximum 100 simultaneous requests)
2. WHEN in development environment THEN the system SHALL use local proxy configuration (127.0.0.1:7890)
3. WHEN in production environment THEN the system SHALL use configured proxy URL from environment variables
4. WHEN API calls fail due to rate limiting THEN the system SHALL implement appropriate retry logic with exponential backoff
5. IF proxy configuration is invalid THEN the system SHALL log errors and fall back to direct connection where possible