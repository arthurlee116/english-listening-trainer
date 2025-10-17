import { describe, expect, it } from 'vitest'
import { createStructuredJsonParser } from '@/lib/ai/parsers'

describe('createStructuredJsonParser', () => {
  it('parses valid JSON strings', () => {
    const parser = createStructuredJsonParser<{ value: number }>('test_schema')
    expect(parser('{"value":42}')).toEqual({ value: 42 })
  })

  it('throws descriptive error when payload is not a string', () => {
    const parser = createStructuredJsonParser('schema_non_string')
    expect(() => parser({ invalid: true })).toThrow(
      /expected string payload but received object/i
    )
  })

  it('includes preview when JSON parsing fails', () => {
    const parser = createStructuredJsonParser('schema_invalid_json')
    expect(() => parser('{"value":')).toThrow(
      /Failed to parse structured response \(schema_invalid_json\): .*Payload preview: \{"value":/i
    )
  })
})
