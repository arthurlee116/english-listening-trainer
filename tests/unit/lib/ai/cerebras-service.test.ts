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

  it('builds structured request payload and returns parsed result', async () => {
    callArkAPIMock.mockImplementation(async (options) => {
      expect(options.responseFormat).toEqual({
        type: 'json_schema',
        json_schema: {
          name: 'topics_test',
          strict: true,
          schema: topicsSchema
        }
      })
      expect(options.temperature).toBe(0.55)
      expect(options.maxTokens).toBe(256)
      return options.parser('{"topics":["A","B"]}')
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

  it('throws enriched error when parser fails to decode JSON', async () => {
    callArkAPIMock.mockImplementation(async (options) => {
      return options.parser('not json')
    })

    await expect(
      invokeStructured({
        messages: baseMessages,
        schema: topicsSchema,
        schemaName: 'topics_health'
      })
    ).rejects.toThrow(/Failed to parse structured response \(topics_health\)/)
  })
})
