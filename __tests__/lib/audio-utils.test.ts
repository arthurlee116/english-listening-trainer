/**
 * Audio Utils Tests
 */
import { describe, it, expect } from 'vitest'
import { getWavAudioMetadata, detectAudioFormat, validateAudioFormat } from '@/lib/audio-utils'

// Mock WAV file header (44 bytes)
const createMockWavHeader = (sampleRate: number = 16000, channels: number = 1, bitsPerSample: number = 16) => {
  const buffer = Buffer.alloc(44)

  // RIFF header
  buffer.write('RIFF', 0, 4, 'ascii')
  buffer.writeUInt32LE(36, 4) // file size
  buffer.write('WAVE', 8, 4, 'ascii')

  // fmt chunk
  buffer.write('fmt ', 12, 4, 'ascii')
  buffer.writeUInt32LE(16, 16) // chunk size

  buffer.writeUInt16LE(1, 20) // audio format (PCM)
  buffer.writeUInt16LE(channels, 22) // channels
  buffer.writeUInt32LE(sampleRate, 24) // sample rate
  buffer.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28) // byte rate
  buffer.writeUInt16LE(channels * bitsPerSample / 8, 32) // block align
  buffer.writeUInt16LE(bitsPerSample, 34) // bits per sample

  // data chunk
  buffer.write('data', 36, 4, 'ascii')
  buffer.writeUInt32LE(1000, 40) // data size

  return buffer
}

describe('getWavAudioMetadata', () => {
  it('should parse valid WAV metadata correctly', () => {
    const buffer = createMockWavHeader(44100, 2, 16)
    const metadata = getWavAudioMetadata(buffer)

    expect(metadata.sampleRate).toBe(44100)
    expect(metadata.channels).toBe(2)
    expect(metadata.bitsPerSample).toBe(16)
    expect(metadata.duration).toBeCloseTo(1000 / (44100 * 2 * 2), 2)
  })

  it('should handle mono WAV files', () => {
    const buffer = createMockWavHeader(16000, 1, 16)
    const metadata = getWavAudioMetadata(buffer)

    expect(metadata.channels).toBe(1)
    expect(metadata.sampleRate).toBe(16000)
    expect(metadata.bitsPerSample).toBe(16)
  })

  it('should return fallback for invalid files', () => {
    const invalidBuffer = Buffer.from('invalid data')
    const metadata = getWavAudioMetadata(invalidBuffer)

    expect(metadata.sampleRate).toBe(16000)
    expect(metadata.channels).toBe(1)
    expect(metadata.bitsPerSample).toBe(16)
  })

  it('should handle unusual sample rates', () => {
    const buffer = createMockWavHeader(8000, 1, 16)
    const metadata = getWavAudioMetadata(buffer)
    expect(metadata.sampleRate).toBe(8000) // Should still parse correctly

    const highRateBuffer = createMockWavHeader(50000, 1, 16)
    const highMetadata = getWavAudioMetadata(highRateBuffer)
    // Should fallback for unusual rates
    expect(highMetadata.sampleRate).toBe(16000)
  })
})

describe('detectAudioFormat', () => {
  it('should detect WAV files', () => {
    const wavBuffer = createMockWavHeader()
    const format = detectAudioFormat(wavBuffer)
    expect(format).toBe('wav')
  })

  it('should detect MP3 files by ID3v2', () => {
    const mp3Buffer = Buffer.from('ID3\x00\x00\x00', 'binary')
    const format = detectAudioFormat(mp3Buffer)
    expect(format).toBe('mp3')
  })

  it('should detect MP3 files by frame sync', () => {
    const mp3FrameBuffer = Buffer.from('\xFF\xFB', 'binary')
    const format = detectAudioFormat(mp3FrameBuffer)
    expect(format).toBe('mp3')
  })

  it('should return unknown for unrecognized formats', () => {
    const unknownBuffer = Buffer.from('unknown format data')
    const format = detectAudioFormat(unknownBuffer)
    expect(format).toBe('unknown')
  })
})

describe('validateAudioFormat', () => {
  it('should validate WAV files with confidence', () => {
    const wavBuffer = createMockWavHeader(44100, 2, 16)
    const validation = validateAudioFormat(wavBuffer)

    expect(validation.isValid).toBe(true)
    expect(validation.format).toBe('wav')
    expect(validation.confidence).toBeGreaterThan(0)
  })

  it('should validate MP3 files', () => {
    const mp3Buffer = Buffer.from('\xFF\xFB\x00', 'binary')
    const validation = validateAudioFormat(mp3Buffer)

    expect(validation.isValid).toBe(true)
    expect(validation.format).toBe('mp3')
    expect(validation.confidence).toBeGreaterThan(0)
  })

  it('should return invalid for empty buffer', () => {
    const emptyBuffer = Buffer.alloc(0)
    const validation = validateAudioFormat(emptyBuffer)

    expect(validation.isValid).toBe(false)
    expect(validation.format).toBe('unknown')
  })
})
