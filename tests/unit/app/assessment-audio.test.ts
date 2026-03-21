import type { NextRequest } from 'next/server'
import { Readable } from 'stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAssessmentAudioInfo,
  mockGenerateTogetherTtsAudio,
  mockHeadStoredAudio,
  mockCreateReadStream,
  mockStat,
} = vi.hoisted(() => ({
  mockGetAssessmentAudioInfo: vi.fn(),
  mockGenerateTogetherTtsAudio: vi.fn(),
  mockHeadStoredAudio: vi.fn(),
  mockCreateReadStream: vi.fn(),
  mockStat: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/difficulty-service', () => ({
  getAssessmentAudioInfo: mockGetAssessmentAudioInfo,
}))

vi.mock('@/lib/together-tts-service', () => ({
  generateTogetherTtsAudio: mockGenerateTogetherTtsAudio,
}))

vi.mock('@/lib/audio-storage', () => ({
  headStoredAudio: mockHeadStoredAudio,
}))

vi.mock('fs', () => ({
  default: { createReadStream: mockCreateReadStream },
  createReadStream: mockCreateReadStream,
}))

vi.mock('fs/promises', () => ({
  default: {
    stat: mockStat,
  },
  stat: mockStat,
}))

import { GET as assessmentAudioHandler } from '@/app/api/assessment-audio/[id]/route'

describe('assessment audio api', () => {
  beforeEach(() => {
    mockGetAssessmentAudioInfo.mockReset()
    mockGenerateTogetherTtsAudio.mockReset()
    mockHeadStoredAudio.mockReset()
    mockCreateReadStream.mockReset()
    mockStat.mockReset()
  })

  it('stores generated assessment audio when the asset is missing', async () => {
    mockGetAssessmentAudioInfo.mockReturnValue({
      id: 1,
      filename: 'test-1-level6.wav',
      transcript: 'Hello world',
    })
    mockGenerateTogetherTtsAudio.mockResolvedValue({
      filename: 'tts_audio.wav',
      blobUrl: 'https://blob.example/assessment-audio/test-1-level6.wav',
      duration: 1,
      byteLength: 44,
      voiceUsed: 'af_alloy',
      modelUsed: 'hexgrad/Kokoro-82M',
    })
    mockHeadStoredAudio
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        storage: 'blob',
        filename: 'test-1-level6.wav',
        pathname: 'assessment-audio/test-1-level6.wav',
        contentType: 'audio/wav',
        size: 44,
        url: 'https://blob.example/assessment-audio/test-1-level6.wav',
        downloadUrl: 'https://blob.example/assessment-audio/test-1-level6.wav?download=1',
      })

    const response = await assessmentAudioHandler(new Request('http://localhost') as NextRequest, {
      params: Promise.resolve({ id: '1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ url: '/api/assessment-audio/1?download=1', cached: false })
    expect(mockGenerateTogetherTtsAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: 'assessment-audio',
        filename: 'test-1-level6.wav',
      }),
    )
  })

  it('serves audio when download is requested', async () => {
    mockGetAssessmentAudioInfo.mockReturnValue({
      id: 1,
      filename: 'test-1-level6.wav',
      transcript: 'Hello world',
    })
    mockHeadStoredAudio.mockResolvedValue({
      storage: 'local',
      filename: 'test-1-level6.wav',
      pathname: 'assessment-audio/test-1-level6.wav',
      contentType: 'audio/wav',
      size: 4,
      url: '/assessment-audio/test-1-level6.wav',
      downloadUrl: '/assessment-audio/test-1-level6.wav',
      localPath: '/tmp/test-1-level6.wav',
    })
    mockStat.mockResolvedValue({ size: 4 })
    mockCreateReadStream.mockReturnValue(Readable.from(Buffer.from('data')))

    const response = await assessmentAudioHandler(new Request('http://localhost/api/assessment-audio/1?download=1') as NextRequest, {
      params: Promise.resolve({ id: '1' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/wav')
    expect(response.headers.get('Content-Length')).toBe('4')
  })
})
