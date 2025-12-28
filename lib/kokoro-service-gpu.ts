import { EventEmitter } from 'events'
import { spawn, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'

import { getWavAudioMetadata, type GeneratedAudioResult } from './audio-utils'
import { DEFAULT_LANGUAGE, getLanguageConfig, isLanguageSupported } from './language-config'
import type { ListeningLanguage } from './types'
import {
  resolveKokoroPythonExecutable,
  resolveKokoroWorkingDirectory,
  resolveKokoroWrapperPath,
} from './kokoro-env'

type KokoroWorkerResponse = {
  success: boolean
  request_id?: number
  audio_data?: string
  error?: string
  device?: string
  lang_code?: string
  voice?: string
}

type PendingRequest = {
  startTime: number
  timeout: NodeJS.Timeout
  resolve: (value: KokoroWorkerResponse) => void
  reject: (error: Error) => void
}

const globalForKokoro = globalThis as typeof globalThis & {
  __kokoroTTSGPU?: KokoroTTSService
  __kokoroTTSGPU_CREATED?: boolean
  __kokoroSignalHandlersRegistered?: boolean
}

export class KokoroTTSService extends EventEmitter {
  private process: ChildProcess | null = null
  private initialized = false
  private startPromise: Promise<void> | null = null
  private pendingRequests = new Map<number, PendingRequest>()
  private nextRequestId = 0

  constructor() {
    super()

    if (globalForKokoro.__kokoroTTSGPU_CREATED) {
      throw new Error('KokoroTTSService is a singleton; use kokoroTTSGPU instance instead.')
    }
    globalForKokoro.__kokoroTTSGPU_CREATED = true
  }

  async shutdown(): Promise<void> {
    this.failAllPending(new Error('Kokoro TTS worker shut down'))
    this.initialized = false

    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.startPromise = null
  }

  async isReady(): Promise<boolean> {
    try {
      await this.ensureStarted()
      return this.initialized && this.process !== null
    } catch {
      return false
    }
  }

  async generateAudio(
    text: string,
    speed: number = 1.0,
    language: string = DEFAULT_LANGUAGE
  ): Promise<GeneratedAudioResult> {
    if (!text || text.trim() === '') {
      throw new Error('Text cannot be empty')
    }

    const isReady = await this.isReady()
    if (!isReady) {
      throw new Error('Kokoro TTS service not initialized')
    }

    const requestId = this.nextRequestId++
    const startTime = Date.now()

    const requestedLanguage = (language ?? DEFAULT_LANGUAGE) as ListeningLanguage
    const effectiveLanguage = isLanguageSupported(requestedLanguage) ? requestedLanguage : DEFAULT_LANGUAGE
    const languageConfig = getLanguageConfig(effectiveLanguage)
    const langCodeForPython = languageConfig.code.length === 1 ? languageConfig.code : languageConfig.code.toLowerCase()
    const voiceForPython = languageConfig.voice

    const estimatedChunks = Math.max(1, Math.ceil(text.length / 300))
    const timeoutMs = Math.min(5 * 60 * 1000, Math.max(60 * 1000, estimatedChunks * 30 * 1000))

    const response = await new Promise<KokoroWorkerResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`TTS generation timeout after ${Math.round(timeoutMs / 1000)} seconds`))
      }, timeoutMs)

      this.pendingRequests.set(requestId, { startTime, timeout, resolve, reject })

      const request = {
        request_id: requestId,
        text,
        speed,
        lang_code: langCodeForPython,
        voice: voiceForPython,
      }

      try {
        if (!this.process?.stdin || this.process.stdin.destroyed) {
          throw new Error('Python worker stdin is not available')
        }
        this.process.stdin.write(`${JSON.stringify(request)}\n`)
      } catch (error) {
        clearTimeout(timeout)
        this.pendingRequests.delete(requestId)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })

    if (!response.success || !response.audio_data) {
      throw new Error(response.error || 'Failed to generate audio')
    }

    const audioBuffer = Buffer.from(response.audio_data, 'hex')
    if (audioBuffer.length === 0) {
      throw new Error('Audio buffer is empty after hex decoding')
    }

    const filename = `tts_audio_${Date.now()}_${requestId}.wav`
    const filepath = path.join(process.cwd(), 'public', filename)
    await fs.promises.writeFile(filepath, audioBuffer)
    await pruneOldTtsAudioFiles(5)

    const metadata = getWavAudioMetadata(audioBuffer)
    const duration = metadata.duration

    return {
      audioUrl: `/${filename}`,
      duration,
      byteLength: audioBuffer.length,
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise
    }

    this.startPromise = this.startWorker()
    try {
      await this.startPromise
    } catch (error) {
      this.startPromise = null
      throw error
    }
  }

  private async startWorker(): Promise<void> {
    const pythonScript = resolveKokoroWrapperPath()
    if (!fs.existsSync(pythonScript)) {
      throw new Error(`Kokoro wrapper not found at ${pythonScript}`)
    }

    let pythonExecutable = resolveKokoroPythonExecutable()
    if ((path.isAbsolute(pythonExecutable) || pythonExecutable.includes(path.sep)) && !fs.existsSync(pythonExecutable)) {
      pythonExecutable = 'python3'
    }

    const env: NodeJS.ProcessEnv = { ...process.env }
    this.initialized = false

    this.process = spawn(pythonExecutable, [pythonScript], {
      cwd: resolveKokoroWorkingDirectory(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.process.on('exit', () => {
      this.initialized = false
      this.process = null
      this.startPromise = null
      this.failAllPending(new Error('Kokoro TTS worker exited'))
    })

    this.process.on('error', (error) => {
      this.initialized = false
      this.process = null
      this.startPromise = null
      this.failAllPending(error)
    })

    let jsonBuffer = ''
    this.process.stdout?.on('data', (data: Buffer) => {
      jsonBuffer += data.toString()
      const lines = jsonBuffer.split('\n')
      jsonBuffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const response = JSON.parse(trimmed) as KokoroWorkerResponse
          this.handleResponse(response)
        } catch {
          // If stdout isn't JSON, we intentionally ignore to avoid breaking the stream parser.
        }
      }
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      const output = data.toString()
      if (output.includes('service is ready')) {
        this.initialized = true
        this.emit('ready')
      }
    })

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Kokoro TTS initialization timeout'))
      }, 10 * 60 * 1000)

      this.once('ready', () => {
        clearTimeout(timeout)
        resolve()
      })

      this.process?.once('exit', () => {
        clearTimeout(timeout)
        reject(new Error('Kokoro TTS worker exited during initialization'))
      })
    })
  }

  private handleResponse(response: KokoroWorkerResponse): void {
    let requestId = response.request_id
    if (requestId === undefined || !this.pendingRequests.has(requestId)) {
      const firstPending = this.pendingRequests.keys().next().value as number | undefined
      if (firstPending === undefined) return
      requestId = firstPending
    }

    const pending = this.pendingRequests.get(requestId)
    if (!pending) return

    clearTimeout(pending.timeout)
    this.pendingRequests.delete(requestId)

    if (response.success) {
      pending.resolve(response)
      return
    }

    pending.reject(new Error(response.error || 'Unknown error'))
  }

  private failAllPending(error: Error): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pendingRequests.clear()
  }
}

async function pruneOldTtsAudioFiles(keepCount: number): Promise<void> {
  if (!Number.isFinite(keepCount) || keepCount < 0) return

  const publicDir = path.join(process.cwd(), 'public')
  let entries: string[]
  try {
    entries = await fs.promises.readdir(publicDir)
  } catch {
    return
  }

  const candidates = entries.filter(
    (name) => name.startsWith('tts_audio_') && name.endsWith('.wav')
  )
  if (candidates.length <= keepCount) return

  const filesWithStats = await Promise.all(
    candidates.map(async (name) => {
      const fullPath = path.join(publicDir, name)
      try {
        const stat = await fs.promises.stat(fullPath)
        return { name, fullPath, mtimeMs: stat.mtimeMs }
      } catch {
        return null
      }
    })
  )

  const existing = filesWithStats.filter(
    (item): item is NonNullable<(typeof filesWithStats)[number]> => item !== null
  )

  existing.sort((a, b) => b.mtimeMs - a.mtimeMs)
  const toDelete = existing.slice(keepCount)

  await Promise.all(
    toDelete.map(async (file) => {
      try {
        await fs.promises.unlink(file.fullPath)
      } catch {
        // best-effort
      }
    })
  )
}

export const kokoroTTSGPU =
  globalForKokoro.__kokoroTTSGPU ?? (globalForKokoro.__kokoroTTSGPU = new KokoroTTSService())

if (!globalForKokoro.__kokoroSignalHandlersRegistered) {
  globalForKokoro.__kokoroSignalHandlersRegistered = true

  process.on('SIGINT', async () => {
    await kokoroTTSGPU.shutdown()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await kokoroTTSGPU.shutdown()
    process.exit(0)
  })
}
