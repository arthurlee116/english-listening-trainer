export class FetchTimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message)
    this.name = 'FetchTimeoutError'
  }
}

export type FetchWithTimeoutOptions = RequestInit & {
  timeoutMs?: number
}

function mergeAbortSignals(
  primary: AbortSignal | null | undefined,
  secondary: AbortSignal | null | undefined
): { signal: AbortSignal | undefined; cleanup: () => void } {
  if (!primary && !secondary) {
    return { signal: undefined, cleanup: () => {} }
  }

  if (primary && !secondary) {
    return { signal: primary, cleanup: () => {} }
  }

  if (!primary && secondary) {
    return { signal: secondary, cleanup: () => {} }
  }

  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
    return {
      signal: (AbortSignal as typeof AbortSignal & { any: (signals: AbortSignal[]) => AbortSignal }).any([
        primary as AbortSignal,
        secondary as AbortSignal,
      ]),
      cleanup: () => {},
    }
  }

  const controller = new AbortController()
  const onPrimaryAbort = () => controller.abort(primary?.reason ?? new Error('aborted'))
  const onSecondaryAbort = () => controller.abort(secondary?.reason ?? new Error('aborted'))

  primary!.addEventListener('abort', onPrimaryAbort, { once: true })
  secondary!.addEventListener('abort', onSecondaryAbort, { once: true })

  return {
    signal: controller.signal,
    cleanup: () => {
      primary!.removeEventListener('abort', onPrimaryAbort)
      secondary!.removeEventListener('abort', onSecondaryAbort)
    },
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = 0, signal, ...rest } = init

  if (!timeoutMs || timeoutMs <= 0) {
    return fetch(input, { ...rest, signal })
  }

  const timeoutController = new AbortController()
  let timedOut = false

  const timeoutId = setTimeout(() => {
    timedOut = true
    timeoutController.abort()
  }, timeoutMs)

  const merged = mergeAbortSignals(signal ?? null, timeoutController.signal)

  try {
    return await fetch(input, { ...rest, signal: merged.signal })
  } catch (error) {
    if (timedOut) {
      throw new FetchTimeoutError('Request timed out', timeoutMs)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    merged.cleanup()
  }
}

export function isFetchTimeoutError(error: unknown): boolean {
  return error instanceof FetchTimeoutError
}
