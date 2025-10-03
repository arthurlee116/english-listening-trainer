import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createMockExercise, 
  createMockPracticeSession, 
  createMockAchievement,
  createMockProgressMetrics,
  createMockExerciseSet,
} from '../../helpers/mock-utils';
import { MockStorage, mockStorage } from '../../helpers/storage-mock';
import { mockPrisma, resetPrismaMocks } from '../../__mocks__/prisma/client';

describe('Test Utilities Verification', () => {
  describe('Mock Utils', () => {
    it('should create valid mock exercise', () => {
      const exercise = createMockExercise();
      
      expect(exercise).toHaveProperty('id');
      expect(exercise).toHaveProperty('difficulty');
      expect(exercise).toHaveProperty('language');
      expect(exercise).toHaveProperty('topic');
      expect(exercise).toHaveProperty('transcript');
      expect(exercise).toHaveProperty('questions');
      expect(exercise).toHaveProperty('results');
      expect(exercise.questions).toHaveLength(2);
      expect(exercise.results).toHaveLength(2);
    });

    it('should create mock exercise with overrides', () => {
      const exercise = createMockExercise({
        difficulty: 'C2',
        topic: 'Custom Topic',
        specializedMode: true,
      });
      
      expect(exercise.difficulty).toBe('C2');
      expect(exercise.topic).toBe('Custom Topic');
      expect(exercise.specializedMode).toBe(true);
    });

    it('should create valid mock practice session', () => {
      const session = createMockPracticeSession();
      
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('accuracy');
      expect(session).toHaveProperty('duration');
      expect(session.accuracy).toBeGreaterThanOrEqual(0);
      expect(session.accuracy).toBeLessThanOrEqual(100);
    });

    it('should create valid mock achievement', () => {
      const achievement = createMockAchievement();
      
      expect(achievement).toHaveProperty('id');
      expect(achievement).toHaveProperty('titleKey');
      expect(achievement).toHaveProperty('conditions');
      expect(achievement.earnedAt).toBeUndefined();
    });

    it('should create mock exercise set with different characteristics', () => {
      const exercises = createMockExerciseSet(3);
      
      expect(exercises).toHaveLength(3);
      exercises.forEach((exercise, index) => {
        expect(exercise.id).toBe(`exercise-set-${index}`);
      });
    });
  });

  describe('Storage Mock', () => {
    let storage: MockStorage;

    beforeEach(() => {
      storage = new MockStorage();
    });

    it('should implement Storage interface correctly', () => {
      expect(storage.length).toBe(0);
      
      storage.setItem('test', 'value');
      expect(storage.length).toBe(1);
      expect(storage.getItem('test')).toBe('value');
      
      storage.removeItem('test');
      expect(storage.length).toBe(0);
      expect(storage.getItem('test')).toBeNull();
    });

    it('should emit storage events', () => {
      const events: StorageEvent[] = [];
      storage.addEventListener((event) => {
        events.push(event);
      });

      storage.setItem('test', 'value');
      expect(events).toHaveLength(1);
      expect(events[0].key).toBe('test');
      expect(events[0].newValue).toBe('value');
    });

    it('should simulate external storage changes', () => {
      const events: StorageEvent[] = [];
      storage.addEventListener((event) => {
        events.push(event);
      });

      storage.simulateExternalChange('external', 'new-value', 'old-value');
      expect(events).toHaveLength(1);
      expect(events[0].key).toBe('external');
      expect(events[0].newValue).toBe('new-value');
      expect(events[0].oldValue).toBe('old-value');
    });

    it('should initialize with provided data', () => {
      const initialData = { key1: 'value1', key2: 'value2' };
      const storageWithData = new MockStorage(initialData);
      
      expect(storageWithData.length).toBe(2);
      expect(storageWithData.getItem('key1')).toBe('value1');
      expect(storageWithData.getItem('key2')).toBe('value2');
    });
  });

  describe('Prisma Mock', () => {
    beforeEach(() => {
      resetPrismaMocks();
    });

    it('should mock user operations', async () => {
      const userData = { email: 'test@example.com', password: 'hashed' };
      const user = await mockPrisma.user.create({ data: userData });
      
      expect(user).toHaveProperty('id');
      expect(user.email).toBe('test@example.com');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({ data: userData });
    });

    it('should mock practice session operations', async () => {
      const sessionData = { userId: 'test-user', topic: 'Test Topic' };
      const session = await mockPrisma.practiceSession.create({ data: sessionData });
      
      expect(session).toHaveProperty('id');
      expect(session.topic).toBe('Test Topic');
      expect(mockPrisma.practiceSession.create).toHaveBeenCalledWith({ data: sessionData });
    });

    it('should mock findMany operations with filters', async () => {
      const sessions = await mockPrisma.practiceSession.findMany({
        where: { userId: 'test-user' },
        take: 5,
      });
      
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeLessThanOrEqual(5);
      expect(mockPrisma.practiceSession.findMany).toHaveBeenCalled();
    });

    it('should mock transaction operations', async () => {
      const operations = [
        mockPrisma.user.create({ data: { email: 'test@example.com', password: 'hash' } }),
        mockPrisma.practiceSession.create({ data: { userId: 'test-user', topic: 'Test' } }),
      ];
      
      const results = await mockPrisma.$transaction(operations);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });
  });

  describe('Global Storage Mock Setup', () => {
    it('should replace window.localStorage and sessionStorage', () => {
      const { localStorage: mockLocal, sessionStorage: mockSession } = mockStorage(
        { local: 'data' },
        { session: 'data' }
      );
      
      expect(window.localStorage).toBe(mockLocal);
      expect(window.sessionStorage).toBe(mockSession);
      expect(window.localStorage.getItem('local')).toBe('data');
      expect(window.sessionStorage.getItem('session')).toBe('data');
    });
  });
});