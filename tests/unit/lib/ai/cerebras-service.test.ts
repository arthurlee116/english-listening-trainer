import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { ArkMessage } from '@/lib/ark-helper'
import { callArkAPI } from '@/lib/ark-helper'
import { invokeStructured } from '@/lib/ai/cerebras-service'
import { topicsSchema } from '@/lib/ai/schemas'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/ark-helper', () => ({
  callArkAPI: vi.fn()
}))

const callArkAPIMock = callArkAPI as unknown as Mock<[Record<string, any>], Promise<unknown>>

const baseMessages: ArkMessage[] = [{ role: 'user', content: 'ping' }]

describe('invokeStructured', () => {
  beforeEach(() => {
    callArkAPIMock.mockReset()
  })

  it('forwards structured metadata and overrides to callArkAPI', async () => {
    callArkAPIMock.mockImplementation(async (options) => {
      expect(options.responseFormat).toEqual({
        type: 'json_schema',
        json_schema: {
          name: 'topics_test',
          strict: true,
          schema: topicsSchema
        }
      })
      expect(options.schemaName).toBe('topics_test')
      expect(options.label).toBe('topics_test')
      expect(options.temperature).toBe(0.55)
      expect(options.maxTokens).toBe(256)
      return { topics: ['A', 'B'] }
    })

    const result = await invokeStructured({
      messages: baseMessages,
      schema: topicsSchema,
      schemaName: 'topics_test',
      options: {
        temperature: 0.55,
        maxTokens: 256
      }
    })

    expect(result).toEqual({ topics: ['A', 'B'] })
    expect(callArkAPIMock).toHaveBeenCalledTimes(1)
  })

  it('propagates callArkAPI failures', async () => {
    callArkAPIMock.mockRejectedValue(new Error('callArk failed'))

    await expect(
      invokeStructured({
        messages: baseMessages,
        schema: topicsSchema,
        schemaName: 'topics_failure'
      })
    ).rejects.toThrow('callArk failed')
  })
})
