import 'server-only'

const PREVIEW_LENGTH = 200

function stringifyPreview(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload.length > PREVIEW_LENGTH
      ? `${payload.slice(0, PREVIEW_LENGTH)}...`
      : payload
  }

  try {
    const serialized = JSON.stringify(payload)
    return serialized.length > PREVIEW_LENGTH
      ? `${serialized.slice(0, PREVIEW_LENGTH)}...`
      : serialized
  } catch {
    return '[unserializable payload]'
  }
}

export function createStructuredJsonParser<T>(schemaName: string): (payload: unknown) => T {
  return (payload: unknown): T => {
    if (typeof payload !== 'string') {
      const preview = stringifyPreview(payload)
      throw new Error(
        `Failed to parse structured response (${schemaName}): expected string payload but received ${typeof payload}. Payload preview: ${preview}`
      )
    }

    try {
      return JSON.parse(payload) as T
    } catch (error) {
      const preview = stringifyPreview(payload)
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Failed to parse structured response (${schemaName}): ${reason}. Payload preview: ${preview}`
      )
    }
  }
}
