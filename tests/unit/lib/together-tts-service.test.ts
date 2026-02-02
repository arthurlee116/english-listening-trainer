import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'events'

function makeWavBuffer(): Buffer {
  const buffer = Buffer.alloc(44, 0)
  buffer.write('RIFF', 0, 'ascii')
  buffer.write('WAVE', 8, 'ascii')
  return buffer
}

describe('together-tts-service', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    vi.doMock('server-only', () => ({}))
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('uses a proxy agent when TOGETHER_PROXY_URL is set and writes to public/audio', async () => {
    process.env.TOGETHER_API_KEY = 'test-key'
    process.env.TOGETHER_BASE_URL = 'https://api.together.xyz/v1'
    process.env.TOGETHER_TTS_MODEL = 'hexgrad/Kokoro-82M'
    process.env.TOGETHER_PROXY_URL = 'http://127.0.0.1:10808'

    const agentInstance = { kind: 'proxy-agent' }
    const HttpsProxyAgent = vi.fn().mockImplementation(() => agentInstance)
    vi.doMock('https-proxy-agent', () => ({ HttpsProxyAgent }))

    const wav = makeWavBuffer()
    const request = vi.fn((options: any, cb: (res: any) => void) => {
      const req = new EventEmitter() as any
      req.setTimeout = vi.fn()
      req.end = (_body: string) => {
        const res = new EventEmitter() as any
        res.statusCode = 200
        res.statusMessage = 'OK'
        res.headers = { 'content-type': 'audio/wav' }
        cb(res)
        queueMicrotask(() => {
          res.emit('data', wav)
          res.emit('end')
        })
      }
      return req
    })
    vi.doMock('https', () => ({ default: { request } }))

    const mkdir = vi.fn().mockResolvedValue(undefined)
    const writeFile = vi.fn().mockResolvedValue(undefined)
    const unlink = vi.fn().mockResolvedValue(undefined)
    vi.doMock('fs', () => ({
      default: { promises: { mkdir, writeFile, unlink } }
    }))

    const randomBytes = vi.fn().mockReturnValue(Buffer.from('abcdefabcdef', 'hex'))
    vi.doMock('crypto', () => ({ default: { randomBytes } }))

    const { generateTogetherTtsAudio } = await import('@/lib/together-tts-service')
    const result = await generateTogetherTtsAudio({ text: 'hello', voice: 'af_alloy', timeoutMs: 1000 })

    expect(HttpsProxyAgent).toHaveBeenCalledWith('http://127.0.0.1:10808')
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        agent: agentInstance,
        hostname: 'api.together.xyz',
        path: '/v1/audio/speech',
      })
    )

    expect(result.filename).toMatch(/^tts_audio_\d+_abcdefabcdef\.wav$/)
    expect(result.filePath).toMatch(/public[\/\\]audio[\/\\]tts_audio_/)
    expect(writeFile).toHaveBeenCalledTimes(1)
  })

  it('rejects non-wav content-type even if bytes look like wav', async () => {
    process.env.TOGETHER_API_KEY = 'test-key'

    vi.doMock('https-proxy-agent', () => ({ HttpsProxyAgent: vi.fn().mockImplementation(() => ({})) }))
    const wav = makeWavBuffer()
    const request = vi.fn((_options: any, cb: (res: any) => void) => {
      const req = new EventEmitter() as any
      req.setTimeout = vi.fn()
      req.end = () => {
        const res = new EventEmitter() as any
        res.statusCode = 200
        res.statusMessage = 'OK'
        res.headers = { 'content-type': 'text/plain' }
        cb(res)
        queueMicrotask(() => {
          res.emit('data', wav)
          res.emit('end')
        })
      }
      return req
    })
    vi.doMock('https', () => ({ default: { request } }))

    vi.doMock('fs', () => ({
      default: { promises: { mkdir: vi.fn(), writeFile: vi.fn(), unlink: vi.fn() } }
    }))
    vi.doMock('crypto', () => ({ default: { randomBytes: vi.fn().mockReturnValue(Buffer.from('abcdefabcdef', 'hex')) } }))

    const { generateTogetherTtsAudio } = await import('@/lib/together-tts-service')

    await expect(generateTogetherTtsAudio({ text: 'hello', voice: 'af_alloy', timeoutMs: 1000 })).rejects.toThrow(
      /content-type/i
    )
  })

  it('falls back to af_alloy once when voice looks unsupported', async () => {
    process.env.TOGETHER_API_KEY = 'test-key'

    vi.doMock('https-proxy-agent', () => ({ HttpsProxyAgent: vi.fn().mockImplementation(() => ({})) }))
    vi.doMock('fs', () => ({
      default: { promises: { mkdir: vi.fn(), writeFile: vi.fn(), unlink: vi.fn() } }
    }))
    vi.doMock('crypto', () => ({ default: { randomBytes: vi.fn().mockReturnValue(Buffer.from('abcdefabcdef', 'hex')) } }))

    const wav = makeWavBuffer()
    const request = vi.fn()
      .mockImplementationOnce((_options: any, cb: (res: any) => void) => {
        const req = new EventEmitter() as any
        req.setTimeout = vi.fn()
        req.end = () => {
          const res = new EventEmitter() as any
          res.statusCode = 400
          res.statusMessage = 'Bad Request'
          res.headers = { 'content-type': 'text/plain' }
          cb(res)
          queueMicrotask(() => {
            res.emit('data', Buffer.from('invalid voice', 'utf8'))
            res.emit('end')
          })
        }
        return req
      })
      .mockImplementationOnce((_options: any, cb: (res: any) => void) => {
        const req = new EventEmitter() as any
        req.setTimeout = vi.fn()
        req.end = () => {
          const res = new EventEmitter() as any
          res.statusCode = 200
          res.statusMessage = 'OK'
          res.headers = { 'content-type': 'application/octet-stream' }
          cb(res)
          queueMicrotask(() => {
            res.emit('data', wav)
            res.emit('end')
          })
        }
        return req
      })
    vi.doMock('https', () => ({ default: { request } }))

    const { generateTogetherTtsAudio } = await import('@/lib/together-tts-service')
    const result = await generateTogetherTtsAudio({ text: 'hello', voice: 'zz_unknown_voice', timeoutMs: 1000 })

    expect(request).toHaveBeenCalledTimes(2)
    expect(result.voiceUsed).toBe('af_alloy')
  })

  it('retries once on retryable Together errors before succeeding', async () => {
    process.env.TOGETHER_API_KEY = 'test-key'

    vi.doMock('https-proxy-agent', () => ({ HttpsProxyAgent: vi.fn().mockImplementation(() => ({})) }))
    vi.doMock('fs', () => ({
      default: { promises: { mkdir: vi.fn(), writeFile: vi.fn(), unlink: vi.fn() } }
    }))
    vi.doMock('crypto', () => ({ default: { randomBytes: vi.fn().mockReturnValue(Buffer.from('abcdefabcdef', 'hex')) } }))

    const wav = makeWavBuffer()
    const request = vi.fn()
      .mockImplementationOnce((_options: any, cb: (res: any) => void) => {
        const req = new EventEmitter() as any
        req.setTimeout = vi.fn()
        req.end = () => {
          const res = new EventEmitter() as any
          res.statusCode = 503
          res.statusMessage = 'Service Unavailable'
          res.headers = { 'content-type': 'text/plain' }
          cb(res)
          queueMicrotask(() => {
            res.emit('data', Buffer.from('temporarily down', 'utf8'))
            res.emit('end')
          })
        }
        return req
      })
      .mockImplementationOnce((_options: any, cb: (res: any) => void) => {
        const req = new EventEmitter() as any
        req.setTimeout = vi.fn()
        req.end = () => {
          const res = new EventEmitter() as any
          res.statusCode = 200
          res.statusMessage = 'OK'
          res.headers = { 'content-type': 'audio/wav' }
          cb(res)
          queueMicrotask(() => {
            res.emit('data', wav)
            res.emit('end')
          })
        }
        return req
      })
    vi.doMock('https', () => ({ default: { request } }))

    const originalSetTimeout = global.setTimeout
    const setTimeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation((handler, _timeout, ...args) => originalSetTimeout(handler as TimerHandler, 0, ...args))

    try {
      const { generateTogetherTtsAudio } = await import('@/lib/together-tts-service')
      const result = await generateTogetherTtsAudio({ text: 'hello', voice: 'af_alloy', timeoutMs: 1000 })

      expect(request).toHaveBeenCalledTimes(2)
      expect(result.voiceUsed).toBe('af_alloy')
    } finally {
      setTimeoutSpy.mockRestore()
    }
  })

  it('health probe writes and immediately deletes a healthcheck file', async () => {
    process.env.TOGETHER_API_KEY = 'test-key'

    vi.doMock('https-proxy-agent', () => ({ HttpsProxyAgent: vi.fn().mockImplementation(() => ({})) }))
    const wav = makeWavBuffer()
    const request = vi.fn((_options: any, cb: (res: any) => void) => {
      const req = new EventEmitter() as any
      req.setTimeout = vi.fn()
      req.end = () => {
        const res = new EventEmitter() as any
        res.statusCode = 200
        res.statusMessage = 'OK'
        res.headers = { 'content-type': 'audio/wav' }
        cb(res)
        queueMicrotask(() => {
          res.emit('data', wav)
          res.emit('end')
        })
      }
      return req
    })
    vi.doMock('https', () => ({ default: { request } }))

    const mkdir = vi.fn().mockResolvedValue(undefined)
    const writeFile = vi.fn().mockResolvedValue(undefined)
    const unlink = vi.fn().mockResolvedValue(undefined)
    vi.doMock('fs', () => ({
      default: { promises: { mkdir, writeFile, unlink } }
    }))
    vi.doMock('crypto', () => ({ default: { randomBytes: vi.fn().mockReturnValue(Buffer.from('abcdefabcdef', 'hex')) } }))

    const { runTogetherTtsHealthProbe } = await import('@/lib/together-tts-service')
    const result = await runTogetherTtsHealthProbe({ timeoutMs: 1000 })

    expect(result.ok).toBe(true)
    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(unlink).toHaveBeenCalledTimes(1)
  })
})
