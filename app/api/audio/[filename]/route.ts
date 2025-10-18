import { NextRequest, NextResponse } from 'next/server'
import { stat } from 'fs/promises'
import { createReadStream, existsSync } from 'fs'
import { Readable } from 'stream'
import path from 'path'

type ParsedRange =
  | { type: 'partial'; start: number; end: number }
  | { type: 'invalid' }

const AUDIO_HEADERS_BASE = {
  'Content-Type': 'audio/wav',
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
} as const

function parseRangeHeader(range: string, fileSize: number): ParsedRange {
  const prefix = 'bytes='
  if (!range.startsWith(prefix)) {
    return { type: 'invalid' }
  }

  const value = range.slice(prefix.length).trim()
  if (value === '' || value.includes(',')) {
    return { type: 'invalid' }
  }

  const [startStr, endStr] = value.split('-')

  if (startStr === '' && endStr === '') {
    return { type: 'invalid' }
  }

  if (startStr === '') {
    const suffixLength = Number(endStr)
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return { type: 'invalid' }
    }
    const start = Math.max(fileSize - suffixLength, 0)
    const end = fileSize - 1
    if (start > end) {
      return { type: 'invalid' }
    }
    return { type: 'partial', start, end }
  }

  const start = Number(startStr)
  if (!Number.isInteger(start) || start < 0 || start >= fileSize) {
    return { type: 'invalid' }
  }

  if (endStr === '') {
    return { type: 'partial', start, end: fileSize - 1 }
  }

  const end = Number(endStr)
  if (!Number.isInteger(end) || end < start) {
    return { type: 'invalid' }
  }

  const boundedEnd = Math.min(end, fileSize - 1)
  return { type: 'partial', start, end: boundedEnd }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename

    // 安全检查：只允许访问 tts_audio_ 开头的 .wav 文件
    if (!filename.startsWith('tts_audio_') || !filename.endsWith('.wav')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }
    
    // 构建文件路径
    const filePath = path.join(process.cwd(), 'public', filename)
    
    // 检查文件是否存在
    if (!existsSync(filePath)) {
      console.error(`Audio file not found: ${filePath}`)
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
    }
    
    const range = request.headers.get('range')
    const { size: fileSize } = await stat(filePath)

    if (range) {
      const parsedRange = parseRangeHeader(range, fileSize)
      if (parsedRange.type === 'invalid') {
        return NextResponse.json(
          { error: 'Requested range not satisfiable' },
          {
            status: 416,
            headers: {
              ...AUDIO_HEADERS_BASE,
              'Content-Range': `bytes */${fileSize}`,
            },
          }
        )
      }

      const { start, end } = parsedRange
      const chunkStream = createReadStream(filePath, { start, end })

      return new NextResponse(Readable.toWeb(chunkStream), {
        status: 206,
        headers: {
          ...AUDIO_HEADERS_BASE,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        },
      })
    }

    const fullStream = createReadStream(filePath)
    return new NextResponse(Readable.toWeb(fullStream), {
      status: 200,
      headers: {
        ...AUDIO_HEADERS_BASE,
        'Content-Length': String(fileSize),
      },
    })
  } catch (error) {
    console.error('Error serving audio file:', error)
    return NextResponse.json(
      { error: 'Failed to serve audio file' },
      { status: 500 }
    )
  }
}

// 支持 OPTIONS 请求（CORS preflight）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  })
}
