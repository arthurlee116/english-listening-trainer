import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('monitoring uncaughtException handling', () => {
  it('calls process.exit(1) after logging uncaught exceptions', async () => {
    vi.resetModules()
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

    const before = process.listeners('uncaughtException')
    await import('@/lib/monitoring')
    const after = process.listeners('uncaughtException')
    const handler = after.find(listener => !before.includes(listener))

    expect(handler).toBeTypeOf('function')
    ;(handler as (err: Error) => void)(new Error('boom'))

    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })
})
