import { NextRequest, NextResponse } from 'next/server'
import { stat } from 'fs/promises'
import { createReadStream, existsSync } from 'fs'
import path from 'path'
import { Readable } from 'stream'

const AUDIO_HEADERS_BASE = {
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Access-Control-Allow-Origin': '*',
} as const

function resolveAudioContentType(filename: string): string {
  if (filename.endsWith('.mp3')) return 'audio/mpeg'
  return 'audio/wav'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    if (!filename.startsWith('tts_audio_') || (!filename.endsWith('.wav') && !filename.endsWith('.mp3'))) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }
    
    const filePath = path.join(process.cwd(), 'public', 'audio', filename)
    
    if (!existsSync(filePath)) {
      console.warn('Audio file not found:', {
        filename,
        range: request.headers.get('range'),
        userAgent: request.headers.get('user-agent'),
      })
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
    }
    
    const { size: fileSize } = await stat(filePath)
    const range = request.headers.get('range')

    const contentType = resolveAudioContentType(filename)

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/)
      if (!match) {
        console.warn('Invalid range header:', {
          filename,
          range,
          userAgent: request.headers.get('user-agent'),
        })
        return NextResponse.json({ error: 'Invalid range' }, { status: 416 })
      }

      const startText = match[1]
      const endText = match[2]

      let start: number
      let end: number

      if (!startText && !endText) {
        console.warn('Empty range header:', {
          filename,
          range,
          userAgent: request.headers.get('user-agent'),
        })
        return NextResponse.json({ error: 'Invalid range' }, { status: 416 })
      }

      if (!startText && endText) {
        const suffixLength = parseInt(endText, 10)
        if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
          return NextResponse.json({ error: 'Invalid range' }, { status: 416 })
        }
        start = Math.max(fileSize - suffixLength, 0)
        end = fileSize - 1
      } else {
        start = parseInt(startText || '0', 10)
        end = endText ? parseInt(endText, 10) : fileSize - 1
      }

      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < 0) {
        console.warn('Invalid range values:', {
          filename,
          range,
          start,
          end,
          fileSize,
          userAgent: request.headers.get('user-agent'),
        })
        return NextResponse.json({ error: 'Invalid range' }, { status: 416 })
      }

      if (start >= fileSize) {
        console.warn('Range start beyond file size:', {
          filename,
          range,
          start,
          end,
          fileSize,
          userAgent: request.headers.get('user-agent'),
        })
        return NextResponse.json({ error: 'Range not satisfiable' }, { status: 416 })
      }

      end = Math.min(end, fileSize - 1)

      if (start > end) {
        console.warn('Range start greater than end:', {
          filename,
          range,
          start,
          end,
          fileSize,
          userAgent: request.headers.get('user-agent'),
        })
        return NextResponse.json({ error: 'Range not satisfiable' }, { status: 416 })
      }

      const stream = createReadStream(filePath, { start, end })
      const readableStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>

      return new NextResponse(readableStream, {
        status: 206,
        headers: {
          ...AUDIO_HEADERS_BASE,
          'Content-Type': contentType,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        },
      })
    }

    const stream = createReadStream(filePath)
    const readableStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>
    return new NextResponse(readableStream, {
      status: 200,
      headers: {
        ...AUDIO_HEADERS_BASE,
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
      },
    })
  } catch (error) {
    console.error('Error serving audio:', error)
    return NextResponse.json({ error: 'Failed to serve audio' }, { status: 500 })
  }
}

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

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    if (!filename.startsWith('tts_audio_') || (!filename.endsWith('.wav') && !filename.endsWith('.mp3'))) {
      return new NextResponse(null, { status: 400 })
    }

    const filePath = path.join(process.cwd(), 'public', 'audio', filename)
    if (!existsSync(filePath)) {
      return new NextResponse(null, { status: 404 })
    }

    const { size: fileSize } = await stat(filePath)
    return new NextResponse(null, {
      status: 200,
      headers: {
        ...AUDIO_HEADERS_BASE,
        'Content-Type': resolveAudioContentType(filename),
        'Content-Length': String(fileSize),
      },
    })
  } catch (error) {
    console.error('Error serving audio HEAD:', error)
    return new NextResponse(null, { status: 500 })
  }
}
