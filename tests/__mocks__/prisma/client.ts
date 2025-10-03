import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  createMockExercise,
  createMockPracticeSession,
  createMockWrongAnswer,
} from '../../helpers/mock-utils';

// =============== Mock Data Generators ===============

const generateMockUser = (overrides: any = {}) => ({
  id: `user-${Math.random().toString(36).substr(2, 9)}`,
  email: 'test@example.com',
  password: '$2b$10$hashedpassword',
  name: 'Test User',
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const generateMockPracticeSession = (overrides: any = {}) => ({
  id: `session-${Math.random().toString(36).substr(2, 9)}`,
  userId: 'test-user-id',
  exerciseData: JSON.stringify(createMockExercise()),
  difficulty: 'B1',
  language: 'en-US',
  topic: 'Technology',
  transcript: 'Sample transcript for testing purposes.',
  accuracy: 0.85,
  score: 85,
  duration: 180,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const generateMockPracticeQuestion = (overrides: any = {}) => ({
  id: `question-${Math.random().toString(36).substr(2, 9)}`,
  sessionId: 'test-session-id',
  index: 0,
  type: 'multiple_choice',
  question: 'What is the main topic?',
  options: JSON.stringify(['Option A', 'Option B', 'Option C', 'Option D']),
  correctAnswer: 'Option A',
  explanation: 'This is the correct answer because...',
  transcriptSnapshot: 'Relevant transcript snippet',
  focusAreas: JSON.stringify(['main-idea']),
  createdAt: new Date(),
  ...overrides,
});

const generateMockPracticeAnswer = (overrides: any = {}) => ({
  id: `answer-${Math.random().toString(36).substr(2, 9)}`,
  questionId: 'test-question-id',
  userAnswer: 'Option A',
  isCorrect: true,
  attemptedAt: new Date(),
  aiAnalysis: null,
  aiAnalysisGeneratedAt: null,
  tags: '[]',
  needsAnalysis: false,
  ...overrides,
});

// =============== Mock Prisma Client ===============

export const mockPrisma = {
  // User operations
  user: {
    create: vi.fn().mockImplementation(({ data }) => 
      Promise.resolve(generateMockUser(data))
    ),
    findUnique: vi.fn().mockImplementation(({ where }) => {
      if (where.email === 'nonexistent@example.com') {
        return Promise.resolve(null);
      }
      return Promise.resolve(generateMockUser({ 
        id: where.id || 'test-user-id',
        email: where.email || 'test@example.com'
      }));
    }),
    findMany: vi.fn().mockImplementation(() => 
      Promise.resolve([generateMockUser(), generateMockUser()])
    ),
    update: vi.fn().mockImplementation(({ where, data }) => 
      Promise.resolve(generateMockUser({ ...data, id: where.id }))
    ),
    delete: vi.fn().mockImplementation(({ where }) => 
      Promise.resolve(generateMockUser({ id: where.id }))
    ),
    count: vi.fn().mockResolvedValue(10),
  },

  // Practice Session operations
  practiceSession: {
    create: vi.fn().mockImplementation(({ data }) => 
      Promise.resolve(generateMockPracticeSession(data))
    ),
    findUnique: vi.fn().mockImplementation(({ where }) => 
      Promise.resolve(generateMockPracticeSession({ id: where.id }))
    ),
    findMany: vi.fn().mockImplementation(({ where, orderBy, take, skip }) => {
      const sessions = Array.from({ length: take || 10 }, (_, i) => 
        generateMockPracticeSession({
          id: `session-${i}`,
          userId: where?.userId || 'test-user-id',
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        })
      );
      return Promise.resolve(sessions);
    }),
    update: vi.fn().mockImplementation(({ where, data }) => 
      Promise.resolve(generateMockPracticeSession({ ...data, id: where.id }))
    ),
    delete: vi.fn().mockImplementation(({ where }) => 
      Promise.resolve(generateMockPracticeSession({ id: where.id }))
    ),
    count: vi.fn().mockResolvedValue(25),
    aggregate: vi.fn().mockResolvedValue({
      _avg: { accuracy: 0.78, score: 78, duration: 165 },
      _sum: { duration: 4125 },
      _count: { id: 25 },
    }),
  },

  // Practice Question operations
  practiceQuestion: {
    create: vi.fn().mockImplementation(({ data }) => 
      Promise.resolve(generateMockPracticeQuestion(data))
    ),
    createMany: vi.fn().mockImplementation(({ data }) => 
      Promise.resolve({ count: data.length })
    ),
    findUnique: vi.fn().mockImplementation(({ where }) => 
      Promise.resolve(generateMockPracticeQuestion({ id: where.id }))
    ),
    findMany: vi.fn().mockImplementation(({ where }) => {
      const questions = Array.from({ length: 5 }, (_, i) => 
        generateMockPracticeQuestion({
          id: `question-${i}`,
          sessionId: where?.sessionId || 'test-session-id',
          index: i,
        })
      );
      return Promise.resolve(questions);
    }),
    update: vi.fn().mockImplementation(({ where, data }) => 
      Promise.resolve(generateMockPracticeQuestion({ ...data, id: where.id }))
    ),
    delete: vi.fn().mockImplementation(({ where }) => 
      Promise.resolve(generateMockPracticeQuestion({ id: where.id }))
    ),
    count: vi.fn().mockResolvedValue(125),
  },

  // Practice Answer operations
  practiceAnswer: {
    create: vi.fn().mockImplementation(({ data }) => 
      Promise.resolve(generateMockPracticeAnswer(data))
    ),
    createMany: vi.fn().mockImplementation(({ data }) => 
      Promise.resolve({ count: data.length })
    ),
    findUnique: vi.fn().mockImplementation(({ where }) => 
      Promise.resolve(generateMockPracticeAnswer({ id: where.id }))
    ),
    findMany: vi.fn().mockImplementation(({ where, orderBy, take, skip, include }) => {
      const answers = Array.from({ length: take || 10 }, (_, i) => {
        const answer = generateMockPracticeAnswer({
          id: `answer-${i}`,
          questionId: where?.questionId || 'test-question-id',
          isCorrect: where?.isCorrect !== undefined ? where.isCorrect : Math.random() > 0.3,
          needsAnalysis: where?.needsAnalysis !== undefined ? where.needsAnalysis : Math.random() > 0.7,
        });

        // Include related data if requested
        if (include?.question) {
          answer.question = generateMockPracticeQuestion({
            id: answer.questionId,
            session: include.question.session ? generateMockPracticeSession() : undefined,
          });
        }

        return answer;
      });
      return Promise.resolve(answers);
    }),
    update: vi.fn().mockImplementation(({ where, data }) => 
      Promise.resolve(generateMockPracticeAnswer({ ...data, id: where.id }))
    ),
    delete: vi.fn().mockImplementation(({ where }) => 
      Promise.resolve(generateMockPracticeAnswer({ id: where.id }))
    ),
    count: vi.fn().mockResolvedValue(500),
  },

  // Transaction support
  $transaction: vi.fn().mockImplementation(async (operations) => {
    if (Array.isArray(operations)) {
      return Promise.all(operations);
    }
    if (typeof operations === 'function') {
      return operations(mockPrisma);
    }
    return Promise.resolve(operations);
  }),

  // Connection management
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),

  // Raw queries (for complex operations)
  $queryRaw: vi.fn().mockResolvedValue([]),
  $executeRaw: vi.fn().mockResolvedValue(1),
} as unknown as PrismaClient;

// =============== Test Utilities ===============

/**
 * Reset all Prisma mocks to their default state
 */
export function resetPrismaMocks() {
  Object.values(mockPrisma).forEach(model => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach(method => {
        if (vi.isMockFunction(method)) {
          method.mockClear();
        }
      });
    }
  });
}

/**
 * Mock a specific Prisma operation to return custom data
 */
export function mockPrismaOperation(
  model: keyof typeof mockPrisma,
  operation: string,
  returnValue: any
) {
  const modelMock = mockPrisma[model] as any;
  if (modelMock && modelMock[operation]) {
    modelMock[operation].mockResolvedValue(returnValue);
  }
}

/**
 * Mock a Prisma operation to throw an error
 */
export function mockPrismaError(
  model: keyof typeof mockPrisma,
  operation: string,
  error: Error
) {
  const modelMock = mockPrisma[model] as any;
  if (modelMock && modelMock[operation]) {
    modelMock[operation].mockRejectedValue(error);
  }
}

/**
 * Create mock data for a complete practice session with questions and answers
 */
export function createMockSessionWithQuestionsAndAnswers(sessionOverrides: any = {}) {
  const session = generateMockPracticeSession(sessionOverrides);
  const questions = Array.from({ length: 3 }, (_, i) => 
    generateMockPracticeQuestion({
      sessionId: session.id,
      index: i,
    })
  );
  const answers = questions.map(question => 
    generateMockPracticeAnswer({
      questionId: question.id,
      isCorrect: Math.random() > 0.3,
    })
  );

  return { session, questions, answers };
}

/**
 * Mock user authentication scenarios
 */
export function mockAuthScenarios() {
  // Mock successful login
  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.email === 'valid@example.com') {
      return Promise.resolve(generateMockUser({
        email: 'valid@example.com',
        password: '$2b$10$validhashedpassword',
      }));
    }
    if (where.email === 'admin@example.com') {
      return Promise.resolve(generateMockUser({
        email: 'admin@example.com',
        isAdmin: true,
      }));
    }
    return Promise.resolve(null);
  });
}

/**
 * Mock database connection errors
 */
export function mockDatabaseError() {
  const error = new Error('Database connection failed');
  Object.values(mockPrisma).forEach(model => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach(method => {
        if (vi.isMockFunction(method)) {
          method.mockRejectedValue(error);
        }
      });
    }
  });
}

/**
 * Setup Prisma mocks for tests
 */
export function setupPrismaMocks() {
  beforeEach(() => {
    resetPrismaMocks();
  });
}

// Export the mock as default for module replacement
export default mockPrisma;