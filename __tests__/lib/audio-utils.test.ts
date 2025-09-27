import { detectAudioFormat, getWavAudioMetadata } from '@/lib/audio-utils'

function createWavBuffer(durationSeconds = 1, sampleRate = 16000, channels = 1, bitsPerSample = 16) {
  const bytesPerSample = bitsPerSample / 8
  const totalSamples = durationSeconds * sampleRate * channels
  const dataChunkSize = totalSamples * bytesPerSample
  const buffer = Buffer.alloc(44 + dataChunkSize)

  buffer.write('RIFF', 0, 4, 'ascii')
  buffer.writeUInt32LE(36 + dataChunkSize, 4)
  buffer.write('WAVE', 8, 4, 'ascii')
  buffer.write('fmt ', 12, 4, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM format
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  const byteRate = sampleRate * channels * bytesPerSample
  buffer.writeUInt32LE(byteRate, 28)
  const blockAlign = channels * bytesPerSample
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36, 4, 'ascii')
  buffer.writeUInt32LE(dataChunkSize, 40)

  return buffer
}

describe('audio-utils', () => {
  it('extracts metadata from a valid WAV buffer', () => {
    const wavBuffer = createWavBuffer(2)

    const metadata = getWavAudioMetadata(wavBuffer)

    expect(metadata.sampleRate).toBe(16000)
    expect(metadata.channels).toBe(1)
    expect(metadata.bitsPerSample).toBe(16)
    expect(metadata.duration).toBeCloseTo(2, 5)
  })

  it('falls back to defaults when the buffer is invalid', () => {
    const invalidBuffer = Buffer.from('not-a-wav')

    const metadata = getWavAudioMetadata(invalidBuffer)

    expect(metadata.sampleRate).toBe(16000)
    expect(metadata.channels).toBe(1)
    expect(metadata.bitsPerSample).toBe(16)
    expect(metadata.duration).toBeCloseTo(invalidBuffer.length / (16000 * 2), 5)
  })

  it('detects wav, mp3, and unknown formats correctly', () => {
    const wavBuffer = createWavBuffer(1)
    const mp3Buffer = Buffer.from([0x49, 0x44, 0x33, 0x04]) // ID3 header
    const unknownBuffer = Buffer.from([0x00, 0x11, 0x22, 0x33])

    expect(detectAudioFormat(wavBuffer)).toBe('wav')
    expect(detectAudioFormat(mp3Buffer)).toBe('mp3')
    expect(detectAudioFormat(unknownBuffer)).toBe('unknown')
  })
})
