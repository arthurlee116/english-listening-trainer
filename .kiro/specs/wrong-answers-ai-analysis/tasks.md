# Implementation Plan

- [x] 1. Database Schema Migration and Setup
  - Update Prisma schema with new models for PracticeSession, PracticeQuestion, and PracticeAnswer
  - Run database migration to create new tables with proper indexes and relationships
  - Generate updated Prisma client with new types
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 2. Legacy Data Import API Implementation
  - [x] 2.1 Create import legacy data API endpoint
    - Implement POST /api/practice/import-legacy route handler
    - Add request validation for legacy session data structure
    - Implement database transaction logic to store sessions, questions, and answers
    - Set needsAnalysis flag to true for all imported wrong answers
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 2.2 Add error handling and response formatting
    - Implement comprehensive error handling for database operations
    - Add validation for required fields and data types
    - Create structured API responses with success/error status
    - Add logging for import operations and failures
    - _Requirements: 4.4, 4.5_

- [x] 3. AI Analysis Service Implementation
  - [x] 3.1 Create AI analysis prompt and schema
    - Design comprehensive Chinese analysis prompt for Cerebras API
    - Define JSON schema for structured AI response validation
    - Implement prompt template with context variables (question, transcript, etc.)
    - Add confidence level and related sentences extraction logic
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 3.2 Implement single question analysis API
    - Create POST /api/ai/wrong-answers/analyze endpoint
    - Add request validation for question analysis parameters
    - Integrate with existing Cerebras AI service using ark-helper
    - Implement database update logic for storing AI analysis results
    - Add proper error handling and retry logic for AI service failures
    - _Requirements: 1.3, 1.4, 1.5, 6.3, 6.4_

  - [x] 3.3 Implement batch analysis API
    - Create POST /api/ai/wrong-answers/analyze-batch endpoint
    - Add concurrent processing with configurable limits (max 100)
    - Implement progress tracking and partial success handling
    - Add database batch update operations for multiple analyses
    - Create response format with success/failure breakdown
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.1_

- [ ] 4. Wrong Answers Data Retrieval API
  - [x] 4.1 Create wrong answers list API endpoint
    - Implement GET /api/wrong-answers/list with user authentication
    - Add database queries with proper joins across sessions, questions, and answers
    - Filter results to show only incorrect answers for current user
    - Include session metadata, question details, and AI analysis in response
    - _Requirements: 5.3, 1.1_

  - [x] 4.2 Add pagination and filtering support
    - Implement query parameters for difficulty, language, and question type filters
    - Add search functionality for question content and topics
    - Include pagination with configurable page size
    - Optimize database queries with proper indexing
    - _Requirements: 5.4_

- [x] 5. Frontend Legacy Data Migration
  - [x] 5.1 Implement automatic localStorage detection and upload
    - Add application startup check for existing localStorage history data
    - Create service function to format legacy data for import API
    - Implement automatic upload to import-legacy endpoint on app load
    - Add success handling to clear localStorage after successful import
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 5.2 Add migration error handling and retry logic
    - Implement error handling for failed import operations
    - Add user notification system for migration status
    - Create retrniy mechasm for failed imports
    - Preserve localStorage data if import fails
    - _Requirements: 4.5_

- [x] 6. Enhanced Wrong Answers Book UI
  - [x] 6.1 Update wrong answers book to use database API
    - Modify existing WrongAnswersBook component to call new list API
    - Update data structure handling for new database-backed format
    - Maintain existing filtering and search functionality
    - Add loading states and error handling for API calls
    - _Requirements: 5.3, 1.1_

  - [x] 6.2 Implement AI Analysis collapsible cards
    - Create AIAnalysisCard component with expand/collapse functionality
    - Add analysis state management (not generated, loading, success, error)
    - Implement structured display of AI analysis fields (analysis, key_reason, ability_tags, etc.)
    - Add "Generate Analysis" and "Retry" buttons with proper state handling
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 6.3_

  - [x] 6.3 Add batch analysis toolbar functionality
    - Create "Batch Generate All Analysis" button in wrong answers book toolbar
    - Implement confirmation dialog with processing warning
    - Add batch processing progress indicator and status updates
    - Create success/failure summary display after batch completion
    - Handle individual retry for failed items in batch
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7. Export Functionality Implementation
  - [x] 7.1 Create export service for TXT file generation
    - Implement export service to format wrong answers and AI analysis as text
    - Add structured formatting with timestamps, question details, and analysis
    - Include proper Chinese text encoding and formatting
    - Create downloadable file with descriptive filename including timestamp
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 7.2 Add export button and UI integration
    - Add "Export Analysis as TXT" button to wrong answers book toolbar
    - Implement file download trigger and progress indication
    - Handle cases where AI analysis is not available for some questions
    - Add user feedback for successful export completion
    - _Requirements: 3.1, 3.4, 3.5_

- [x] 8. Concurrency and Rate Limiting
  - [x] 8.1 Implement frontend concurrency controls
    - Add p-limit library for controlling concurrent AI analysis requests
    - Implement request queuing with maximum 100 concurrent requests
    - Add progress tracking for batch operations
    - Create user feedback for queue status and processing progress
    - _Requirements: 7.1, 2.3, 2.4_

  - [x] 8.2 Add backend rate limiting and proxy configuration
    - Implement per-user rate limiting for AI analysis endpoints
    - Configure proxy settings for development and production environments
    - Add retry logic with exponential backoff for failed AI requests
    - Implement circuit breaker pattern for AI service failures
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [ ] 9. Testing Implementation
  - [x] 9.1 Create unit tests for API endpoints
    - Write tests for import-legacy API with various data scenarios
    - Create tests for single and batch AI analysis endpoints
    - Add tests for wrong answers list API with filtering and pagination
    - Test error handling and edge cases for all endpoints
    - _Requirements: All API-related requirements_

  - [x] 9.2 Create frontend component tests
    - Write tests for enhanced WrongAnswersBook component
    - Create tests for AIAnalysisCard component with different states
    - Add tests for batch processing toolbar functionality
    - Test export functionality and file generation
    - _Requirements: All frontend-related requirements_

  - [x] 9.3 Create integration tests
    - Write end-to-end tests for complete user workflow
    - Test legacy data migration and AI analysis generation
    - Add tests for concurrent batch processing scenarios
    - Test cross-device synchronization with database storage
    - _Requirements: 4.1-4.5, 5.1-5.4, 2.1-2.5_

- [x] 10. Documentation and Final Integration
  - [x] 10.1 Update application documentation
    - Update AGENTS.md and CLAUDE.md with new wrong answers AI analysis workflow
    - Document new API endpoints and their usage in the documents folder
    - Add troubleshooting guide for common AI analysis issues
    - Create user guide for new wrong answers book features
    - _Requirements: All requirements_

  - [x] 10.2 Final testing and deployment preparation
    - Run comprehensive test suite including unit, integration, and e2e tests
    - Verify lint checks and code quality standards
    - Test database migration in staging environment
    - Validate AI service integration with production proxy settings
    - _Requirements: All requirements_