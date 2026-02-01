import type { NextRequest } from 'next/server'
import { Readable } from 'stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAssessmentAudioInfo,
  mockGenerateTogetherTtsAudio,
  mockExistsSync,
  mockMkdir,
  mockRename,
  mockUnlink,
  mockCopyFile,
  mockCreateReadStream,
  mockStat,
} = vi.hoisted(() => ({
  mockGetAssessmentAudioInfo: vi.fn(),
  mockGenerateTogetherTtsAudio: vi.fn(),
  mockExistsSync: vi.fn(),
  mockMkdir: vi.fn(),
  mockRename: vi.fn(),
  mockUnlink: vi.fn(),
  mockCopyFile: vi.fn(),
  mockCreateReadStream: vi.fn(),
  mockStat: vi.fn(),
}))

vi.mock('@/lib/difficulty-service', () => ({
  getAssessmentAudioInfo: mockGetAssessmentAudioInfo,
}))

vi.mock('@/lib/together-tts-service', () => ({
  generateTogetherTtsAudio: mockGenerateTogetherTtsAudio,
}))

vi.mock('fs', () => ({
  default: { existsSync: mockExistsSync, createReadStream: mockCreateReadStream },
  existsSync: mockExistsSync,
  createReadStream: mockCreateReadStream,
}))

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    rename: mockRename,
    unlink: mockUnlink,
    copyFile: mockCopyFile,
    stat: mockStat,
  },
  mkdir: mockMkdir,
  rename: mockRename,
  unlink: mockUnlink,
  copyFile: mockCopyFile,
  stat: mockStat,
}))

import { GET as assessmentAudioHandler } from '@/app/api/assessment-audio/[id]/route'

describe('assessment audio api', () => {
  beforeEach(() => {
    mockGetAssessmentAudioInfo.mockReset()
    mockGenerateTogetherTtsAudio.mockReset()
    mockExistsSync.mockReset()
    mockMkdir.mockReset()
    mockRename.mockReset()
    mockUnlink.mockReset()
    mockCopyFile.mockReset()
    mockCreateReadStream.mockReset()
    mockStat.mockReset()
  })

  it('falls back to copy when rename fails with EXDEV', async () => {
    mockGetAssessmentAudioInfo.mockReturnValue({
      id: 1,
      filename: 'test-1-level6.wav',
      transcript: 'Hello world',
    })
    mockGenerateTogetherTtsAudio.mockResolvedValue({
      filePath: '/tmp/tts_audio.wav',
      filename: 'tts_audio.wav',
      duration: 1,
      byteLength: 44,
      voiceUsed: 'af_alloy',
      modelUsed: 'hexgrad/Kokoro-82M',
    })
    mockExistsSync.mockReturnValue(false)
    mockMkdir.mockResolvedValue(undefined)
    mockRename.mockRejectedValueOnce(Object.assign(new Error('EXDEV: cross-device link not permitted'), { code: 'EXDEV' }))
    mockCopyFile.mockResolvedValue(undefined)
    mockUnlink.mockResolvedValue(undefined)

    const response = await assessmentAudioHandler(new Request('http://localhost') as NextRequest, {
      params: Promise.resolve({ id: '1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ url: '/api/assessment-audio/1?download=1', cached: false })
    expect(mockRename).toHaveBeenCalledTimes(1)
    expect(mockCopyFile).toHaveBeenCalledTimes(1)
    expect(mockUnlink).toHaveBeenCalledTimes(1)
  })

  it('serves audio when download is requested', async () => {
    mockGetAssessmentAudioInfo.mockReturnValue({
      id: 1,
      filename: 'test-1-level6.wav',
      transcript: 'Hello world',
    })
    mockExistsSync.mockReturnValue(true)
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
