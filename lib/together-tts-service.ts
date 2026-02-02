import 'server-only'

import crypto from 'crypto'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { HttpsProxyAgent } from 'https-proxy-agent'

import { detectAudioFormat, getWavAudioMetadata } from './audio-utils'

const DEFAULT_BASE_URL = 'https://api.together.xyz/v1'
const DEFAULT_MODEL = 'hexgrad/Kokoro-82M'
const DEFAULT_VOICE_FALLBACK = 'af_alloy'
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

type TogetherAudioSpeechRequest = {
  model: string
  input: string
  voice: string
  response_format?: 'wav'
  stream?: false
}

export type TogetherTtsOutput = {
  filename: string
  filePath: string
  duration: number
  byteLength: number
  voiceUsed: string
  modelUsed: string
}

export type TogetherProxyStatusSnapshot = {
  proxyUrl: string
  healthy: boolean
  lastCheckedAt: number
  lastFailure?: string
}

class TogetherTtsError extends Error {
  status?: number
  requestId?: string

  constructor(message: string, options?: { status?: number; requestId?: string }) {
    super(message)
    this.name = 'TogetherTtsError'
    this.status = options?.status
    this.requestId = options?.requestId
  }
}

const globalForTogether = globalThis as typeof globalThis & {
  __togetherProxyAgent?: HttpsProxyAgent<string>
  __togetherProxyAgentUrl?: string
  __togetherProxyLastFailure?: string
  __togetherProxyLastCheckedAt?: number
}

function resolveTogetherProxyUrl(): string | undefined {
  const candidates = [
    process.env.TOGETHER_PROXY_URL,
    process.env.PROXY_URL,
    process.env.HTTPS_PROXY,
    process.env.HTTP_PROXY,
  ]

  for (const value of candidates) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

function getProxyAgent(proxyUrl: string): HttpsProxyAgent<string> {
  if (!globalForTogether.__togetherProxyAgent || globalForTogether.__togetherProxyAgentUrl !== proxyUrl) {
    globalForTogether.__togetherProxyAgent = new HttpsProxyAgent(proxyUrl)
    globalForTogether.__togetherProxyAgentUrl = proxyUrl
  }
  return globalForTogether.__togetherProxyAgent
}

function getTogetherConfig() {
  const apiKey = process.env.TOGETHER_API_KEY?.trim()
  const baseUrl = (process.env.TOGETHER_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const model = process.env.TOGETHER_TTS_MODEL?.trim() || DEFAULT_MODEL
  return { apiKey, baseUrl, model }
}

function isAcceptableWavContentType(contentType: string | null): boolean {
  const value = (contentType ?? '').toLowerCase()
  if (!value) return false
  return (
    value.includes('audio/wav') ||
    value.includes('audio/x-wav') ||
    value.includes('application/octet-stream')
  )
}

function assertWavBytes(buffer: Buffer): void {
  if (!buffer || buffer.length < 44) {
    throw new TogetherTtsError('TTS response body is too small to be a valid WAV')
  }
  if (detectAudioFormat(buffer) !== 'wav') {
    throw new TogetherTtsError('TTS response bytes are not WAV (missing RIFF/WAVE headers)')
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof TogetherTtsError && error.status) {
    return RETRYABLE_STATUS_CODES.has(error.status)
  }
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('timeout') || message.includes('network') || message.includes('socket')
}

async function fetchTogetherWavBytes(payload: TogetherAudioSpeechRequest, timeoutMs: number): Promise<{
  buffer: Buffer
  contentType: string | null
  requestId?: string
}> {
  const { apiKey, baseUrl } = getTogetherConfig()
  if (!apiKey) {
    throw new TogetherTtsError('TOGETHER_API_KEY is not set')
  }

  try {
    const endpoint = new URL(`${baseUrl}/audio/speech`)
    const body = JSON.stringify(payload)
    const proxyUrl = resolveTogetherProxyUrl()
    const agent = proxyUrl ? (getProxyAgent(proxyUrl) as unknown as https.Agent) : undefined

    const buffer = await new Promise<{
      statusCode: number
      statusMessage: string
      headers: Record<string, string | string[] | undefined>
      body: Buffer
    }>((resolve, reject) => {
      const req = https.request(
        {
          hostname: endpoint.hostname,
          path: endpoint.pathname + endpoint.search,
          method: 'POST',
          agent,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'audio/wav',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              statusMessage: res.statusMessage ?? '',
              headers: res.headers as Record<string, string | string[] | undefined>,
              body: Buffer.concat(chunks),
            })
          })
        }
      )

      req.on('error', reject)
      req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')))
      req.end(body)
    })

    const headerValue = (name: string): string | null => {
      const value = buffer.headers[name.toLowerCase()]
      if (!value) return null
      return Array.isArray(value) ? value[0] ?? null : value
    }

    const requestId = headerValue('x-request-id') ?? headerValue('x-together-request-id') ?? undefined
    const contentType = headerValue('content-type')

    if (buffer.statusCode < 200 || buffer.statusCode >= 300) {
      const text = buffer.body.toString('utf8')
      throw new TogetherTtsError(
        `Together TTS failed (${buffer.statusCode}): ${text || buffer.statusMessage || 'request failed'}`,
        { status: buffer.statusCode, requestId }
      )
    }

    if (!isAcceptableWavContentType(contentType)) {
      throw new TogetherTtsError(`Unexpected Together TTS content-type: ${contentType || 'missing'}`, {
        status: buffer.statusCode,
        requestId,
      })
    }

    return { buffer: buffer.body, contentType, requestId }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    globalForTogether.__togetherProxyLastFailure = message
    globalForTogether.__togetherProxyLastCheckedAt = Date.now()
    throw error
  }
}

async function fetchTogetherWavBytesWithRetry(
  payload: TogetherAudioSpeechRequest,
  timeoutMs: number
): Promise<{ buffer: Buffer; contentType: string | null; requestId?: string }> {
  let lastError: unknown = null
  const maxRetries = 2
  const baseDelayMs = 800

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fetchTogetherWavBytes(payload, timeoutMs)
    } catch (error) {
      lastError = error
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error
      }
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 5000)
      await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 200))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function resolveAudioDir(): string {
  return path.join(process.cwd(), 'public', 'audio')
}

function buildTtsFilename(prefix: 'tts_audio' | 'healthcheck'): string {
  const nonce = crypto.randomBytes(6).toString('hex')
  return `${prefix}_${Date.now()}_${nonce}.wav`
}

export async function generateTogetherTtsAudio(params: {
  text: string
  voice: string
  timeoutMs?: number
}): Promise<TogetherTtsOutput> {
  const { model } = getTogetherConfig()

  const text = params.text?.trim() ?? ''
  if (!text) {
    throw new TogetherTtsError('Text cannot be empty')
  }

  const voicePreferred = params.voice?.trim() || DEFAULT_VOICE_FALLBACK
  const timeoutMs = Number.isFinite(params.timeoutMs) ? (params.timeoutMs as number) : 60_000

  const attempt = async (voice: string) => {
    const payload: TogetherAudioSpeechRequest = {
      model,
      input: text,
      voice,
      response_format: 'wav',
      stream: false,
    }
    const { buffer } = await fetchTogetherWavBytesWithRetry(payload, timeoutMs)
    assertWavBytes(buffer)
    return { buffer, voice }
  }

  let audioBuffer: Buffer
  let voiceUsed = voicePreferred
  try {
    const first = await attempt(voicePreferred)
    audioBuffer = first.buffer
    voiceUsed = first.voice
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const looksLikeVoiceUnsupported =
      message.toLowerCase().includes('voice') &&
      (message.toLowerCase().includes('unsupported') || message.toLowerCase().includes('invalid'))

    if (!looksLikeVoiceUnsupported || voicePreferred === DEFAULT_VOICE_FALLBACK) {
      throw error
    }
    const fallback = await attempt(DEFAULT_VOICE_FALLBACK)
    audioBuffer = fallback.buffer
    voiceUsed = fallback.voice
  }

  const audioDir = resolveAudioDir()
  await fs.promises.mkdir(audioDir, { recursive: true })

  const filename = buildTtsFilename('tts_audio')
  const filePath = path.join(audioDir, filename)
  await fs.promises.writeFile(filePath, audioBuffer)

  const duration = getWavAudioMetadata(audioBuffer).duration
  return {
    filename,
    filePath,
    duration,
    byteLength: audioBuffer.length,
    voiceUsed,
    modelUsed: model,
  }
}

export async function runTogetherTtsHealthProbe(params?: { timeoutMs?: number }): Promise<{
  ok: boolean
  latencyMs: number
  error?: string
}> {
  const startedAt = Date.now()
  const timeoutMs = Number.isFinite(params?.timeoutMs) ? (params?.timeoutMs as number) : 15_000

  const audioDir = resolveAudioDir()
  await fs.promises.mkdir(audioDir, { recursive: true })

  const filename = buildTtsFilename('healthcheck')
  const filePath = path.join(audioDir, filename)

  try {
    const { model } = getTogetherConfig()
    const payload: TogetherAudioSpeechRequest = {
      model,
      input: 'health check',
      voice: DEFAULT_VOICE_FALLBACK,
      response_format: 'wav',
      stream: false,
    }

    const { buffer } = await fetchTogetherWavBytes(payload, timeoutMs)
    assertWavBytes(buffer)
    await fs.promises.writeFile(filePath, buffer)
    return { ok: true, latencyMs: Date.now() - startedAt }
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) }
  } finally {
    try {
      await fs.promises.unlink(filePath)
    } catch {
      // best-effort
    }
  }
}

export function getTogetherProxyStatus(): TogetherProxyStatusSnapshot {
  const proxyUrl = resolveTogetherProxyUrl() ?? ''
  return {
    proxyUrl,
    healthy: !globalForTogether.__togetherProxyLastFailure,
    lastCheckedAt: globalForTogether.__togetherProxyLastCheckedAt ?? Date.now(),
    lastFailure: globalForTogether.__togetherProxyLastFailure,
  }
}

export function isTogetherTtsError(value: unknown): value is TogetherTtsError {
  return value instanceof TogetherTtsError
}
