import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('cleanupOldAudioFiles', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('targets public/audio and deletes files older than maxAge', async () => {
    const join = vi.fn((...parts: string[]) => parts.join('/'))
    vi.doMock('path', () => ({ join }))

    const unlink = vi.fn().mockResolvedValue(undefined)
    const stat = vi.fn().mockImplementation(async (filePath: string) => {
      if (filePath.includes('tts_audio_old.wav')) {
        return { mtime: new Date('2023-01-01T00:00:00.000Z'), size: 1024 }
      }
      return { mtime: new Date('2024-01-01T00:00:00.000Z'), size: 2048 }
    })
    const readdir = vi.fn().mockResolvedValue(['tts_audio_old.wav', 'tts_audio_new.wav', 'note.txt'])

    vi.doMock('fs', () => ({
      promises: { readdir, stat, unlink }
    }))

    const { cleanupOldAudioFiles } = await import('@/lib/performance-optimizer')
    const result = await cleanupOldAudioFiles(24 * 60 * 60 * 1000)

    expect(join).toHaveBeenCalledWith(process.cwd(), 'public', 'audio')
    expect(unlink).toHaveBeenCalledTimes(1)
    expect(unlink).toHaveBeenCalledWith(expect.stringContaining('tts_audio_old.wav'))
    expect(result.deletedCount).toBe(1)
  })
})

