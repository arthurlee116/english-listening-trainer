import { NextRequest, NextResponse } from 'next/server'
import { stat } from 'fs/promises'
import { createReadStream, existsSync } from 'fs'
import path from 'path'
import { Readable } from 'stream'

const AUDIO_HEADERS_BASE = {
  'Content-Type': 'audio/wav',
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Access-Control-Allow-Origin': '*',
} as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    if (!filename.startsWith('tts_audio_') || !filename.endsWith('.wav')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }
    
    const filePath = path.join(process.cwd(), 'public', 'audio', filename)
    
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
    }
    
    const { size: fileSize } = await stat(filePath)
    const range = request.headers.get('range')

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/)
      if (!match) {
        return NextResponse.json({ error: 'Invalid range' }, { status: 416 })
      }

      const start = match[1] ? parseInt(match[1], 10) : 0
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
      
      if (start >= fileSize || end >= fileSize || start > end) {
        return NextResponse.json({ error: 'Range not satisfiable' }, { status: 416 })
      }

      const stream = createReadStream(filePath, { start, end })
      const readableStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>

      return new NextResponse(readableStream, {
        status: 206,
        headers: {
          ...AUDIO_HEADERS_BASE,
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
