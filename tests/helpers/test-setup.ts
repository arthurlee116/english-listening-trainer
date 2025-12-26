import '@testing-library/jest-dom'

// Provide a stable mock date where tests need deterministic timestamps
const now = new Date('2024-01-01T00:00:00.000Z')
vi.setSystemTime(now)

afterAll(() => {
  vi.useRealTimers()
})
