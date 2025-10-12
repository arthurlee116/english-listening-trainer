/**
 * 音频工具集合
 * 提供 WAV 元数据解析能力，避免在前端等待 metadata 事件
 */

export interface AudioMetadata {
  duration: number
  sampleRate: number
  channels: number
  bitsPerSample: number
}

export interface GeneratedAudioResult {
  audioUrl: string
  duration: number
  byteLength: number
}

/**
 * 解析 WAV 缓冲区，提取持续时间等基础信息
 * 支持多种WAV格式变体，自动检测音频参数
 */
export function getWavAudioMetadata(buffer: Buffer): AudioMetadata {
  const fallback: AudioMetadata = {
    duration: buffer.length > 0 ? buffer.length / (16000 * 2) : 0,
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
  }

  if (!buffer || buffer.length < 44) {
    console.warn('Invalid WAV buffer: too small or empty')
    return fallback
  }

  // 检查RIFF头部
  const riffHeader = buffer.toString('ascii', 0, 4)
  const waveHeader = buffer.toString('ascii', 8, 12)

  if (riffHeader !== 'RIFF' || waveHeader !== 'WAVE') {
    console.warn('Invalid WAV format: missing RIFF/WAVE headers')
    return fallback
  }

  let offset = 12
  let sampleRate = fallback.sampleRate
  let channels = fallback.channels
  let bitsPerSample = fallback.bitsPerSample
  let dataChunkSize = 0
  let dataStartOffset = -1
  let formatFound = false

  // 遍历所有的chunk
  try {
    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', offset, offset + 4)
      const chunkSize = buffer.readUInt32LE(offset + 4)

      if (chunkSize < 0 || chunkSize > 10000000) { // 10MB上限制
        console.warn(`Invalid chunk size: ${chunkSize}`)
        break
      }

      const chunkDataStart = offset + 8
      const paddedChunkSize = chunkSize + (chunkSize % 2) // RIFF chunks align to even bytes
      const nextOffset = chunkDataStart + paddedChunkSize

      if (nextOffset > buffer.length + 1) {
        console.warn(`Chunk exceeds buffer bounds: ${chunkId} size=${chunkSize}`)
        break
      }

      if (chunkId === 'fmt ') {
        if (chunkSize >= 16) {
          // AudioFormat (uint16) - 通常是1 (PCM)
          const audioFormat = buffer.readUInt16LE(chunkDataStart)
          if (audioFormat !== 1) {
            console.warn(`Unsupported audio format: ${audioFormat} (only PCM supported)`)
            return fallback
          }

          channels = buffer.readUInt16LE(chunkDataStart + 2)
          sampleRate = buffer.readUInt32LE(chunkDataStart + 4)
          bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14)

          // 验证参数合理性
          if (sampleRate < 8000 || sampleRate > 48000) {
            console.warn(`Unusual sample rate: ${sampleRate}, using fallback`)
            return fallback
          }

          if (channels < 1 || channels > 8) {
            console.warn(`Invalid channel count: ${channels}, using fallback`)
            return fallback
          }

          if (bitsPerSample < 8 || bitsPerSample > 32 || bitsPerSample % 8 !== 0) {
            console.warn(`Invalid bits per sample: ${bitsPerSample}, using fallback`)
            return fallback
          }

          formatFound = true
        }
      } else if (chunkId === 'data') {
        dataChunkSize = chunkSize
        dataStartOffset = chunkDataStart
        // 继续处理可能存在的其他chunks
      }

      offset = nextOffset
    }
  } catch (error) {
    console.warn('Error parsing WAV chunks:', error)
    return fallback
  }

  if (!formatFound || !dataChunkSize || dataStartOffset < 0) {
    console.warn('WAV format incomplete: missing fmt or data chunk')
    return fallback
  }

  // 验证实际数据大小与声明的一致
  const expectedDataSize = Math.floor(dataChunkSize)
  const availableData = Math.max(0, buffer.length - dataStartOffset)

  if (expectedDataSize > 0 && expectedDataSize > availableData) {
    console.warn(`Data chunk size mismatch: expected ${expectedDataSize}, available ${availableData}. Invalid WAV data`)
    return fallback
  }

  const usableDataSize = Math.min(expectedDataSize, availableData)

  if (usableDataSize <= 0) {
    console.warn('Invalid WAV data: no sample frames')
    return fallback
  }

  const bytesPerSample = bitsPerSample / 8
  const sampleFrameSize = channels * bytesPerSample
  const totalSampleFrames = Math.floor(usableDataSize / sampleFrameSize)

  if (totalSampleFrames <= 0) {
    console.warn('Invalid WAV data: no sample frames')
    return fallback
  }

  const duration = totalSampleFrames / sampleRate

  if (!Number.isFinite(duration) || duration <= 0 || duration > 3600) { // 1小时上限
    console.warn(`Invalid duration calculated: ${duration}, using fallback`)
    return fallback
  }

  console.log(`WAV metadata: ${duration.toFixed(2)}s @ ${sampleRate}Hz ${channels}ch ${bitsPerSample}bit`)

  return {
    duration,
    sampleRate,
    channels,
    bitsPerSample,
  }
}

/**
 * 检测音频文件格式
 */
export function detectAudioFormat(buffer: Buffer): 'wav' | 'mp3' | 'unknown' {
  if (!buffer || buffer.length < 4) {
    return 'unknown'
  }

  // WAV检测
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
    return 'wav'
  }

  // MP3检测 - ID3v2头部或MPEG帧同步
  const first4Bytes = buffer.slice(0, 4)
  if (first4Bytes[0] === 0x49 && first4Bytes[1] === 0x44 && first4Bytes[2] === 0x33) {
    // ID3v2
    return 'mp3'
  }

  if ((first4Bytes[0] & 0xFF) === 0xFF && (first4Bytes[1] & 0xE0) === 0xE0) {
    // MPEG帧同步
    return 'mp3'
  }

  return 'unknown'
}

/**
 * 为音频文件生成metadata缓存
 */
export interface AudioMetadataCache {
  [fileUrl: string]: AudioMetadata & {
    lastValidated: number
    format: string
  }
}

// 全局metadata缓存（可用于优化重复访问）
const metadataCache = new Map<string, AudioMetadata & { lastValidated: number, format: string }>()

/**
 * 从URL获取音频metadata，支持缓存
 */
export async function getAudioMetadataFromUrl(url: string): Promise<AudioMetadata | null> {
  const cached = metadataCache.get(url)
  if (cached && Date.now() - cached.lastValidated < 5 * 60 * 1000) { // 5分钟缓存
    return cached
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const format = detectAudioFormat(buffer)

    let metadata: AudioMetadata

    if (format === 'wav') {
      metadata = getWavAudioMetadata(buffer)
    } else {
      // 对其他格式使用大致估算
      const bytesPerSecond = 32000 // 基于32kbit/s MP3的估算
      metadata = {
        duration: buffer.length / bytesPerSecond,
        sampleRate: 44100,
        channels: 2,
        bitsPerSample: 16
      }
    }

    // 缓存metadata
    metadataCache.set(url, {
      ...metadata,
      lastValidated: Date.now(),
      format
    })

    return metadata
  } catch (error) {
    console.warn('Failed to fetch audio metadata:', error)
    return null
  }
}

/**
 * 验证音频文件格式是否支持
 */
export function validateAudioFormat(buffer: Buffer): { isValid: boolean; format: string; confidence: number } {
  const format = detectAudioFormat(buffer)

  if (format === 'wav') {
    // WAV文件的额外验证
    const metadata = getWavAudioMetadata(buffer)
    const confidence = metadata.duration > 0 && metadata.sampleRate > 0 ? 1 : 0.5
    return { isValid: confidence > 0, format, confidence }
  }

  if (format === 'mp3') {
    return { isValid: true, format, confidence: 0.8 }
  }

  return { isValid: false, format: 'unknown', confidence: 0 }
}
