import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { mockPrisma } from '../__mocks__/prisma/client';

// =============== Database Dependency Injection ===============

/**
 * Database context for dependency injection in tests
 */
interface DatabaseContext {
  prisma: PrismaClient;
}

let currentDatabaseContext: DatabaseContext | null = null;

/**
 * Set the database context for tests
 */
export function setDatabaseContext(context: DatabaseContext) {
  currentDatabaseContext = context;
}

/**
 * Get the current database context (returns mock by default in tests)
 */
export function getDatabaseContext(): DatabaseContext {
  if (currentDatabaseContext) {
    return currentDatabaseContext;
  }
  
  // Return mock context by default in test environment
  return {
    prisma: mockPrisma as PrismaClient,
  };
}

/**
 * Reset database context to default (mock)
 */
export function resetDatabaseContext() {
  currentDatabaseContext = null;
}

/**
 * Create a database service factory that uses dependency injection
 */
export function createDatabaseService<T>(
  serviceFactory: (prisma: PrismaClient) => T
): () => T {
  return () => {
    const { prisma } = getDatabaseContext();
    return serviceFactory(prisma);
  };
}

// =============== Mock Database Services ===============

/**
 * Mock practice session service with dependency injection
 */
export const createMockPracticeSessionService = createDatabaseService((prisma) => ({
  async createSession(data: any) {
    return prisma.practiceSession.create({ data });
  },

  async getSessionById(id: string) {
    return prisma.practiceSession.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            answers: true,
          },
        },
      },
    });
  },

  async getUserSessions(userId: string, limit: number = 10) {
    return prisma.practiceSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        questions: {
          include: {
            answers: true,
          },
        },
      },
    });
  },

  async updateSession(id: string, data: any) {
    return prisma.practiceSession.update({
      where: { id },
      data,
    });
  },

  async deleteSession(id: string) {
    return prisma.practiceSession.delete({
      where: { id },
    });
  },

  async getSessionStats(userId: string) {
    return prisma.practiceSession.aggregate({
      where: { userId },
      _avg: {
        accuracy: true,
        score: true,
        duration: true,
      },
      _sum: {
        duration: true,
      },
      _count: {
        id: true,
      },
    });
  },
}));

/**
 * Mock wrong answers service with dependency injection
 */
export const createMockWrongAnswersService = createDatabaseService((prisma) => ({
  async getWrongAnswers(userId: string, filters: any = {}) {
    const where: any = {
      question: {
        session: {
          userId,
        },
      },
      isCorrect: false,
    };

    if (filters.difficulty) {
      where.question.session.difficulty = filters.difficulty;
    }

    if (filters.language) {
      where.question.session.language = filters.language;
    }

    if (filters.needsAnalysis !== undefined) {
      where.needsAnalysis = filters.needsAnalysis;
    }

    return prisma.practiceAnswer.findMany({
      where,
      include: {
        question: {
          include: {
            session: true,
          },
        },
      },
      orderBy: {
        attemptedAt: 'desc',
      },
      take: filters.limit || 20,
      skip: filters.offset || 0,
    });
  },

  async updateAnswerAnalysis(answerId: string, analysis: any) {
    return prisma.practiceAnswer.update({
      where: { id: answerId },
      data: {
        aiAnalysis: JSON.stringify(analysis),
        aiAnalysisGeneratedAt: new Date(),
        needsAnalysis: false,
      },
    });
  },

  async markAnswerForAnalysis(answerId: string) {
    return prisma.practiceAnswer.update({
      where: { id: answerId },
      data: {
        needsAnalysis: true,
      },
    });
  },

  async getAnswersNeedingAnalysis(limit: number = 10) {
    return prisma.practiceAnswer.findMany({
      where: {
        needsAnalysis: true,
        isCorrect: false,
      },
      include: {
        question: {
          include: {
            session: true,
          },
        },
      },
      orderBy: {
        attemptedAt: 'desc',
      },
      take: limit,
    });
  },
}));

/**
 * Mock user service with dependency injection
 */
export const createMockUserService = createDatabaseService((prisma) => ({
  async createUser(data: any) {
    return prisma.user.create({ data });
  },

  async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  async updateUser(id: string, data: any) {
    return prisma.user.update({
      where: { id },
      data,
    });
  },

  async deleteUser(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  },

  async getUserStats(userId: string) {
    const sessionCount = await prisma.practiceSession.count({
      where: { userId },
    });

    const sessionStats = await prisma.practiceSession.aggregate({
      where: { userId },
      _avg: {
        accuracy: true,
        duration: true,
      },
      _sum: {
        duration: true,
      },
    });

    return {
      totalSessions: sessionCount,
      averageAccuracy: sessionStats._avg.accuracy || 0,
      totalDuration: sessionStats._sum.duration || 0,
      averageDuration: sessionStats._avg.duration || 0,
    };
  },
}));

// =============== Test Utilities ===============

/**
 * Setup database dependency injection for tests
 */
export function setupDatabaseInjection() {
  beforeEach(() => {
    // Reset to mock database context
    resetDatabaseContext();
  });

  afterEach(() => {
    // Clean up any custom contexts
    resetDatabaseContext();
  });
}

/**
 * Create a test with custom database context
 */
export function withDatabaseContext<T>(
  context: DatabaseContext,
  testFn: () => T | Promise<T>
): () => Promise<T> {
  return async () => {
    const originalContext = currentDatabaseContext;
    setDatabaseContext(context);
    
    try {
      return await testFn();
    } finally {
      currentDatabaseContext = originalContext;
    }
  };
}

/**
 * Create a test with mock database that throws errors
 */
export function withDatabaseError<T>(
  error: Error,
  testFn: () => T | Promise<T>
): () => Promise<T> {
  return withDatabaseContext(
    {
      prisma: createErrorThrowingPrisma(error),
    },
    testFn
  );
}

/**
 * Create a Prisma client that throws errors for all operations
 */
function createErrorThrowingPrisma(error: Error): PrismaClient {
  const throwError = () => Promise.reject(error);
  
  return {
    user: {
      create: throwError,
      findUnique: throwError,
      findMany: throwError,
      update: throwError,
      delete: throwError,
      count: throwError,
    },
    practiceSession: {
      create: throwError,
      findUnique: throwError,
      findMany: throwError,
      update: throwError,
      delete: throwError,
      count: throwError,
      aggregate: throwError,
    },
    practiceQuestion: {
      create: throwError,
      createMany: throwError,
      findUnique: throwError,
      findMany: throwError,
      update: throwError,
      delete: throwError,
      count: throwError,
    },
    practiceAnswer: {
      create: throwError,
      createMany: throwError,
      findUnique: throwError,
      findMany: throwError,
      update: throwError,
      delete: throwError,
      count: throwError,
    },
    $transaction: throwError,
    $connect: throwError,
    $disconnect: throwError,
    $queryRaw: throwError,
    $executeRaw: throwError,
  } as unknown as PrismaClient;
}

/**
 * Mock database operations with realistic delays
 */
export function withDatabaseDelay<T>(
  delay: number,
  testFn: () => T | Promise<T>
): () => Promise<T> {
  const delayedPrisma = createDelayedPrisma(delay);
  
  return withDatabaseContext(
    { prisma: delayedPrisma },
    testFn
  );
}

/**
 * Create a Prisma client with artificial delays
 */
function createDelayedPrisma(delay: number): PrismaClient {
  const addDelay = <T>(operation: () => Promise<T>) => 
    new Promise<T>((resolve, reject) => {
      setTimeout(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });

  // Wrap all mock operations with delay
  const delayedMock = { ...mockPrisma };
  
  Object.keys(delayedMock).forEach(modelKey => {
    const model = delayedMock[modelKey as keyof typeof delayedMock] as any;
    if (typeof model === 'object' && model !== null) {
      Object.keys(model).forEach(operationKey => {
        const operation = model[operationKey];
        if (vi.isMockFunction(operation)) {
          model[operationKey] = vi.fn().mockImplementation((...args) => 
            addDelay(() => operation(...args))
          );
        }
      });
    }
  });

  return delayedMock as unknown as PrismaClient;
}