/**
 * TTS API Tests
 * 测试TTS API端点的功能
 */

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest'
import { POST } from '@/app/api/tts/route'
import type { NextRequest } from 'next/server'

// Mock kokoroTTSGPU
vi.mock('@/lib/kokoro-service-gpu', () => ({
  kokoroTTSGPU: {
    isReady: vi.fn(),
    generateAudio: vi.fn()
  }
}))

// Mock language config
vi.mock('@/lib/language-config', () => ({
  isLanguageSupported: vi.fn()
}))

import { kokoroTTSGPU } from '@/lib/kokoro-service-gpu'
import { isLanguageSupported } from '@/lib/language-config'

const mockKokoroTTSGPU = kokoroTTSGPU as any
const mockIsLanguageSupported = vi.mocked(isLanguageSupported)

// Mock NextRequest
const createMockNextRequest = (body: any): NextRequest => {
  const request = new Request('http://localhost/api/tts', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  }) as any

  // Add NextRequest specific properties
  request.cookies = {
    get: vi.fn().mockReturnValue(null)
  }
  request.nextUrl = new URL('http://localhost/api/tts')

  return request
}

describe('/api/tts POST', () => {
  const mockAudioResult = {
    audioUrl: '/tts_audio_123.wav',
    duration: 45.2,
    byteLength: 123456
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Input Validation', () => {
    it('should return 400 when text is missing', async () => {
      const request = createMockNextRequest({})

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('文本内容不能为空')
    })

    it('should return 400 when text is empty', async () => {
      const request = createMockNextRequest({ text: '' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('文本内容不能为空')
    })

    it('should return 400 for unsupported language', async () => {
      mockIsLanguageSupported.mockReturnValue(false)

      const request = createMockNextRequest({
        text: 'Hello world',
        language: 'unsupported-lang'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('不支持的语言: unsupported-lang')
      expect(mockIsLanguageSupported).toHaveBeenCalledWith('unsupported-lang')
    })

    it('should use default language when not provided', async () => {
      mockIsLanguageSupported.mockReturnValue(true)
      mockKokoroTTSGPU.isReady.mockResolvedValue(true)
      mockKokoroTTSGPU.generateAudio.mockResolvedValue(mockAudioResult)

      const request = createMockNextRequest({ text: 'Hello world' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockIsLanguageSupported).toHaveBeenCalledWith('en-US')
    })
  })

  describe('Service Readiness', () => {
    beforeEach(() => {
      mockIsLanguageSupported.mockReturnValue(true)
    })

    it('should return 503 when TTS service is not ready', async () => {
      mockKokoroTTSGPU.isReady.mockResolvedValue(false)

      const request = createMockNextRequest({ text: 'Hello world' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toBe('GPU TTS服务未就绪，请稍后重试')
      expect(mockKokoroTTSGPU.isReady).toHaveBeenCalled()
    })

    it('should proceed when TTS service is ready', async () => {
      mockKokoroTTSGPU.isReady.mockResolvedValue(true)
      mockKokoroTTSGPU.generateAudio.mockResolvedValue(mockAudioResult)

      const request = createMockNextRequest({ text: 'Hello world' })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockKokoroTTSGPU.isReady).toHaveBeenCalled()
      expect(mockKokoroTTSGPU.generateAudio).toHaveBeenCalled()
    })
  })

  describe('Audio Generation', () => {
    beforeEach(() => {
      mockIsLanguageSupported.mockReturnValue(true)
      mockKokoroTTSGPU.isReady.mockResolvedValue(true)
    })

    it('should generate audio successfully', async () => {
      mockKokoroTTSGPU.generateAudio.mockResolvedValue(mockAudioResult)

      const request = createMockNextRequest({
        text: 'Hello world',
        speed: 1.2,
        language: 'en-US'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        audioUrl: '/tts_audio_123.wav',
        duration: 45.2,
        byteLength: 123456,
        language: 'en-US',
        message: 'GPU加速音频生成成功',
        provider: 'kokoro-gpu',
        format: 'wav'
      })

      expect(mockKokoroTTSGPU.generateAudio).toHaveBeenCalledWith('Hello world', 1.2, 'en-US')
    })

    it('should use default speed when not provided', async () => {
      mockKokoroTTSGPU.generateAudio.mockResolvedValue(mockAudioResult)

      const request = createMockNextRequest({ text: 'Hello world' })

      await POST(request)

      expect(mockKokoroTTSGPU.generateAudio).toHaveBeenCalledWith('Hello world', 1.0, 'en-US')
    })

    it('should handle audio generation errors', async () => {
      const error = new Error('Audio generation failed')
      mockKokoroTTSGPU.generateAudio.mockRejectedValue(error)

      const request = createMockNextRequest({ text: 'Hello world' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('GPU音频生成失败')
      expect(data.details).toBe('Audio generation failed')
      expect(data.provider).toBe('kokoro-gpu')
    })

    it('should handle timeout errors with specific message', async () => {
      const timeoutError = new Error('Audio generation timeout')
      mockKokoroTTSGPU.generateAudio.mockRejectedValue(timeoutError)

      const request = createMockNextRequest({ text: 'Hello world' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(504)
      expect(data.error).toBe('GPU音频生成超时，长文本需要更多时间，请稍后重试')
    })

    it('should handle initialization errors', async () => {
      const initError = new Error('TTS service not initialized')
      mockKokoroTTSGPU.generateAudio.mockRejectedValue(initError)

      const request = createMockNextRequest({ text: 'Hello world' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toBe('GPU TTS服务初始化中，请稍后重试')
    })

    it('should handle CUDA/GPU errors', async () => {
      const cudaError = new Error('CUDA error: out of memory')
      mockKokoroTTSGPU.generateAudio.mockRejectedValue(cudaError)

      const request = createMockNextRequest({ text: 'Hello world' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toBe('GPU加速服务异常，请检查CUDA配置')
    })

    it('should handle file save errors', async () => {
      const saveError = new Error('Failed to save audio file')
      mockKokoroTTSGPU.generateAudio.mockRejectedValue(saveError)

      const request = createMockNextRequest({ text: 'Hello world' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('音频文件保存失败')
    })

    it('should handle Kokoro module errors', async () => {
      const moduleError = new Error('Kokoro modules not available')
      mockKokoroTTSGPU.generateAudio.mockRejectedValue(moduleError)

      const request = createMockNextRequest({ text: 'Hello world' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toBe('Kokoro模块不可用，请检查服务器配置')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const request = new Request('http://localhost/api/tts', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      }) as any
      request.cookies = { get: vi.fn().mockReturnValue(null) }
      request.nextUrl = new URL('http://localhost/api/tts')

      const response = await POST(request)

      expect(response.status).toBe(500)
    })

    it('should handle unexpected errors', async () => {
      mockIsLanguageSupported.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const request = createMockNextRequest({ text: 'Hello world' })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('GPU音频生成失败')
    })
  })

  describe('Response Format', () => {
    beforeEach(() => {
      mockIsLanguageSupported.mockReturnValue(true)
      mockKokoroTTSGPU.isReady.mockResolvedValue(true)
    })

    it('should return correct response structure on success', async () => {
      const customAudioResult = {
        audioUrl: '/custom_audio.wav',
        duration: 30.5,
        byteLength: 98765
      }

      mockKokoroTTSGPU.generateAudio.mockResolvedValue(customAudioResult)

      const request = createMockNextRequest({
        text: 'Test text',
        speed: 0.8,
        language: 'en-GB'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data).toEqual({
        success: true,
        audioUrl: '/custom_audio.wav',
        duration: 30.5,
        byteLength: 98765,
        language: 'en-GB',
        message: 'GPU加速音频生成成功',
        provider: 'kokoro-gpu',
        format: 'wav'
      })
    })

    it('should include error details in error responses', async () => {
      const detailedError = new Error('Detailed error message')
      mockKokoroTTSGPU.generateAudio.mockRejectedValue(detailedError)

      const request = createMockNextRequest({ text: 'Hello world' })

      const response = await POST(request)
      const data = await response.json()

      expect(data.details).toBe('Detailed error message')
      expect(data.provider).toBe('kokoro-gpu')
    })
  })
})