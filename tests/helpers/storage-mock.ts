import { vi } from 'vitest';

/**
 * Mock Storage implementation that fully implements the Storage interface
 * with event simulation for testing cross-tab communication and storage events
 */
export class MockStorage implements Storage {
  private store: Map<string, string> = new Map();
  private eventListeners: Array<(event: StorageEvent) => void> = [];

  constructor(initialData: Record<string, string> = {}) {
    // Initialize with provided data
    Object.entries(initialData).forEach(([key, value]) => {
      this.store.set(key, value);
    });
  }

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    const oldStore = new Map(this.store);
    this.store.clear();
    
    // Emit storage events for each cleared item
    oldStore.forEach((oldValue, key) => {
      this.emitStorageEvent(key, null, oldValue);
    });
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    const oldValue = this.store.get(key);
    const wasDeleted = this.store.delete(key);
    
    if (wasDeleted && oldValue !== undefined) {
      this.emitStorageEvent(key, null, oldValue);
    }
  }

  setItem(key: string, value: string): void {
    const oldValue = this.store.get(key);
    this.store.set(key, value);
    
    // Emit storage event if value changed
    if (oldValue !== value) {
      this.emitStorageEvent(key, value, oldValue ?? null);
    }
  }

  /**
   * Emit a storage event to simulate cross-tab communication
   */
  private emitStorageEvent(key: string, newValue: string | null, oldValue: string | null): void {
    // Create a custom event object that matches StorageEvent interface
    const event = {
      type: 'storage',
      key,
      newValue,
      oldValue,
      storageArea: window.localStorage, // Use the actual localStorage for compatibility
      url: 'http://localhost:3000',
      bubbles: false,
      cancelable: false,
      composed: false,
      currentTarget: null,
      defaultPrevented: false,
      eventPhase: 0,
      isTrusted: false,
      target: null,
      timeStamp: Date.now(),
      preventDefault: () => {},
      stopImmediatePropagation: () => {},
      stopPropagation: () => {},
    } as StorageEvent;

    // Notify all registered listeners
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in storage event listener:', error);
      }
    });

    // Also dispatch to window if available (for integration tests)
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      try {
        // Try to create a proper StorageEvent, fall back to custom event if it fails
        const properEvent = new StorageEvent('storage', {
          key,
          newValue,
          oldValue,
          storageArea: window.localStorage,
          url: 'http://localhost:3000',
        });
        window.dispatchEvent(properEvent);
      } catch {
        // Fallback for environments where StorageEvent constructor is strict
        window.dispatchEvent(new CustomEvent('storage', { detail: event }));
      }
    }
  }

  /**
   * Add a storage event listener (for testing purposes)
   */
  addEventListener(listener: (event: StorageEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove a storage event listener
   */
  removeEventListener(listener: (event: StorageEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Simulate a storage event from another tab/window
   */
  simulateExternalChange(key: string, newValue: string | null, oldValue: string | null = null): void {
    // Don't update the actual storage, just emit the event
    this.emitStorageEvent(key, newValue, oldValue);
  }

  /**
   * Get all stored data as a plain object (for testing/debugging)
   */
  getAllData(): Record<string, string> {
    const result: Record<string, string> = {};
    this.store.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Reset the storage to initial state
   */
  reset(initialData: Record<string, string> = {}): void {
    this.clear();
    Object.entries(initialData).forEach(([key, value]) => {
      this.setItem(key, value);
    });
  }

  /**
   * Check if storage contains a specific key
   */
  hasKey(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Get all keys as an array
   */
  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Simulate storage quota exceeded error
   */
  simulateQuotaExceeded(): void {
    const originalSetItem = this.setItem.bind(this);
    this.setItem = () => {
      throw new DOMException('QuotaExceededError', 'The quota has been exceeded.');
    };
    
    // Restore original method after a short delay
    setTimeout(() => {
      this.setItem = originalSetItem;
    }, 100);
  }
}

/**
 * Create and install mock storage for localStorage and sessionStorage
 */
export function mockStorage(
  localStorageData: Record<string, string> = {},
  sessionStorageData: Record<string, string> = {}
): { localStorage: MockStorage; sessionStorage: MockStorage } {
  const mockLocalStorage = new MockStorage(localStorageData);
  const mockSessionStorage = new MockStorage(sessionStorageData);

  // Replace global storage objects
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
  });

  return {
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
  };
}

/**
 * Create a mock storage with realistic test data
 */
export function mockStorageWithTestData(): { localStorage: MockStorage; sessionStorage: MockStorage } {
  const testLocalStorageData = {
    'english-listening-history': JSON.stringify([
      {
        id: 'test-exercise-1',
        difficulty: 'B1',
        language: 'en-US',
        topic: 'Technology',
        createdAt: new Date().toISOString(),
      }
    ]),
    'english-listening-progress': JSON.stringify({
      totalSessions: 5,
      totalCorrectAnswers: 20,
      totalQuestions: 25,
      averageAccuracy: 80,
      totalListeningMinutes: 15,
      currentStreakDays: 2,
      longestStreakDays: 5,
      lastPracticedAt: new Date().toISOString(),
      weeklyTrend: []
    }),
    'english-listening-achievements': JSON.stringify([
      {
        id: 'first-session',
        titleKey: 'achievements.firstSession.title',
        descriptionKey: 'achievements.firstSession.desc',
        earnedAt: new Date().toISOString(),
        conditions: { type: 'sessions', threshold: 1 }
      }
    ]),
    'hotkeys-enabled': 'true',
    'theme': 'light',
  };

  const testSessionStorageData = {
    'current-exercise-id': 'test-exercise-1',
    'temp-answers': JSON.stringify({ 0: 'Test answer' }),
  };

  return mockStorage(testLocalStorageData, testSessionStorageData);
}

/**
 * Restore original storage implementations
 */
export function restoreStorage(): void {
  // Create new instances of the original Storage implementation
  const originalLocalStorage = (() => {
    const storage: Record<string, string> = {};
    return {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach(key => delete storage[key]); },
      get length() { return Object.keys(storage).length; },
      key: (index: number) => Object.keys(storage)[index] || null,
    };
  })();

  const originalSessionStorage = (() => {
    const storage: Record<string, string> = {};
    return {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach(key => delete storage[key]); },
      get length() { return Object.keys(storage).length; },
      key: (index: number) => Object.keys(storage)[index] || null,
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: originalLocalStorage,
    writable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: originalSessionStorage,
    writable: true,
  });
}

/**
 * Vitest helper to automatically mock storage in tests
 */
export function setupStorageMock() {
  beforeEach(() => {
    mockStorage();
  });

  afterEach(() => {
    // Clear storage after each test
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

/**
 * Create a storage event for testing cross-tab communication
 */
export function createMockStorageEvent(
  key: string,
  newValue: string | null,
  oldValue: string | null = null,
  storageArea: Storage = window.localStorage
): StorageEvent {
  try {
    return new StorageEvent('storage', {
      key,
      newValue,
      oldValue,
      storageArea,
      url: window.location?.href || 'http://localhost:3000',
    });
  } catch {
    // Fallback for strict environments
    return {
      type: 'storage',
      key,
      newValue,
      oldValue,
      storageArea,
      url: window.location?.href || 'http://localhost:3000',
      bubbles: false,
      cancelable: false,
      composed: false,
      currentTarget: null,
      defaultPrevented: false,
      eventPhase: 0,
      isTrusted: false,
      target: null,
      timeStamp: Date.now(),
      preventDefault: () => {},
      stopImmediatePropagation: () => {},
      stopPropagation: () => {},
    } as StorageEvent;
  }
}