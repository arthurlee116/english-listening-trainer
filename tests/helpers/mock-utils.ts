import { vi } from 'vitest';
import type {
  Exercise,
  PracticeSessionData,
  AchievementBadge,
  Question,
  GradingResult,
  UserProgressMetrics,
  UserGoalSettings,
  FocusArea,
  DifficultyLevel,
  ListeningLanguage,
  QuestionType,
  WrongAnswer,
  AIAnalysisResponse,
  FocusAreaStats,
  SpecializedPreset,
  PracticeTemplate,
  FocusCoverage,
} from '@/lib/types';

// =============== Exercise Mocking ===============

export function createMockQuestion(overrides: Partial<Question> = {}): Question {
  return {
    type: 'single' as QuestionType,
    question: 'What is the main topic of the conversation?',
    options: [
      'Technology trends',
      'Business meeting',
      'Travel plans',
      'Educational programs'
    ],
    answer: 'Technology trends',
    focus_areas: ['main-idea'],
    explanation: 'The conversation primarily discusses emerging technology trends.',
    ...overrides,
  };
}

export function createMockGradingResult(overrides: Partial<GradingResult> = {}): GradingResult {
  return {
    type: 'single' as QuestionType,
    user_answer: 'Technology trends',
    correct_answer: 'Technology trends',
    is_correct: true,
    question_id: 0,
    standard_answer: null,
    score: null,
    short_feedback: null,
    error_tags: [],
    error_analysis: null,
    ...overrides,
  };
}

export function createMockExercise(overrides: Partial<Exercise> = {}): Exercise {
  const baseExercise: Exercise = {
    id: `exercise-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    difficulty: 'B1' as DifficultyLevel,
    language: 'en-US' as ListeningLanguage,
    topic: 'Technology and Innovation',
    transcript: 'In today\'s rapidly evolving technological landscape, artificial intelligence and machine learning are transforming how we work and live. Companies are increasingly adopting these technologies to improve efficiency and create new opportunities.',
    questions: [
      createMockQuestion(),
      createMockQuestion({
        type: 'short',
        question: 'What are the main benefits mentioned?',
        options: null,
        answer: 'Improved efficiency and new opportunities',
        focus_areas: ['detail-comprehension'],
      }),
    ],
    answers: { 0: 'Technology trends', 1: 'Improved efficiency and new opportunities' },
    results: [
      createMockGradingResult(),
      createMockGradingResult({
        type: 'short',
        user_answer: 'Improved efficiency and new opportunities',
        question_id: 1,
        score: 8,
        short_feedback: 'Good understanding of the key points.',
      }),
    ],
    createdAt: new Date().toISOString(),
    totalDurationSec: 180,
    focusAreas: ['main-idea', 'detail-comprehension'],
    specializedMode: false,
    ...overrides,
  };

  // Ensure consistency between questions and results
  if (overrides.questions && !overrides.results) {
    baseExercise.results = overrides.questions.map((_, index) => 
      createMockGradingResult({ question_id: index })
    );
  }

  return baseExercise;
}

// =============== Practice Session Mocking ===============

export function createMockPracticeSession(overrides: Partial<PracticeSessionData> = {}): PracticeSessionData {
  return {
    sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    difficulty: 'B1' as DifficultyLevel,
    language: 'en-US' as ListeningLanguage,
    topic: 'Technology and Innovation',
    accuracy: 85,
    duration: 180,
    questionsCount: 5,
    correctAnswersCount: 4,
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============== Achievement System Mocking ===============

export function createMockAchievement(overrides: Partial<AchievementBadge> = {}): AchievementBadge {
  return {
    id: `achievement-${Math.random().toString(36).substr(2, 9)}`,
    titleKey: 'achievements.firstSession.title',
    descriptionKey: 'achievements.firstSession.desc',
    conditions: { type: 'sessions', threshold: 1 },
    earnedAt: undefined,
    ...overrides,
  };
}

export function createMockProgressMetrics(overrides: Partial<UserProgressMetrics> = {}): UserProgressMetrics {
  return {
    totalSessions: 10,
    totalCorrectAnswers: 42,
    totalQuestions: 50,
    averageAccuracy: 84,
    totalListeningMinutes: 45,
    currentStreakDays: 3,
    longestStreakDays: 7,
    lastPracticedAt: new Date().toISOString(),
    weeklyTrend: [
      { date: '2024-01-01', sessions: 2 },
      { date: '2024-01-02', sessions: 1 },
      { date: '2024-01-03', sessions: 3 },
    ],
    ...overrides,
  };
}

export function createMockGoalSettings(overrides: Partial<UserGoalSettings> = {}): UserGoalSettings {
  return {
    dailyMinutesTarget: 20,
    weeklySessionsTarget: 5,
    lastUpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============== Focus Area and Specialized Practice Mocking ===============

export function createMockFocusAreaStats(overrides: Partial<FocusAreaStats> = {}): FocusAreaStats {
  return {
    'main-idea': {
      attempts: 10,
      incorrect: 2,
      accuracy: 80,
      lastAttempt: new Date().toISOString(),
      trend: 'improving',
    },
    'detail-comprehension': {
      attempts: 8,
      incorrect: 3,
      accuracy: 62.5,
      lastAttempt: new Date().toISOString(),
      trend: 'stable',
    },
    'inference': {
      attempts: 5,
      incorrect: 4,
      accuracy: 20,
      lastAttempt: new Date().toISOString(),
      trend: 'declining',
    },
    ...overrides,
  };
}

export function createMockSpecializedPreset(overrides: Partial<SpecializedPreset> = {}): SpecializedPreset {
  return {
    id: `preset-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Main Ideas Practice',
    focusAreas: ['main-idea', 'detail-comprehension'],
    difficulty: 'B1' as DifficultyLevel,
    language: 'en-US' as ListeningLanguage,
    duration: 300,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockFocusCoverage(overrides: Partial<FocusCoverage> = {}): FocusCoverage {
  return {
    requested: ['main-idea', 'detail-comprehension'],
    provided: ['main-idea', 'detail-comprehension'],
    coverage: 1.0,
    unmatchedTags: [],
    partialMatches: [],
    ...overrides,
  };
}

// =============== Wrong Answer Mocking ===============

export function createMockWrongAnswer(overrides: Partial<WrongAnswer> = {}): WrongAnswer {
  return {
    id: `wrong-answer-${Math.random().toString(36).substr(2, 9)}`,
    userId: 'test-user-id',
    exercise_id: 'test-exercise-id',
    question_index: 0,
    question_data: createMockQuestion(),
    user_answer: 'Business meeting',
    correct_answer: 'Technology trends',
    transcript_snippet: 'In today\'s rapidly evolving technological landscape...',
    topic: 'Technology and Innovation',
    difficulty: 'B1' as DifficultyLevel,
    language: 'en-US' as ListeningLanguage,
    tags: ['main-idea-confusion', 'topic-misidentification'],
    error_analysis: 'The user confused the main topic with a secondary element mentioned in the conversation.',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockAIAnalysisResponse(overrides: Partial<AIAnalysisResponse> = {}): AIAnalysisResponse {
  return {
    analysis: 'The user misidentified the main topic by focusing on a secondary element rather than the primary theme.',
    key_reason: 'Topic confusion between main and secondary themes',
    ability_tags: ['main-idea', 'topic-identification'],
    signal_words: ['technology', 'trends', 'business'],
    strategy: 'Focus on identifying the most frequently mentioned concepts and overall conversation direction.',
    related_sentences: [
      {
        quote: 'In today\'s rapidly evolving technological landscape',
        comment: 'This opening clearly establishes technology as the main theme'
      }
    ],
    confidence: 'high',
    ...overrides,
  };
}

// =============== Template Mocking ===============

export function createMockPracticeTemplate(overrides: Partial<PracticeTemplate> = {}): PracticeTemplate {
  return {
    id: `template-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Technology Focus Template',
    createdAt: new Date().toISOString(),
    difficulty: 'B1' as DifficultyLevel,
    language: 'en-US' as ListeningLanguage,
    duration: 300,
    autoGenerateTopic: false,
    topic: 'Technology and Innovation',
    ...overrides,
  };
}

// =============== Utility Functions ===============

/**
 * Create multiple mock exercises with different characteristics
 */
export function createMockExerciseSet(count: number = 3): Exercise[] {
  const difficulties: DifficultyLevel[] = ['A2', 'B1', 'B2'];
  const topics = ['Technology', 'Business', 'Education', 'Travel', 'Health'];
  const focusAreas: FocusArea[][] = [
    ['main-idea'],
    ['detail-comprehension', 'vocabulary'],
    ['inference', 'speaker-attitude'],
  ];

  return Array.from({ length: count }, (_, index) => 
    createMockExercise({
      id: `exercise-set-${index}`,
      difficulty: difficulties[index % difficulties.length],
      topic: topics[index % topics.length],
      focusAreas: focusAreas[index % focusAreas.length],
      totalDurationSec: 120 + (index * 30), // Varying durations
    })
  );
}

/**
 * Create a realistic practice history with varied performance
 */
export function createMockPracticeHistory(sessionCount: number = 5): PracticeSessionData[] {
  return Array.from({ length: sessionCount }, (_, index) => {
    const accuracy = Math.max(40, Math.min(95, 70 + (Math.random() - 0.5) * 30));
    const questionsCount = 3 + Math.floor(Math.random() * 5);
    const correctAnswersCount = Math.floor((accuracy / 100) * questionsCount);
    
    return createMockPracticeSession({
      sessionId: `history-session-${index}`,
      accuracy: Math.round(accuracy),
      questionsCount,
      correctAnswersCount,
      duration: 120 + Math.floor(Math.random() * 180),
      completedAt: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString(),
    });
  });
}

/**
 * Create achievement set with some earned and some not earned
 */
export function createMockAchievementSet(): AchievementBadge[] {
  return [
    createMockAchievement({
      id: 'first-session',
      titleKey: 'achievements.firstSession.title',
      earnedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    createMockAchievement({
      id: 'accuracy-master',
      titleKey: 'achievements.accuracyMaster.title',
      conditions: { type: 'accuracy', threshold: 90, minSessions: 5 },
      earnedAt: undefined, // Not earned yet
    }),
    createMockAchievement({
      id: 'streak-warrior',
      titleKey: 'achievements.streakWarrior.title',
      conditions: { type: 'streak', threshold: 7 },
      earnedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  ];
}

// =============== Mock Data Generators for Testing Edge Cases ===============

/**
 * Create an exercise with edge case data for testing robustness
 */
export function createEdgeCaseExercise(): Exercise {
  return createMockExercise({
    id: 'edge-case-exercise',
    transcript: '', // Empty transcript
    questions: [], // No questions
    results: [], // No results
    answers: {}, // No answers
    totalDurationSec: 0, // Zero duration
    focusAreas: [], // No focus areas
  });
}

/**
 * Create progress metrics with edge case values
 */
export function createEdgeCaseProgressMetrics(): UserProgressMetrics {
  return createMockProgressMetrics({
    totalSessions: 0,
    totalCorrectAnswers: 0,
    totalQuestions: 0,
    averageAccuracy: 0,
    totalListeningMinutes: 0,
    currentStreakDays: 0,
    longestStreakDays: 0,
    lastPracticedAt: null,
    weeklyTrend: [],
  });
}

/**
 * Create an exercise with very long content for testing performance
 */
export function createLargeExercise(): Exercise {
  const longTranscript = 'This is a very long transcript. '.repeat(1000);
  const manyQuestions = Array.from({ length: 50 }, (_, i) => 
    createMockQuestion({ question: `Question ${i + 1}?` })
  );
  
  return createMockExercise({
    id: 'large-exercise',
    transcript: longTranscript,
    questions: manyQuestions,
    results: manyQuestions.map((_, i) => createMockGradingResult({ question_id: i })),
    totalDurationSec: 3600, // 1 hour
  });
}